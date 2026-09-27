import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { brands, customers, orderEvents, orderItems, orders, orderStatus, products, productVariants, type OrderStatus } from "../src/db/schema";
import { storeConfig } from "../store.config";

let database: typeof import("../src/db");
let helpers: typeof import("../src/lib/orders/transitions");
let numbering: typeof import("../src/lib/order-number");
const project = process.cwd();
let temporary: string;

before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-orders-test-"));
  process.chdir(temporary);
  // Never use the shop's database or .env. An explicit test URL must name a disposable DB.
  if (process.env.ATTAR_TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.ATTAR_TEST_DATABASE_URL;
  else delete process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  helpers = await import("../src/lib/orders/transitions");
  numbering = await import("../src/lib/order-number");
  await migrate(database.db, { migrationsFolder: join(project, "src/db/migrations") });
  await migrate(database.db, { migrationsFolder: join(project, "src/db/migrations") });
  await database.db.insert(brands).values({ id: "test-brand", name: "Fixture House", slug: "fixture-house", brandType: "local" });
  await database.db.insert(products).values({ id: "test-product", name: "Fixture Mist", slug: "fixture-mist", brandId: "test-brand", gender: "unisex", concentration: "edp" });
  await database.db.insert(customers).values({ id: "test-customer", name: "Fixture Customer", phone: "+8801712345678" });
});
after(async () => { if (database) await database.closeDb(); process.chdir(project); if (temporary) rmSync(temporary, { recursive: true, force: true }); });

async function variant(stock = 10) {
  const [row] = await database.db.insert(productVariants).values({ productId: "test-product", sku: crypto.randomUUID(), sizeMl: 50, price: 100, retailPrice: 150, stockQuantity: stock }).returning();
  return row;
}
async function pending(lines: { id: string | null; quantity: number }[]) {
  return database.db.transaction(async (tx) => {
    const subtotal = lines.reduce((sum, item) => sum + item.quantity * 100, 0);
    const zone = storeConfig.checkout.deliveryZones[0];
    const [row] = await tx.insert(orders).values({ orderNumber: await numbering.nextOrderNumber(tx), customerId: "test-customer", customerName: "Fixture Customer", customerPhone: "+8801712345678", shippingAddress: { line1: "Fixture Road", area: "Test", city: "Dhaka", zone_id: zone.id }, deliveryZoneId: zone.id, deliveryFee: zone.fee, subtotal, total: subtotal + zone.fee, paymentMethod: "cod" }).returning();
    if (lines.length) await tx.insert(orderItems).values(lines.map((item) => ({ orderId: row.id, variantId: item.id, productName: "Frozen product", variantLabel: "50 ml", brandName: "Frozen brand", unitPrice: 100, quantity: item.quantity, lineTotal: item.quantity * 100 })));
    await tx.insert(orderEvents).values({ orderId: row.id, type: "system", toStatus: "pending", message: "Order placed.", actor: "system" });
    return row;
  });
}
async function stock(id: string) { return (await database.db.select().from(productVariants).where(eq(productVariants.id, id)))[0].stockQuantity; }
async function timeline(id: string) { return database.db.select().from(orderEvents).where(eq(orderEvents.orderId, id)); }
const actor = { actor: "fixture-admin" };

