import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { hashPassword } from "better-auth/crypto";
import { PGlite } from "@electric-sql/pglite";
import * as s from "../src/db/schema";
import { SANDBOX_COOKIE, readCookie, signSandboxCookie, verifySandboxCookie } from "../src/lib/demo/cookie";

/** Phase 7 with DEMO_MODE off (every real store): nothing about the database or admin access changes. */
let database: typeof import("../src/db");
let router: typeof import("../src/db/sandbox-router");
let session: typeof import("../src/lib/admin/session");
let temporary: string;
const project = process.cwd();
before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-demo-"));
  process.chdir(temporary);
  delete process.env.DATABASE_URL;
  delete process.env.DEMO_MODE;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  router = await import("../src/db/sandbox-router");
  session = await import("../src/lib/admin/session");
  await migrate(database.db, { migrationsFolder: join(project, "src/db/migrations") });
  await database.db.insert(s.brands).values({ id: "brand", name: "Fixture House", slug: "fixture-house", brandType: "local" });
  await database.db.insert(s.user).values([
    { id: "owner", name: "Owner", email: "owner@example.com", role: "admin" },
    { id: "visitor", name: "Visitor", email: "demo-visitor@demo.invalid", role: "demo" },
  ]);
  await database.db.insert(s.account).values([
    { id: "a1", userId: "owner", accountId: "owner", providerId: "credential", password: await hashPassword("owner-password") },
    { id: "a2", userId: "visitor", accountId: "visitor", providerId: "credential", password: await hashPassword("visitor-password") },
  ]);
});
after(async () => {
  await database?.closeDb();
  process.chdir(project);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

function envCheck(vars: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, NODE_ENV: "test", ...vars };
  const run = spawnSync(process.execPath, ["--import", "tsx", "-e", 'console.log(require("./src/lib/env").env.DEMO_MODE)'], { env, encoding: "utf8", cwd: project });
  return run.status === 0 ? run.stdout.trim() : run.stderr;
}

test("DEMO_MODE is off unless set to true, and needs Postgres (plus a direct URL on Neon)", () => {
  assert.equal(envCheck({}), "false");
  assert.equal(envCheck({ DEMO_MODE: "false" }), "false");
  assert.equal(envCheck({ DEMO_MODE: "" }), "false");
  assert.match(envCheck({ DEMO_MODE: "yes" }), /DEMO_MODE/);
  assert.match(envCheck({ DEMO_MODE: "true" }), /DEMO_MODE needs a Postgres DATABASE_URL/);
  const pooled = "postgres://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require";
  assert.match(envCheck({ DEMO_MODE: "true", DATABASE_URL: pooled }), /without -pooler[\s\S]*DATABASE_URL_DIRECT/);
  assert.equal(
    envCheck({ DEMO_MODE: "true", DATABASE_URL: pooled, DATABASE_URL_DIRECT: pooled.replace("-pooler", "") }),
    "true",
  );
  assert.equal(envCheck({ DEMO_MODE: "true", DATABASE_URL: "postgres://u:p@localhost:5432/db" }), "true");
});

test("with DEMO_MODE off, db and publicDb are the very same client as before Phase 7", () => {
  const client = Reflect.get(database.db, "$client");
  assert.ok(client);
  assert.equal(Reflect.get(database.publicDb, "$client"), client);
  assert.ok(client instanceof PGlite);
});

test("with DEMO_MODE off, a valid sandbox cookie changes nothing and demo users are not admins", async () => {
  const { getAuth } = await import("../src/lib/auth");
  const signIn = async (email: string, password: string) => {
    const response = await getAuth().api.signInEmail({ body: { email, password }, asResponse: true });
    const line = response.headers.getSetCookie().find((cookie) => cookie.startsWith("better-auth.session_token="))!;
    return readCookie(line.split(";")[0], "better-auth.session_token")!;
  };
  const owner = await signIn("owner@example.com", "owner-password");
  const visitor = await signIn("demo-visitor@demo.invalid", "visitor-password");
  const secret = "attar-local-development-secret-change-before-deploying";
  const sandbox = signSandboxCookie(secret, "abcdefghijklmnop", new Date(Date.now() + 60_000), visitor);
  const headers = (token: string) =>
    new Headers({ cookie: `better-auth.session_token=${encodeURIComponent(token)}; ${SANDBOX_COOKIE}=${sandbox}` });
  assert.equal(await session.adminSession(headers(visitor)), null);
  assert.ok(await session.adminSession(headers(owner)));
  // The cookie itself is valid: only the flag keeps the visitor out.
  assert.equal(await router.currentSandboxId(headers(visitor)), "abcdefghijklmnop");
  const [brand] = await router.withRequestHeaders(headers(visitor), async () =>
    await database.db.select().from(s.brands).where(eq(s.brands.id, "brand")),
  );
  assert.equal(brand.name, "Fixture House");
});

test("sandbox cookies are bound to the session, the secret and the expiry", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const at = new Date(Date.now() + 60_000);
  const cookie = signSandboxCookie(secret, "abcdefghijklmnop", at, "session-1");
  assert.equal(verifySandboxCookie(secret, cookie, "session-1"), "abcdefghijklmnop");
  assert.equal(verifySandboxCookie(secret, cookie, "session-2"), null);
  assert.equal(verifySandboxCookie(secret, cookie, null), null);
  assert.equal(verifySandboxCookie("another-secret-0123456789abcdef", cookie, "session-1"), null);
  assert.equal(verifySandboxCookie(secret, cookie, "session-1", at.getTime()), null);
  assert.equal(verifySandboxCookie(secret, cookie.replace("abcdefghijklmnop", "abcdefghijklmnoq"), "session-1"), null);
  assert.equal(verifySandboxCookie(secret, `${cookie}.x`, "session-1"), null);
  assert.equal(verifySandboxCookie(secret, "../../etc", "session-1"), null);
  assert.throws(() => signSandboxCookie(secret, "Robert'); drop", at, "s"));
  assert.equal(readCookie("a=1; attar_sandbox=%E0%A4%A; b=2", "attar_sandbox"), undefined);
});

