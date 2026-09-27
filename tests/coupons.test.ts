import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { brands, coupons, orders, products, productVariants } from "../src/db/schema";
import {
  couponDiscount,
  couponState,
  evaluateCoupon,
  generateCouponCode,
  normalizeCouponCode,
  type CouponRecord,
} from "../src/lib/coupons/rules";
import { couponSchema } from "../src/lib/admin/schema";
import { deliveryTotals } from "../src/lib/checkout/schema";
import { storeConfig } from "../store.config";

const now = new Date("2026-06-15T12:00:00Z");
const coupon = (patch: Partial<CouponRecord> = {}): CouponRecord => ({
  code: "SAVE10",
  type: "percent",
  value: 10,
  minSubtotal: null,
  maxUses: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...patch,
});

test("discount math: percent rounds down, fixed is capped at the subtotal, integers only", () => {
  assert.equal(couponDiscount("percent", 10, 2000), 200);
  assert.equal(couponDiscount("percent", 15, 999), 149); // 149.85 → 149, never rounds up
  assert.equal(couponDiscount("percent", 100, 1234), 1234);
  assert.equal(couponDiscount("percent", 150, 1000), 1000); // clamped to 100%
  assert.equal(couponDiscount("fixed", 300, 5000), 300);
  assert.equal(couponDiscount("fixed", 300, 250), 250); // never below zero
  assert.equal(couponDiscount("fixed", 300, 0), 0);
  assert.equal(couponDiscount("percent", 10, -5), 0);
  // Large totals stay exact (BigInt path), no float drift.
  assert.equal(couponDiscount("percent", 7, 2_000_000_000), 140_000_000);
  for (let subtotal = 1; subtotal < 5000; subtotal += 37) {
    const d = couponDiscount("percent", 33, subtotal);
    assert(Number.isInteger(d) && d >= 0 && d <= subtotal);
  }
});

test("every validity rule has its own, specific message", () => {
  const check = (c: CouponRecord | null, subtotal = 3000, typed?: string) => evaluateCoupon(c, subtotal, now, typed);
  const ok = check(coupon());
  assert(ok.ok && ok.coupon.discount === 300 && ok.coupon.code === "SAVE10");
  const cases: [ReturnType<typeof check>, string, RegExp][] = [
    [check(null, 3000, "   "), "empty", /Enter a coupon code/],
    [check(null, 3000, "nope"), "not_found", /“NOPE” isn't a valid coupon/],
    [check(coupon({ isActive: false })), "inactive", /no longer active/],
    [check(coupon({ startsAt: new Date("2026-07-01T00:00:00Z") })), "not_started", /isn't active yet/],
    [check(coupon({ endsAt: new Date("2026-06-01T00:00:00Z") })), "expired", /expired on/],
    [check(coupon({ endsAt: now })), "expired", /expired/], // the end instant itself is already over
    [check(coupon({ maxUses: 5, usedCount: 5 })), "used_up", /usage limit/],
    [check(coupon(), 0), "empty_bag", /Add items/],
    [check(coupon({ minSubtotal: 5000 })), "min_subtotal", /Spend .*2,000 more.*5,000/],
  ];
  for (const [result, reason, message] of cases) {
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, reason);
      assert.match(result.message, message);
    }
  }
  // Boundaries that must pass.
  assert(check(coupon({ minSubtotal: 3000 })).ok, "exactly the minimum qualifies");
  assert(check(coupon({ startsAt: now })).ok, "starts exactly now");
  assert(check(coupon({ maxUses: 5, usedCount: 4 })).ok, "last use available");
  // A fixed coupon on a smaller bag discounts the whole subtotal, not more.
  const fixed = check(coupon({ type: "fixed", value: 5000 }), 1200);
  assert(fixed.ok && fixed.coupon.discount === 1200);
});

test("code normalization, generator and admin state", () => {
  assert.equal(normalizeCouponCode("  eid 25 "), "EID25");
  assert.equal(normalizeCouponCode("x".repeat(60)).length, 40);
  const codes = new Set(Array.from({ length: 200 }, () => generateCouponCode()));
  assert(codes.size > 190);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(couponState(coupon(), now), "live");
  assert.equal(couponState(coupon({ isActive: false }), now), "off");
  assert.equal(couponState(coupon({ startsAt: new Date("2027-01-01") }), now), "scheduled");
  assert.equal(couponState(coupon({ endsAt: new Date("2026-01-01") }), now), "expired");
  assert.equal(couponState(coupon({ maxUses: 2, usedCount: 2 }), now), "used_up");
});

test("admin coupon schema enforces type ranges, windows and code format", () => {
  const base = { code: "eid25", type: "percent", value: 25, minSubtotal: null, maxUses: null, startsAt: null, endsAt: null, isActive: true };
  assert.equal(couponSchema.parse(base).code, "EID25");
  for (const patch of [
    { value: 101 },
    { value: 0 },
    { code: "a!" },
    { code: "AB" },
    { maxUses: 0 },
    { startsAt: "2026-06-02T00:00:00Z", endsAt: "2026-06-01T00:00:00Z" },
  ])
    assert.equal(couponSchema.safeParse({ ...base, ...patch }).success, false, JSON.stringify(patch));
  assert(couponSchema.safeParse({ ...base, type: "fixed", value: 5000 }).success);
});

test("totals subtract the coupon and measure free delivery after the discount", () => {
  const zone = storeConfig.checkout.deliveryZones[0];
  const threshold = storeConfig.checkout.freeDeliveryOver!;
  const plain = deliveryTotals(threshold, zone.id);
  assert.equal(plain.fee, 0);
  const discounted = deliveryTotals(threshold, zone.id, 100);
  assert.equal(discounted.fee, zone.fee, "a coupon can take the bag back under the free-delivery line");
  assert.equal(discounted.total, threshold - 100 + zone.fee);
  assert.equal(deliveryTotals(1700, zone.id, 170).total, 1700 - 170 + zone.fee);
});

