import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as s from "../src/db/schema";
import { SANDBOX_COOKIE, signSandboxCookie } from "../src/lib/demo/cookie";
import { storeConfig } from "../store.config";

/**
 * Phase 7.3: per-request database routing, against a real Postgres (sandboxes
 * are schemas + per-connection search_path, which the embedded PGlite can't
 * do). Set TEST_POSTGRES_URL to any database this test may create databases
 * from, e.g. postgres://postgres:attar@localhost:55432/attar. CI runs it.
 * Against Neon, also set TEST_POSTGRES_DIRECT_URL (the URL without -pooler).
 */
const base = process.env.TEST_POSTGRES_URL;
const skip = base ? false : "set TEST_POSTGRES_URL to run the sandbox isolation tests";
const secret = "sandbox-test-secret-0123456789abcdef";
const project = process.cwd();
const name = `attar_sandbox_${randomBytes(4).toString("hex")}`;
let admin: postgres.Sql;
let database: typeof import("../src/db");
let router: typeof import("../src/db/sandbox-router");
let lifecycle: typeof import("../src/lib/demo/sandbox");
let session: typeof import("../src/lib/admin/session");
let creation: typeof import("../src/lib/checkout/create-order");
let transitions: typeof import("../src/lib/orders/transitions");
let limits: typeof import("../src/lib/rate-limit");
let raw: postgres.Sql;

before(async () => {
  if (skip) return;
  admin = postgres(base!, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(base!);
  url.pathname = `/${name}`;
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: url.toString(), DEMO_MODE: "true", BETTER_AUTH_SECRET: secret });
  delete process.env.DATABASE_URL_DIRECT;
  // Neon: TEST_POSTGRES_URL is the pooled URL, this one the direct URL (sandboxes use it).
  if (process.env.TEST_POSTGRES_DIRECT_URL) {
    const direct = new URL(process.env.TEST_POSTGRES_DIRECT_URL);
    direct.pathname = `/${name}`;
    process.env.DATABASE_URL_DIRECT = direct.toString();
  }
  database = await import("../src/db");
  router = await import("../src/db/sandbox-router");
  lifecycle = await import("../src/lib/demo/sandbox");
  session = await import("../src/lib/admin/session");
  creation = await import("../src/lib/checkout/create-order");
  transitions = await import("../src/lib/orders/transitions");
  limits = await import("../src/lib/rate-limit");
  raw = postgres(url.toString(), { max: 2, onnotice: () => {} });
  await migrate(database.publicDb, { migrationsFolder: join(project, "src/db/migrations") });
  // A small store touching every kind of copied data.
  await database.publicDb.insert(s.brands).values({ id: "brand", name: "Meral House", slug: "meral-house", brandType: "local" });
  await database.publicDb.insert(s.products).values({ id: "product", name: "Rain Archive", slug: "rain-archive", brandId: "brand", gender: "unisex", concentration: "edp" });
  await database.publicDb.insert(s.productVariants).values({ id: "variant", productId: "product", sku: "RA-50", sizeMl: 50, price: 1700, retailPrice: 2400, stockQuantity: 9 });
  await database.publicDb.insert(s.productImages).values({ productId: "product", url: "/seed/x.webp", alt: "Rain Archive" });
  await database.publicDb.insert(s.notes).values({ id: "note", name: "Rain", slug: "rain", group: "fresh" });
  await database.publicDb.insert(s.productNotes).values({ productId: "product", noteId: "note", position: "top" });
  await database.publicDb.insert(s.coupons).values({ code: "WELCOME", type: "percent", value: 10 });
  await database.publicDb.insert(s.settings).values({ key: "demo", value: { ok: true } });
  await database.publicDb.insert(s.homepageSections).values({ type: "hero", title: "Welcome" });
  await database.publicDb.insert(s.user).values([
    { id: "owner", name: "Owner", email: "owner@example.com", role: "admin" },
    { id: "demo-a", name: "Visitor A", email: "demo-a@demo.invalid", role: "demo" },
    { id: "demo-b", name: "Visitor B", email: "demo-b@demo.invalid", role: "demo" },
  ]);
  await creation.createOrder(checkout()); // one public order, no request: the default client
});
after(async () => {
  if (skip) return;
  await raw?.end();
  await database?.closeDb();
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.end();
});