test("with DEMO_MODE off, the demo actions refuse before touching anything", async () => {
  const actions = await import("../src/lib/demo/actions");
  const users = async () => (await database.db.select().from(s.user)).length;
  const before = await users();
  for (const action of [actions.startDemo, actions.resetDemo, actions.endDemo]) {
    const result = await action();
    assert.equal(result.ok, false);
  }
  assert.equal(await users(), before);
});

test("DEMO_MODE forces order alerts to the console, whatever NOTIFY_ADAPTER says", () => {
  const script = `
    globalThis.fetch = async () => { console.log("FETCHED"); return new Response("{\\"ok\\":true}"); };
    require("./src/lib/notify").notifyTestPing().then((ok) => console.log("SENT", ok));`;
  const run = (demo: string) =>
    spawnSync(process.execPath, ["--import", "tsx", "-e", script], {
      cwd: project,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH, NODE_ENV: "test", DEMO_MODE: demo, DATABASE_URL: "postgres://u:p@localhost:1/db",
        NOTIFY_ADAPTER: "telegram", TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c",
      },
    }).stdout;
  assert.match(run("false"), /FETCHED[\s\S]*SENT true/);
  const demo = run("true");
  assert.doesNotMatch(demo, /FETCHED/);
  assert.match(demo, /SENT true/);
});

test("with DEMO_MODE off, suggest stays CDN-cacheable and links carry no ugc rel", async () => {
  const { GET } = await import("../src/app/api/search/suggest/route");
  const { NextRequest } = await import("next/server");
  const response = await GET(new NextRequest("http://localhost/api/search/suggest?q=fixture"));
  assert.match(response.headers.get("cache-control") ?? "", /^public, .*s-maxage/);
  const { ugcRel } = await import("../src/lib/demo/links");
  assert.equal(ugcRel("https://example.com"), undefined);
});
