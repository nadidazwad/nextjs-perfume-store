import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  brands,
  products,
  productVariants,
  customers,
  orders,
  orderItems,
  orderEvents,
  rateLimits,
} from "../src/db/schema";
import { checkoutSchema, deliveryTotals } from "../src/lib/checkout/schema";
import { storeConfig } from "../store.config";
let database: typeof import("../src/db");
let creation: typeof import("../src/lib/checkout/create-order");
let quotes: typeof import("../src/lib/cart/quote");
let tracking: typeof import("../src/lib/orders/public-order");
let transitions: typeof import("../src/lib/orders/transitions");
let limits: typeof import("../src/lib/rate-limit");
const project = process.cwd();
let temporary: string;
before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-checkout-"));
  process.chdir(temporary);
  delete process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  creation = await import("../src/lib/checkout/create-order");
  quotes = await import("../src/lib/cart/quote");
  tracking = await import("../src/lib/orders/public-order");
  transitions = await import("../src/lib/orders/transitions");
  limits = await import("../src/lib/rate-limit");
  await migrate(database.db, {
    migrationsFolder: join(project, "src/db/migrations"),
  });
  await database.db
    .insert(brands)
    .values({
      id: "checkout-brand",
      name: "Meral House",
      slug: "meral-house",
      brandType: "local",
    });
  await database.db
    .insert(products)
    .values({
      id: "checkout-product",
      name: "Rain Archive",
      slug: "rain-archive",
      brandId: "checkout-brand",
      gender: "unisex",
      concentration: "edp",
    });
});
after(async () => {
  await database?.closeDb();
  process.chdir(project);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});
async function variant(stock = 7) {
  const [item] = await database.db
    .insert(productVariants)
    .values({
      productId: "checkout-product",
      sku: crypto.randomUUID(),
      sizeMl: 50,
      price: 1700,
      retailPrice: 2400,
      stockQuantity: stock,
    })
    .returning();
  return item;
}
function input(variantId: string) {
  return {
    requestId: crypto.randomUUID(),
    name: "Raisa Test",
    phone: "01712345678",
    email: "",
    line1: "Test address",
    area: "Test area",
    city: "Dhaka",
    zoneId: storeConfig.checkout.deliveryZones[0].id,
    paymentMethod: "cod" as const,
    lines: [{ variantId, qty: 1, price: 1700 }],
  };
}
async function stock(id: string) {
  return (
    await database.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
  )[0].stockQuantity;
}