function checkout() {
  return {
    requestId: crypto.randomUUID(), name: "Raisa Test", phone: "01712345678", email: "",
    line1: "Test address", area: "Test area", city: "Dhaka", zoneId: storeConfig.checkout.deliveryZones[0].id,
    paymentMethod: "cod" as const, lines: [{ variantId: "variant", qty: 1, price: 1700 }],
  };
}
/** A request from a visitor holding this admin session cookie and, optionally, a sandbox cookie. */
function visitor(sessionToken: string, sandboxCookie?: string) {
  const cookies = [`better-auth.session_token=${sessionToken}`];
  if (sandboxCookie) cookies.push(`${SANDBOX_COOKIE}=${sandboxCookie}`);
  return new Headers({ cookie: cookies.join("; ") });
}
// Drizzle builders are lazy: await inside the request, as a Next request would.
const as = <T>(headers: Headers | null, fn: () => PromiseLike<T>) => router.withRequestHeaders(headers, async () => await fn());
/** Each test starts with no sandboxes and both demo users present. */
async function fresh() {
  const live = await raw<{ id: string }[]>`select id from public.demo_sandboxes`;
  await lifecycle.dropSandboxes(live.map((row) => row.id));
  await raw`insert into public."user" (id, name, email, role)
    values ('demo-a', 'Visitor A', 'demo-a@demo.invalid', 'demo'), ('demo-b', 'Visitor B', 'demo-b@demo.invalid', 'demo')
    on conflict (id) do nothing`;
}
const productName = async () => (await database.db.select().from(s.products).where(eq(s.products.id, "product")))[0]?.name;
const orderCount = async () => (await database.db.select({ n: sql<number>`count(*)::int` }).from(s.orders))[0].n;

/** Every row of every store table in public, plus the sequences: must never change from sandbox activity. */
async function publicFingerprint() {
  const parts: string[] = [];
  for (const table of s.sandboxTables) {
    const tableName = getTableName(table);
    const [row] = await raw.unsafe(`select count(*)::int as n, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from public."${tableName}" t`);
    parts.push(`${tableName}:${row.n}:${row.h}`);
  }
  for (const sequence of s.sandboxSequences) {
    const [row] = await raw.unsafe(`select last_value::text as v, is_called from public."${sequence.seqName}"`);
    parts.push(`${sequence.seqName}:${row.v}:${row.is_called}`);
  }
  return parts.join("\n");
}

test("every table in schema.ts and in the migrated database is classified as sandbox-copied or public-only", { skip }, async () => {
  const declared = Object.values(s).filter((value) => is(value, PgTable)).map((table) => getTableName(table as PgTable)).sort();
  const copied = s.sandboxTables.map(getTableName);
  const publicOnly = s.publicOnlyTables.map(getTableName);
  assert.deepEqual([...copied, ...publicOnly].sort(), declared);
  assert.equal(new Set([...copied, ...publicOnly]).size, declared.length);
  const live = await raw<{ name: string }[]>`select table_name as name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`;
  assert.deepEqual(live.map((row) => row.name).sort(), declared);
});

test("a new sandbox is a complete copy: rows, sequences, indexes, checks and foreign keys", { skip }, async () => {
  await fresh();
  const started = performance.now();
  const box = await lifecycle.createSandbox("demo-a");
  const elapsed = performance.now() - started;
  // Target < 1 s next to the database; remote runs (e.g. to Neon from far away) can raise it.
  const budget = Number(process.env.TEST_SANDBOX_BUDGET_MS ?? 1000);
  assert.ok(elapsed < budget, `createSandbox took ${Math.round(elapsed)} ms`);
  for (const table of s.sandboxTables) {
    const tableName = getTableName(table);
    const [a] = await raw.unsafe(`select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from public."${tableName}" t`);
    const [b] = await raw.unsafe(`select md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h from ${box.schema}."${tableName}" t`);
    assert.equal(b.h, a.h, tableName);
  }
  const count = async (schema: string, kind: string) =>
    (await raw.unsafe(`select count(*)::int as n from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = $1 and c.contype = $2`, [schema, kind]))[0].n;
  for (const kind of ["f", "c", "p", "u"]) {
    // Public also holds the auth tables' constraints; compare against the store tables only.
    const [expected] = await raw.unsafe(
      `select count(*)::int as n from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace where n.nspname = 'public' and c.contype = $1 and r.relname = any($2)`,
      [kind, s.sandboxTables.map(getTableName)],
    );
    assert.equal(await count(box.schema, kind), expected.n, `constraint kind ${kind}`);
  }
  // Foreign keys point inside the sandbox, never at public.
  const outward = await raw.unsafe(
    `select count(*)::int as n from pg_constraint c join pg_class r on r.oid = c.confrelid join pg_namespace n on n.oid = r.relnamespace
     join pg_namespace own on own.oid = c.connamespace where own.nspname = $1 and c.contype = 'f' and n.nspname <> $1`,
    [box.schema],
  );
  assert.equal(outward[0].n, 0);
  const [publicSeq] = await raw`select last_value::text as v from public.order_number_seq`;
  const [sandboxSeq] = await raw.unsafe(`select last_value::text as v from ${box.schema}.order_number_seq`);
  assert.equal(sandboxSeq.v, publicSeq.v);
  await lifecycle.dropSandboxes([box.id]);
  // The demo user went with it.
  assert.equal((await raw`select count(*)::int as n from public."user" where id = 'demo-a'`)[0].n, 0);
});