// --- Server: checkout redemption against a real (PGlite) database ------------
let database: typeof import("../src/db");
let creation: typeof import("../src/lib/checkout/create-order");
let server: typeof import("../src/lib/coupons/server");
const project = process.cwd();
let temporary: string;
before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-coupons-"));
  process.chdir(temporary);
  delete process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  creation = await import("../src/lib/checkout/create-order");
  server = await import("../src/lib/coupons/server");
  await migrate(database.db, { migrationsFolder: join(project, "src/db/migrations") });
  await database.db.insert(brands).values({ id: "coupon-brand", name: "Coupon House", slug: "coupon-house", brandType: "local" });
  await database.db.insert(products).values({ id: "coupon-product", name: "Test Oud", slug: "test-oud", brandId: "coupon-brand", gender: "unisex", concentration: "edp" });
  await database.db.insert(productVariants).values({ id: "coupon-variant", productId: "coupon-product", sku: "CPN-1", sizeMl: 50, price: 2500, retailPrice: 3000, stockQuantity: 50 });
});
after(async () => {
  await database?.closeDb();
  process.chdir(project);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
let phone = 10;
function order(extra: Record<string, unknown> = {}, qty = 1) {
  phone += 1;
  return {
    requestId: crypto.randomUUID(),
    name: "Coupon Tester",
    phone: `017123456${String(phone).padStart(2, "0")}`,
    line1: "Road 1",
    area: "Area",
    city: "Dhaka",
    zoneId: storeConfig.checkout.deliveryZones[0].id,
    paymentMethod: "cod" as const,
    lines: [{ variantId: "coupon-variant", qty, price: 2500 }],
    ...extra,
  };
}
async function used(code: string) {
  return (await database.db.select().from(coupons).where(eq(coupons.code, code)))[0].usedCount;
}

test("checkout re-validates the code, records it on the order and counts one use", async () => {
  await database.db.insert(coupons).values({ code: "TEN", type: "percent", value: 10, minSubtotal: 2000 });
  const check = await server.checkCoupon("ten", 2500);
  assert(check.ok && check.coupon.discount === 250);
  const result = await creation.createOrder(order({ couponCode: "ten", couponDiscount: 250 }));
  assert.equal(result.order.couponCode, "TEN");
  assert.equal(result.order.discount, 250);
  assert.equal(result.order.subtotal, 2500);
  assert.equal(result.order.total, 2500 - 250 + result.order.deliveryFee);
  assert.equal(await used("TEN"), 1);
  // Retrying the same request is idempotent: no second use.
  const again = await creation.createOrder({ ...order({ couponCode: "TEN", couponDiscount: 250 }), requestId: result.order.id, phone: result.order.customerPhone.replace("+880", "0") });
  assert.equal(again.created, false);
  assert.equal(await used("TEN"), 1);
});

test("checkout rejects invalid codes, a changed discount, and client-invented discounts", async () => {
  await database.db.insert(coupons).values([
    { code: "OFF", type: "fixed", value: 300, isActive: false },
    { code: "BIG", type: "fixed", value: 300, minSubtotal: 10_000 },
    { code: "FLAT", type: "fixed", value: 400 },
  ]);
  await assert.rejects(creation.createOrder(order({ couponCode: "NOPE", couponDiscount: 100 })), /isn't a valid coupon/);
  await assert.rejects(creation.createOrder(order({ couponCode: "OFF", couponDiscount: 300 })), /no longer active/);
  await assert.rejects(creation.createOrder(order({ couponCode: "BIG", couponDiscount: 300 })), /Spend/);
  // The shopper saw 300 off but the store changed it to 400: stop and show the new total.
  await assert.rejects(creation.createOrder(order({ couponCode: "FLAT", couponDiscount: 300 })), /discount has changed/);
  // A discount with no code is never honoured.
  await assert.rejects(creation.createOrder(order({ couponDiscount: 500 })), /discount has changed/);
  assert.equal(await used("FLAT"), 0);
  const rows = await database.db.select().from(orders).where(eq(orders.couponCode, "FLAT"));
  assert.equal(rows.length, 0, "failed checkouts roll back entirely");
});

test("max uses: concurrent orders can never take more than the remaining uses", async () => {
  await database.db.insert(coupons).values({ code: "LAST2", type: "fixed", value: 100, maxUses: 2 });
  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => creation.createOrder(order({ couponCode: "LAST2", couponDiscount: 100 }))),
  );
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 2);
  for (const failed of attempts.filter((a) => a.status === "rejected"))
    assert.match(String((failed as PromiseRejectedResult).reason), /usage limit/);
  assert.equal(await used("LAST2"), 2);
  assert.equal(await server.redeemCoupon((await database.db.select().from(coupons).where(eq(coupons.code, "LAST2")))[0].id, database.db), false);
});

test("expired and scheduled windows are enforced at order time", async () => {
  const day = 86_400_000;
  await database.db.insert(coupons).values([
    { code: "PAST", type: "percent", value: 5, startsAt: new Date(Date.now() - 3 * day), endsAt: new Date(Date.now() - day) },
    { code: "SOON", type: "percent", value: 5, startsAt: new Date(Date.now() + day) },
  ]);
  await assert.rejects(creation.createOrder(order({ couponCode: "PAST", couponDiscount: 125 })), /expired/);
  await assert.rejects(creation.createOrder(order({ couponCode: "SOON", couponDiscount: 125 })), /isn't active yet/);
});