test("all 49 transition pairs match the specification", () => {
  const allowed: Record<OrderStatus, OrderStatus[]> = { pending: ["confirmed", "cancelled"], confirmed: ["packed", "cancelled"], packed: ["shipped", "cancelled"], shipped: ["delivered", "returned"], delivered: [], cancelled: [], returned: [] };
  for (const from of orderStatus.enumValues) for (const to of orderStatus.enumValues) {
    assert.equal(helpers.canTransition(from, to), allowed[from].includes(to));
    if (!allowed[from].includes(to)) assert.throws(() => helpers.assertTransition(from, to));
  }
});
test("order numbers use config prefix and a concurrent database sequence", async () => {
  const numbers = await Promise.all(Array.from({ length: 20 }, () => numbering.nextOrderNumber()));
  assert.equal(new Set(numbers).size, 20);
  const suffixes = numbers.map((value) => { assert.ok(value.startsWith(`${storeConfig.store.orderNumberPrefix}-`)); return Number(value.split("-").at(-1)); }).sort((a, b) => a - b);
  assert.equal(suffixes.at(-1)! - suffixes[0], 19);
});
test("confirmation is atomic and cannot decrement stock twice", async () => {
  const item = await variant();
  const order = await pending([{ id: item.id, quantity: 2 }, { id: item.id, quantity: 1 }]);
  const results = await Promise.allSettled([helpers.transitionOrder(order.id, "confirmed", actor), helpers.transitionOrder(order.id, "confirmed", actor)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stock(item.id), 7);
  assert.equal((await timeline(order.id)).length, 2);
  await assert.rejects(helpers.transitionOrder(order.id, "delivered", actor));
  assert.equal(await stock(item.id), 7);
});
test("two competing orders cannot oversell", async () => {
  const item = await variant(1);
  const a = await pending([{ id: item.id, quantity: 1 }]);
  const b = await pending([{ id: item.id, quantity: 1 }]);
  const results = await Promise.allSettled([helpers.transitionOrder(a.id, "confirmed", actor), helpers.transitionOrder(b.id, "confirmed", actor)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await stock(item.id), 0);
  assert.equal((await timeline(a.id)).length + (await timeline(b.id)).length, 3);
});
test("insufficient stock rolls back all changed lines, status and events", async () => {
  const one = await variant(10); const two = await variant(10);
  const [first, last] = [one, two].sort((a, b) => a.id.localeCompare(b.id));
  await database.db.update(productVariants).set({ stockQuantity: 0 }).where(eq(productVariants.id, last.id));
  const order = await pending([{ id: first.id, quantity: 2 }, { id: last.id, quantity: 1 }]);
  await assert.rejects(helpers.transitionOrder(order.id, "confirmed", actor), /Insufficient stock/);
  assert.equal(await stock(first.id), 10);
  assert.equal((await timeline(order.id)).length, 1);
  assert.equal((await database.db.select().from(orders).where(eq(orders.id, order.id)))[0].status, "pending");
});
test("cancellation restores stock only after confirmation; return restores once", async () => {
  for (const from of ["pending", "confirmed", "packed", "shipped"] as const) {
    const item = await variant(8); const order = await pending([{ id: item.id, quantity: 2 }]);
    if (from !== "pending") await helpers.transitionOrder(order.id, "confirmed", actor);
    if (from === "packed" || from === "shipped") await helpers.transitionOrder(order.id, "packed", actor);
    if (from === "shipped") await helpers.transitionOrder(order.id, "shipped", { ...actor, courierName: "Fixture Courier", trackingId: "DEMO-1" });
    const to = from === "shipped" ? "returned" : "cancelled";
    await helpers.transitionOrder(order.id, to, { ...actor, cancelledReason: "Customer declined" });
    assert.equal(await stock(item.id), 8);
    await assert.rejects(helpers.transitionOrder(order.id, to, { ...actor, cancelledReason: "Duplicate request" }));
    assert.equal(await stock(item.id), 8);
  }
});
test("delivery is terminal and deleted products leave order snapshots intact", async () => {
  const item = await variant(5); const order = await pending([{ id: item.id, quantity: 1 }]);
  await helpers.transitionOrder(order.id, "confirmed", actor);
  await helpers.transitionOrder(order.id, "packed", actor);
  await helpers.transitionOrder(order.id, "shipped", { ...actor, courierName: "Fixture Courier", trackingId: "DEMO-2" });
  await helpers.transitionOrder(order.id, "delivered", actor);
  await assert.rejects(helpers.transitionOrder(order.id, "returned", actor));
  assert.equal(await stock(item.id), 4);
  await database.db.delete(productVariants).where(eq(productVariants.id, item.id));
  const [snapshot] = await database.db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  assert.equal(snapshot.variantId, null); assert.equal(snapshot.productName, "Frozen product"); assert.equal(snapshot.lineTotal, 100);
  assert.equal((await timeline(order.id)).length, 5);
});
test("empty and deleted-variant orders cannot be confirmed", async () => {
  const empty = await pending([]);
  await assert.rejects(helpers.transitionOrder(empty.id, "confirmed", actor), /empty order/);
  const missing = await pending([{ id: null, quantity: 1 }]);
  await assert.rejects(helpers.transitionOrder(missing.id, "confirmed", actor), /deleted/);
});