test("two sandboxes never see each other's writes, anonymous visitors see neither, and public never changes", { skip }, async () => {
  await fresh();
  const pristine = await publicFingerprint();
  const a = await lifecycle.createSandbox("demo-a");
  const b = await lifecycle.createSandbox("demo-b");
  const asA = visitor("token-a.sig", signSandboxCookie(secret, a.id, a.expiresAt, "token-a.sig"));
  const asB = visitor("token-b.sig", signSandboxCookie(secret, b.id, b.expiresAt, "token-b.sig"));
  const before = await as(null, orderCount);

  // Visitor A: an admin edit, a checkout (transaction + sequence + coupon-free) and an order transition.
  await as(asA, () => database.db.update(s.products).set({ name: "Rain Archive (A)" }).where(eq(s.products.id, "product")));
  const { order: orderA } = await as(asA, () => creation.createOrder(checkout()));
  await as(asA, () => transitions.transitionOrder(orderA.id, "confirmed", { actor: "demo-a" }));
  // Visitor B edits the same product and orders twice.
  await as(asB, () => database.db.update(s.products).set({ name: "Rain Archive (B)" }).where(eq(s.products.id, "product")));
  const { order: orderB } = await as(asB, () => creation.createOrder(checkout()));
  await as(asB, () => creation.createOrder(checkout()));

  assert.equal(await as(asA, productName), "Rain Archive (A)");
  assert.equal(await as(asB, productName), "Rain Archive (B)");
  assert.equal(await as(null, productName), "Rain Archive");
  assert.equal(await as(asA, orderCount), before + 1);
  assert.equal(await as(asB, orderCount), before + 2);
  assert.equal(await as(null, orderCount), before);
  // Each sandbox numbers its orders from its own copy of the sequence.
  assert.equal(orderA.orderNumber, orderB.orderNumber);
  const stock = async () => (await database.db.select().from(s.productVariants).where(eq(s.productVariants.id, "variant")))[0].stockQuantity;
  // Stock is taken on confirmation: only A confirmed an order.
  assert.deepEqual([await as(asA, stock), await as(asB, stock), await as(null, stock)], [8, 9, 9]);
  const [confirmed] = await as(asA, () => database.db.select().from(s.orders).where(eq(s.orders.id, orderA.id)));
  assert.equal(confirmed.status, "confirmed");
  assert.equal((await as(asB, () => database.db.select().from(s.orders).where(eq(s.orders.id, orderA.id)))).length, 0);

  assert.equal(await publicFingerprint(), pristine);
  await lifecycle.dropSandboxes([a.id, b.id]);
  assert.equal(await publicFingerprint(), pristine);
});

test("forged, expired, unbound or missing sandbox cookies use the shared client", { skip }, async () => {
  await fresh();
  const box = await lifecycle.createSandbox("demo-a");
  const good = signSandboxCookie(secret, box.id, box.expiresAt, "token-a.sig");
  await as(visitor("token-a.sig", good), () => database.db.update(s.products).set({ name: "Mine" }).where(eq(s.products.id, "product")));
  assert.equal(await as(visitor("token-a.sig", good), productName), "Mine");
  const cases: [string, Headers | null][] = [
    ["tampered signature", visitor("token-a.sig", good.slice(0, -2) + (good.endsWith("AA") ? "BB" : "AA"))],
    ["other session", visitor("token-x.sig", good)],
    ["no session", new Headers({ cookie: `${SANDBOX_COOKIE}=${good}` })],
    ["expired", visitor("token-a.sig", signSandboxCookie(secret, box.id, new Date(Date.now() - 1000), "token-a.sig"))],
    ["wrong secret", visitor("token-a.sig", signSandboxCookie("another-secret-0123456789abcdef", box.id, box.expiresAt, "token-a.sig"))],
    ["garbage", visitor("token-a.sig", "demo_x; drop schema public")],
    ["no cookies", new Headers()],
    ["no request", null],
  ];
  for (const [label, headers] of cases) assert.equal(await as(headers, productName), "Rain Archive", label);
  // Outside any request (scripts, migrations): Next's headers() throws and the shared client is used.
  assert.equal(await productName(), "Rain Archive");
  await lifecycle.dropSandboxes([box.id]);
});

