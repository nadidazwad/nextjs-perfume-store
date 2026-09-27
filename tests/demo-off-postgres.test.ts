import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as s from "../src/db/schema";
import { SANDBOX_COOKIE, signSandboxCookie } from "../src/lib/demo/cookie";

/**
 * DEMO_MODE off on a real Postgres (how every production store runs): even a
 * valid sandbox cookie pointing at an existing sandbox schema is ignored.
 * Needs TEST_POSTGRES_URL, like tests/sandbox.test.ts.
 */
const base = process.env.TEST_POSTGRES_URL;
const skip = base ? false : "set TEST_POSTGRES_URL to run the Postgres demo-off test";
const name = `attar_demo_off_${randomBytes(4).toString("hex")}`;
const secret = "demo-off-test-secret-0123456789abcdef";
let admin: postgres.Sql;
let database: typeof import("../src/db");
let router: typeof import("../src/db/sandbox-router");
before(async () => {
  if (skip) return;
  admin = postgres(base!, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(base!);
  url.pathname = `/${name}`;
  delete process.env.DEMO_MODE;
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: url.toString(), BETTER_AUTH_SECRET: secret });
  database = await import("../src/db");
  router = await import("../src/db/sandbox-router");
  await migrate(database.db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });
  await database.db.insert(s.brands).values({ id: "brand", name: "Public House", slug: "public-house", brandType: "local" });
  // A sandbox-shaped schema with different data, as if left over from a demo deployment.
  await database.publicSql().unsafe(
    `create schema demo_abcdefghijklmnop; create table demo_abcdefghijklmnop.brands (like public.brands including all);
     insert into demo_abcdefghijklmnop.brands select id, 'Sandbox House', slug, brand_type, logo_url, hero_image_url, description, is_featured, sort_order, created_at, updated_at from public.brands;`,
  ).simple();
});
after(async () => {
  if (skip) return;
  await database?.closeDb();
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.end();
});

test("with DEMO_MODE off on Postgres, db is the plain postgres.js client and sandbox cookies are ignored", { skip }, async () => {
  // The db proxy binds functions (a postgres.js client is one), so read the client off the session.
  const client = Reflect.get(database.db, "session").client;
  assert.equal(Reflect.get(database.publicDb, "session").client, client);
  assert.equal(database.publicSql(), client);
  assert.ok(Array.isArray(client.options.host), "a real postgres.js client, not the demo router");
  const cookie = signSandboxCookie(secret, "abcdefghijklmnop", new Date(Date.now() + 60_000), "token.sig");
  const headers = new Headers({ cookie: `better-auth.session_token=token.sig; ${SANDBOX_COOKIE}=${cookie}` });
  const [brand] = await router.withRequestHeaders(headers, async () =>
    await database.db.select().from(s.brands).where(eq(s.brands.id, "brand")),
  );
  assert.equal(brand.name, "Public House");
});