test("checkout rejects invalid phones, disabled methods, missing TrxID, duplicate lines and oversized inputs", () => {
  const base = input("fixture");
  for (const patch of [
    { phone: "01234567890" },
    { paymentMethod: "nagad" },
    { paymentMethod: "bkash" },
    { name: "x".repeat(121) },
    { lines: [...base.lines, ...base.lines] },
    { lines: [{ variantId: "fixture", qty: -1 }] },
    { zoneId: "unknown" },
  ])
    assert.equal(
      checkoutSchema.safeParse({ ...base, ...patch }).success,
      false,
    );
  assert.equal(checkoutSchema.parse(base).phone, "+8801712345678");
  assert.equal(
    checkoutSchema.safeParse({
      ...base,
      paymentMethod: "bkash",
      txnId: "TESTA93K",
    }).success,
    true,
  );
});
test("delivery fees and free delivery use the configured threshold", () => {
  const zone = storeConfig.checkout.deliveryZones[0];
  assert.equal(deliveryTotals(1700, zone.id).fee, zone.fee);
  assert.equal(
    deliveryTotals(storeConfig.checkout.freeDeliveryOver!, zone.id).fee,
    0,
  );
});
test("quotes surface price drift, stock caps, unavailable and inactive items", async () => {
  const item = await variant(2);
  let quote = await quotes.quoteCart([
    { variantId: item.id, qty: 8, price: 1 },
  ]);
  assert.equal(quote.items[0].qty, 2);
  assert.equal(quote.subtotal, 3400);
  assert.equal(quote.messages.length, 2);
  await database.db
    .update(productVariants)
    .set({ isActive: false })
    .where(eq(productVariants.id, item.id));
  quote = await quotes.quoteCart([{ variantId: item.id, qty: 1 }]);
  assert.equal(quote.items.length, 0);
  assert.equal(quote.messages.length, 1);
  assert.equal(
    (await quotes.quoteCart([{ variantId: "deleted", qty: 1 }])).items.length,
    0,
  );
});
test("COD creates snapshots and pending event without changing stock; same request retries once", async () => {
  const item = await variant(),
    payload = input(item.id);
  const results = await Promise.all([
    creation.createOrder(payload),
    creation.createOrder(payload),
  ]);
  assert.equal(results.filter((r) => r.created).length, 1);
  const order = results[0].order;
  assert.equal(order.status, "pending");
  assert.equal(order.customerPhone, "+8801712345678");
  assert.equal(order.total, 1700 + storeConfig.checkout.deliveryZones[0].fee);
  assert.equal(await stock(item.id), 7);
  const snapshots = await database.db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].unitPrice, 1700);
  assert.equal(
    (
      await database.db
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, order.id))
    ).length,
    1,
  );
});
test("manual payment stores TrxID, applies free delivery, and never marks payment verified", async () => {
  const item = await variant();
  const { order } = await creation.createOrder({
    ...input(item.id),
    paymentMethod: "bkash",
    txnId: "TEST9A8B",
    lines: [{ variantId: item.id, qty: 3, price: 1700 }],
  });
  assert.equal(order.paymentTxnId, "TEST9A8B");
  assert.equal(order.paymentVerified, false);
  assert.equal(order.total, 5100);
  assert.equal(order.deliveryFee, 0);
  assert.equal(await stock(item.id), 7);
});
test("server rejects changed prices, stock and honeypot; never accepts client totals", async () => {
  const item = await variant(1);
  const payload = input(item.id);
  await assert.rejects(
    creation.createOrder({
      ...payload,
      lines: [{ variantId: item.id, qty: 1, price: 1 }],
    }),
    /bag has changed/,
  );
  await assert.rejects(
    creation.createOrder({
      ...payload,
      lines: [{ variantId: item.id, qty: 2 }],
    }),
    /bag has changed/,
  );
  await assert.rejects(
    creation.createOrder({ ...payload, website: "spam.example" }),
    /couldn't place/,
  );
  assert.equal(
    (
      await database.db
        .select()
        .from(orders)
        .where(eq(orders.id, payload.requestId))
    ).length,
    0,
  );
  const { order } = await creation.createOrder({
    ...payload,
    total: 0,
    subtotal: 0,
    deliveryFee: 0,
  });
  assert.equal(order.subtotal, 1700);
  assert.equal(await stock(item.id), 1);
});
test("blocked customers cannot place orders or update their saved details", async () => {
  const item = await variant();
  const payload = { ...input(item.id), phone: "01812345678" };
  await database.db
    .insert(customers)
    .values({
      name: "Blocked fixture",
      phone: "+8801812345678",
      isBlocked: true,
    });
  await assert.rejects(creation.createOrder(payload), /can't accept/);
  const [customer] = await database.db
    .select()
    .from(customers)
    .where(eq(customers.phone, "+8801812345678"));
  assert.equal(customer.name, "Blocked fixture");
});
test("tracking requires both identifiers and excludes internal notes and admin messages", async () => {
  const item = await variant();
  const { order } = await creation.createOrder(input(item.id));
  await database.db
    .insert(orderEvents)
    .values({
      orderId: order.id,
      type: "note",
      message: "PRIVATE NOTE",
      actor: "admin-private",
    });
  assert.equal(
    await tracking.getPublicOrder(order.orderNumber, "+8801912345678"),
    null,
  );
  assert.equal(
    await tracking.getPublicOrder("UNKNOWN", order.customerPhone),
    null,
  );
  const result = await tracking.getPublicOrder(
    order.orderNumber,
    order.customerPhone,
  );
  assert.equal(result?.events.length, 1);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.ok(!JSON.stringify(result).includes("customerPhone"));
});
test("competing pending orders can be recorded but only one can confirm the last unit", async () => {
  const item = await variant(1);
  const a = await creation.createOrder(input(item.id));
  const b = await creation.createOrder(input(item.id));
  assert.equal(await stock(item.id), 1);
  const results = await Promise.allSettled([
    transitions.transitionOrder(a.order.id, "confirmed", { actor: "fixture" }),
    transitions.transitionOrder(b.order.id, "confirmed", { actor: "fixture" }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(await stock(item.id), 0);
});
test("memory rate limits reject excess attempts and recover after expiry", () => {
  const key = crypto.randomUUID();
  assert.equal(limits.consumeMemory(key, 2, 100, 1).allowed, true);
  assert.equal(limits.consumeMemory(key, 2, 100, 2).allowed, true);
  assert.equal(limits.consumeMemory(key, 2, 100, 3).allowed, false);
  assert.equal(limits.consumeMemory(key, 2, 100, 101).allowed, true);
});
test("a flood of new identities cannot lock out a fresh shopper", () => {
  for (let i = 0; i < 10_050; i += 1) limits.consumeMemory(`flood:${i}`, 1, 60_000, 1_000);
  assert.equal(limits.consumeMemory(`shopper:${crypto.randomUUID()}`, 1, 60_000, 1_000).allowed, true);
});
test("database rate limits count atomically and reset after the window", async () => {
  const key = crypto.randomUUID();
  const decisions = await Promise.all(
    Array.from({ length: 8 }, () => limits.consumeDb(key, 5, 60_000, 1_000)),
  );
  assert.equal(decisions.filter((d) => d.allowed).length, 5);
  const blocked = await limits.consumeDb(key, 5, 60_000, 31_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 30);
  assert.equal((await limits.consumeDb(key, 5, 60_000, 61_000)).allowed, true);
  const keys = await database.db.select({ key: rateLimits.key }).from(rateLimits);
  assert.ok(keys.every((row) => /^[0-9a-f]{64}$/.test(row.key)), "stores hashes, not raw identities");
});
test("client IP uses the proxy-appended hop, not the client-supplied one", () => {
  const ip = (value?: string) =>
    limits.clientIp(new Headers(value ? { "x-forwarded-for": value } : {}));
  assert.equal(ip("203.0.113.9"), "203.0.113.9");
  assert.equal(ip("1.1.1.1, 203.0.113.9"), "203.0.113.9");
  assert.equal(ip(), "local");
});