test("a dropped sandbox fails closed instead of falling through to public", { skip }, async () => {
  await fresh();
  const pristine = await publicFingerprint();
  const box = await lifecycle.createSandbox("demo-a");
  const headers = visitor("token-a.sig", signSandboxCookie(secret, box.id, box.expiresAt, "token-a.sig"));
  assert.equal(await as(headers, productName), "Rain Archive");
  // Drop it from "another instance": this instance's connection stays open.
  await raw.unsafe(`drop schema ${box.schema} cascade`);
  await assert.rejects(as(headers, () => database.db.update(s.products).set({ name: "Leak" }).where(eq(s.products.id, "product"))));
  await assert.rejects(as(headers, () => creation.createOrder(checkout())));
  assert.equal(await publicFingerprint(), pristine);
  await lifecycle.dropSandboxes([box.id]);
});

test("an ended sandbox (unregistered or past its expiry) routes its visitor to the shared store", { skip }, async () => {
  await fresh();
  const box = await lifecycle.createSandbox("demo-a");
  const headers = visitor("token-a.sig", signSandboxCookie(secret, box.id, box.expiresAt, "token-a.sig"));
  await as(headers, () => database.db.update(s.products).set({ name: "Mine" }).where(eq(s.products.id, "product")));
  assert.equal(await as(headers, productName), "Mine");
  await raw`update public.demo_sandboxes set expires_at = now() - interval '1 second' where id = ${box.id}`;
  await router.closeSandboxClient(box.id); // drops this instance's liveness cache, as cleanup does
  assert.equal(await as(headers, productName), "Rain Archive");
  await lifecycle.dropSandboxes([box.id]);
  assert.equal(await as(headers, productName), "Rain Archive");
});

test("a sandbox connection that doesn't land in its own schema is refused before any query", { skip }, async () => {
  await fresh();
  const pristine = await publicFingerprint();
  // A registered, validly signed sandbox whose schema doesn't exist: the connection's
  // effective search_path is empty, as it would be public if a host ignored the setting.
  const ghost = "ghostghostghost2";
  await raw`insert into public.demo_sandboxes (id, user_id, expires_at) values (${ghost}, 'demo-b', now() + interval '1 minute')`;
  const headers = visitor("token-a.sig", signSandboxCookie(secret, ghost, new Date(Date.now() + 60_000), "token-a.sig"));
  const refused = (error: Error & { cause?: Error }) => /not isolated/.test(`${error.message} ${error.cause?.message}`);
  await assert.rejects(as(headers, productName), refused);
  await assert.rejects(as(headers, () => creation.createOrder(checkout())), refused);
  assert.equal(await publicFingerprint(), pristine);
});

test("auth, sessions and rate limits stay in public for sandboxed requests", { skip }, async () => {
  await fresh();
  const box = await lifecycle.createSandbox("demo-a");
  const headers = visitor("token-a.sig", signSandboxCookie(secret, box.id, box.expiresAt, "token-a.sig"));
  const key = `sandbox-test-${crypto.randomUUID()}`;
  assert.equal(await as(headers, () => limits.takeRateLimit(key, "ip", 5)), true);
  assert.equal((await raw`select count(*)::int as n from public.rate_limits`)[0].n >= 1, true);
  const tables = await raw.unsafe(`select table_name as t from information_schema.tables where table_schema = $1`, [box.schema]);
  assert.deepEqual(tables.map((row) => row.t).sort(), s.sandboxTables.map(getTableName).sort());
  await lifecycle.dropSandboxes([box.id]);
});

