import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";
import * as s from "../src/db/schema";
import { productSchema, entitySchemas, safeUrl } from "../src/lib/admin/schema";
import { validateImage } from "../src/lib/storage/image";
import { localStorageAdapter } from "../src/lib/storage/local";
let database: typeof import("../src/db");
let catalog: typeof import("../src/lib/admin/catalog");
let auth: ReturnType<typeof import("../src/lib/auth").getAuth>;
let temporary: string;
const project = process.cwd();
before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-admin-"));
  process.chdir(temporary);
  delete process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  catalog = await import("../src/lib/admin/catalog");
  await migrate(database.db, {
    migrationsFolder: join(project, "src/db/migrations"),
  });
  await database.db
    .insert(s.brands)
    .values({
      id: "brand",
      name: "Fixture House",
      slug: "fixture-house",
      brandType: "local",
    });
  await database.db
    .insert(s.user)
    .values({
      id: "admin",
      name: "Fixture Admin",
      email: "fixture@example.com",
      role: "admin",
    });
  await database.db
    .insert(s.account)
    .values({
      id: "credential",
      userId: "admin",
      accountId: "admin",
      providerId: "credential",
      password: await hashPassword("fixture-password"),
    });
  auth = (await import("../src/lib/auth")).getAuth();
});
after(async () => {
  await database?.closeDb();
  process.chdir(project);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
const input = () => ({
  name: "Fixture Mist",
  slug: `fixture-${crypto.randomUUID()}`,
  brandId: "brand",
  collectionName: null,
  description: "Fictional test fragrance.",
  gender: "unisex",
  concentration: "edp",
  packaging: "standard",
  fragranceFamily: "woody",
  perfumer: null,
  launchYear: null,
  countryOfOrigin: null,
  groundShippingOnly: false,
  isFeatured: false,
  isActive: true,
  variants: [
    {
      sku: crypto.randomUUID(),
      sizeMl: 50,
      sizeLabel: "50 ml",
      retailPrice: 150,
      price: 100,
      stockQuantity: 10,
      barcode: null,
      isDefault: true,
      isActive: true,
    },
  ],
  images: [{ url: "/seed/test.svg", alt: "Fixture bottle" }],
  notes: [],
});
test("product validation rejects fractional money, excess prices and missing default", () => {
  const p = input();
  assert.equal(
    productSchema.safeParse({
      ...p,
      variants: [{ ...p.variants[0], price: 1.5 }],
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({
      ...p,
      variants: [{ ...p.variants[0], price: 151 }],
    }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({
      ...p,
      variants: [{ ...p.variants[0], isDefault: false }],
    }).success,
    false,
  );
  assert.equal(productSchema.safeParse({ ...p, variants: [] }).success, false);
});
test("content validation rejects unsafe URLs and broken schedules", () => {
  for (const url of ["javascript:alert(1)", "//evil.test", "/\\evil.test"])
    assert.equal(safeUrl.safeParse(url).success, false);
  assert.equal(
    entitySchemas.banners.safeParse({
      placement: "hero",
      title: "A",
      subtitle: null,
      imageUrl: null,
      href: "/products",
      ctaLabel: null,
      sortOrder: 0,
      isActive: true,
      startsAt: "2026-10-02",
      endsAt: "2026-10-01",
    }).success,
    false,
  );
});
test("product saves preserve variant IDs, reject stock drift and roll back all edits", async () => {
  const p = input();
  const id = await catalog.saveProductRecord(undefined, p);
  const [v] = await database.db
    .select()
    .from(s.productVariants)
    .where(eq(s.productVariants.productId, id));
  await catalog.saveProductRecord(id, {
    ...p,
    name: "Edited fixture",
    variants: [{ ...v, expectedStock: 10 }],
  });
  assert.equal(
    (
      await database.db
        .select()
        .from(s.productVariants)
        .where(eq(s.productVariants.productId, id))
    )[0].id,
    v.id,
  );
  await database.db
    .update(s.productVariants)
    .set({ stockQuantity: 9 })
    .where(eq(s.productVariants.id, v.id));
  await assert.rejects(
    catalog.saveProductRecord(id, {
      ...p,
      name: "Should roll back",
      variants: [{ ...v, expectedStock: 10 }],
    }),
    /Stock changed/,
  );
  assert.equal(
    (
      await database.db.select().from(s.products).where(eq(s.products.id, id))
    )[0].name,
    "Edited fixture",
  );
  assert.equal(
    (
      await database.db
        .select()
        .from(s.productVariants)
        .where(eq(s.productVariants.id, v.id))
    )[0].stockQuantity,
    9,
  );
});
test("an editor cannot move a variant from another product", async () => {
  const p = input();
  const a = await catalog.saveProductRecord(undefined, p);
  const b = await catalog.saveProductRecord(undefined, input());
  const [v] = await database.db
    .select()
    .from(s.productVariants)
    .where(eq(s.productVariants.productId, a));
  await assert.rejects(
    catalog.saveProductRecord(b, {
      ...input(),
      variants: [{ ...v, expectedStock: 10 }],
    }),
    /does not belong/,
  );
});
test("uploads decode bytes, reject spoofed MIME and enforce image size", async () => {
  const png = await sharp({
    create: { width: 2000, height: 500, channels: 3, background: "#cccccc" },
  })
    .png()
    .toBuffer();
  const converted = await validateImage(png, "image/png");
  const meta = await sharp(converted).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1600);
  await assert.rejects(validateImage(png, "image/jpeg"));
  await assert.rejects(validateImage(Buffer.from("<svg/>"), "image/svg+xml"));
  await assert.rejects(
    validateImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"),
  );
  const url = await localStorageAdapter.putObject(converted, "test-image.webp");
  assert.equal(url, "/uploads/test-image.webp");
  assert.ok(
    readFileSync(join(temporary, ".data/uploads/test-image.webp")).length,
  );
  // Served by a route, because production servers ignore files added to public/ after build.
  const { GET } = await import("../src/app/uploads/[key]/route");
  const serve = (key: string) => GET(new Request("http://x/uploads/" + key), { params: Promise.resolve({ key }) });
  const served = await serve("test-image.webp");
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/webp");
  assert.equal((await served.arrayBuffer()).byteLength, converted.length);
  for (const bad of ["../secret.webp", "..%2Fsecret.webp", "missing.webp", "x.svg"])
    assert.equal((await serve(bad)).status, 404, bad);
  await assert.rejects(localStorageAdapter.deleteObject("../secret"));
  await localStorageAdapter.deleteObject("test-image.webp");
  assert.equal((await serve("test-image.webp")).status, 404);
});
test("Better Auth signs in seeded credentials, rejects signup and revokes logout sessions", async () => {
  const origin = "http://localhost:3000";
  const req = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(origin + "/api/auth" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  const signup = await req("/sign-up/email", {
    name: "Intruder",
    email: "new@example.com",
    password: "password1234",
  });
  assert.ok(signup.status >= 400);
  const login = await req("/sign-in/email", {
    email: "fixture@example.com",
    password: "fixture-password",
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("session_token"));
  const session = await auth.api.getSession({
    headers: new Headers({ Cookie: cookie }),
  });
  assert.equal(session?.user.role, "admin");
  await req("/sign-out", {}, cookie);
  assert.equal(
    await auth.api.getSession({ headers: new Headers({ Cookie: cookie }) }),
    null,
  );
});
test("admin sign-in is rate limited per client address", async () => {
  const origin = "http://localhost:3000";
  const attempt = () =>
    auth.handler(
      new Request(origin + "/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, "x-forwarded-for": "198.51.100.7" },
        body: JSON.stringify({ email: "fixture@example.com", password: "wrong-password" }),
      }),
    );
  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) statuses.push((await attempt()).status);
  assert.ok(statuses.slice(0, 5).every((status) => status === 401), statuses.join());
  assert.equal(statuses[5], 429);
});
test("every exported admin Server Action verifies the session first", () => {
  const source = readFileSync(join(project, "src/lib/admin/actions.ts"), "utf8");
  const bodies = source.split(/^export async function /m).slice(1);
  assert.ok(bodies.length >= 13);
  for (const body of bodies) {
    const name = body.slice(0, body.indexOf("("));
    const first = body.slice(body.indexOf("{", body.indexOf(")")) + 1).trim().split("\n")[0];
    assert.match(first, /^(const \w+ = )?await requireAdmin\(\);$/, `${name} must start with requireAdmin()`);
  }
});
test("public Server Action modules are the reviewed set", () => {
  // A new "use server" module is a new public endpoint: review its auth, Zod
  // validation and rate limits (docs/PHASE_6_VERIFICATION.md), then add it here.
  const reviewed = [
    "src/lib/admin/actions.ts",
    "src/lib/cart/actions.ts",
    "src/lib/catalog/actions.ts",
    "src/lib/checkout/actions.ts",
    "src/lib/reviews/actions.ts",
  ];
  const found = readdirSync(join(project, "src"), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => join("src", file))
    .filter((file) => /^\s*["']use server["']/.test(readFileSync(join(project, file), "utf8")))
    .sort();
  assert.deepEqual(found, reviewed);
});