test("a demo user is an admin only while routed to their own live sandbox", { skip }, async () => {
  await fresh();
  const { getAuth } = await import("../src/lib/auth");
  const { hashPassword } = await import("better-auth/crypto");
  await raw`insert into public.account (id, user_id, account_id, provider_id, password)
    values ('acct-a', 'demo-a', 'demo-a', 'credential', ${await hashPassword("demo-password-a")}),
           ('acct-b', 'demo-b', 'demo-b', 'credential', ${await hashPassword("demo-password-b")}),
           ('acct-o', 'owner', 'owner', 'credential', ${await hashPassword("owner-password")})`;
  const signIn = async (email: string, password: string) => {
    const response = await getAuth().api.signInEmail({ body: { email, password }, asResponse: true });
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith("better-auth.session_token="))!;
    return decodeURIComponent(cookie.split(";")[0].split("=").slice(1).join("="));
  };
  const tokenA = await signIn("demo-a@demo.invalid", "demo-password-a");
  const tokenB = await signIn("demo-b@demo.invalid", "demo-password-b");
  const owner = await signIn("owner@example.com", "owner-password");
  const a = await lifecycle.createSandbox("demo-a");
  const b = await lifecycle.createSandbox("demo-b");
  const cookieA = signSandboxCookie(secret, a.id, a.expiresAt, tokenA);
  assert.ok(await session.adminSession(visitor(tokenA, cookieA)));
  assert.equal(await session.adminSession(visitor(tokenA)), null, "no sandbox cookie: would edit public");
  // B's own session with A's sandbox: the cookie is bound to A's session.
  assert.equal(await session.adminSession(visitor(tokenB, cookieA)), null);
  // B holding a valid cookie for A's sandbox bound to B's session: not B's sandbox.
  assert.equal(await session.adminSession(visitor(tokenB, signSandboxCookie(secret, a.id, a.expiresAt, tokenB))), null);
  assert.ok(await session.adminSession(visitor(tokenB, signSandboxCookie(secret, b.id, b.expiresAt, tokenB))));
  // The owner stays a normal admin, with or without stray cookies.
  assert.ok(await session.adminSession(visitor(owner)));
  assert.ok(await session.adminSession(visitor(owner, cookieA)));
  // Past the registry expiry (cookie still "valid"): rejected.
  await raw`update public.demo_sandboxes set expires_at = now() - interval '1 second' where id = ${a.id}`;
  assert.equal(await session.adminSession(visitor(tokenA, cookieA)), null);
  // Cleanup removes the expired sandbox and its user; B survives.
  assert.deepEqual(await lifecycle.dropExpiredSandboxes(), [a.id]);
  assert.equal((await raw`select count(*)::int as n from pg_namespace where nspname = ${a.schema}`)[0].n, 0);
  assert.equal((await raw`select count(*)::int as n from public.session where user_id = 'demo-a'`)[0].n, 0);
  assert.equal((await raw`select count(*)::int as n from public."user" where id = 'demo-a'`)[0].n, 0);
  assert.equal((await raw`select count(*)::int as n from public."user" where id = 'owner'`)[0].n, 1);
  await lifecycle.dropSandboxes([b.id]);
});

test("the live-sandbox cap evicts expired sandboxes first, then the oldest", { skip }, async () => {
  await fresh();
  const users = ["cap-1", "cap-2", "cap-3", "cap-4"];
  for (const id of users) await raw`insert into public."user" (id, name, email, role) values (${id}, ${id}, ${`${id}@demo.invalid`}, 'demo')`;
  const t0 = Date.now();
  const first = await lifecycle.createSandbox("cap-1", { cap: 2, now: new Date(t0), ttlMs: 60_000 });
  const second = await lifecycle.createSandbox("cap-2", { cap: 2, now: new Date(t0 + 1000), ttlMs: 10 * 60_000 });
  // At the cap: the oldest (first) goes.
  const third = await lifecycle.createSandbox("cap-3", { cap: 2, now: new Date(t0 + 2000), ttlMs: 60_000 });
  assert.deepEqual(third.removed, [first.id]);
  // Later, third has expired: it goes before the older-but-live second.
  const fourth = await lifecycle.createSandbox("cap-4", { cap: 2, now: new Date(t0 + 120_000), ttlMs: 60_000 });
  assert.deepEqual(fourth.removed, [third.id]);
  const live = await raw`select id from public.demo_sandboxes order by created_at`;
  assert.deepEqual(live.map((row) => row.id), [second.id, fourth.id]);
  const schemas = await raw`select nspname from pg_namespace where nspname like 'demo\\_%' order by nspname`;
  assert.deepEqual(schemas.map((row) => row.nspname).sort(), [second.schema, fourth.schema].sort());
  await lifecycle.dropSandboxes([second.id, fourth.id]);
});
