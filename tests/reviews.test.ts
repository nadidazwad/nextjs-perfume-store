import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { brands, customers, orderItems, orders, products, productVariants, reviews } from "../src/db/schema";
import { reviewInputSchema, summarizeRatings } from "../src/lib/reviews/schema";

test("rating summary: average to one decimal and 5→1 distribution", () => {
  const empty = summarizeRatings({});
  assert.equal(empty.count, 0);
  assert.equal(empty.average, 0);
  assert.deepEqual(empty.distribution.map((d) => d.stars), [5, 4, 3, 2, 1]);
  assert(empty.distribution.every((d) => d.percent === 0));
  const s = summarizeRatings({ 5: 2, 4: 2, 3: 1 });
  assert.equal(s.count, 5);
  assert.equal(s.average, 4.2);
  assert.deepEqual(s.distribution.map((d) => [d.stars, d.count, d.percent]), [[5, 2, 40], [4, 2, 40], [3, 1, 20], [2, 0, 0], [1, 0, 0]]);
  assert.equal(summarizeRatings({ 5: 1, 4: 2 }).average, 4.3);
});

test("review input: required fields, phone normalization, lengths", () => {
  const base = { productId: "p", name: " Mitu ", phone: "", rating: "5", title: "", body: "Lovely and long lasting." };
  const ok = reviewInputSchema.parse(base);
  assert.equal(ok.name, "Mitu");
  assert.equal(ok.phone, null);
  assert.equal(ok.title, null);
  assert.equal(ok.rating, 5);
  assert.equal(reviewInputSchema.parse({ ...base, phone: "01712 345-678" }).phone, "+8801712345678");
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { name: "" }, { body: "short" }, { body: "x".repeat(2001) }, { phone: "12345" }, { title: "x".repeat(121) }])
    assert.equal(reviewInputSchema.safeParse({ ...base, ...patch }).success, false, JSON.stringify(patch));
});

let database: typeof import("../src/db");
let server: typeof import("../src/lib/reviews/server");
const project = process.cwd();
let temporary: string;
before(async () => {
  temporary = mkdtempSync(join(tmpdir(), "attar-reviews-"));
  process.chdir(temporary);
  delete process.env.DATABASE_URL;
  Object.assign(process.env, { NODE_ENV: "test" });
  database = await import("../src/db");
  server = await import("../src/lib/reviews/server");
  await migrate(database.db, { migrationsFolder: join(project, "src/db/migrations") });
  const db = database.db;
  await db.insert(brands).values({ id: "b", name: "Review House", slug: "review-house", brandType: "niche" });
  await db.insert(products).values([
    { id: "bought", name: "Bought", slug: "bought", brandId: "b", gender: "men", concentration: "edp" },
    { id: "other", name: "Other", slug: "other", brandId: "b", gender: "men", concentration: "edp" },
  ]);
  await db.insert(productVariants).values([
    { id: "bought-50", productId: "bought", sku: "B-50", sizeMl: 50, price: 1000, retailPrice: 1000 },
    { id: "bought-100", productId: "bought", sku: "B-100", sizeMl: 100, price: 1800, retailPrice: 1800 },
    { id: "other-50", productId: "other", sku: "O-50", sizeMl: 50, price: 900, retailPrice: 900 },
  ]);
  await db.insert(customers).values([
    { id: "c1", phone: "+8801711111111", name: "Delivered Buyer" },
    { id: "c2", phone: "+8801722222222", name: "Pending Buyer" },
  ]);
  const address = { line1: "x", area: "y", city: "Dhaka", zone_id: "inside-dhaka" };
  const base = { deliveryZoneId: "inside-dhaka", deliveryFee: 0, paymentMethod: "cod" as const, shippingAddress: address };
  await db.insert(orders).values([
    { id: "o1", orderNumber: "T-1", customerId: "c1", customerName: "Delivered Buyer", customerPhone: "+8801711111111", status: "delivered", subtotal: 1800, total: 1800, ...base },
    { id: "o2", orderNumber: "T-2", customerId: "c2", customerName: "Pending Buyer", customerPhone: "+8801722222222", status: "shipped", subtotal: 1000, total: 1000, ...base },
  ]);
  await db.insert(orderItems).values([
    // Bought in a different size than the one reviewed: still verified, it's the same product.
    { orderId: "o1", variantId: "bought-100", productName: "Bought", variantLabel: "100 ml", brandName: "Review House", unitPrice: 1800, quantity: 1, lineTotal: 1800 },
    { orderId: "o2", variantId: "bought-50", productName: "Bought", variantLabel: "50 ml", brandName: "Review House", unitPrice: 1000, quantity: 1, lineTotal: 1000 },
  ]);
});
after(async () => {
  await database?.closeDb();
  process.chdir(project);
  if (temporary) rmSync(temporary, { recursive: true, force: true });
});

test("verified purchase = phone has a DELIVERED order containing any size of the product", async () => {
  assert.equal(await server.hasDeliveredPurchase("+8801711111111", "bought"), true);
  assert.equal(await server.hasDeliveredPurchase("+8801711111111", "other"), false, "different product");
  assert.equal(await server.hasDeliveredPurchase("+8801722222222", "bought"), false, "shipped is not delivered");
  assert.equal(await server.hasDeliveredPurchase("+8801799999999", "bought"), false, "unknown phone");
  assert.equal(await server.hasDeliveredPurchase(null, "bought"), false, "no phone, never verified");
});

test("storefront shows only approved reviews, with a matching summary", async () => {
  await database.db.insert(reviews).values([
    { productId: "bought", customerName: "A", rating: 5, body: "Approved five", status: "approved", verifiedPurchase: true },
    { productId: "bought", customerName: "B", rating: 3, body: "Approved three", status: "approved" },
    { productId: "bought", customerName: "C", rating: 1, body: "Still pending", status: "pending" },
    { productId: "bought", customerName: "D", rating: 1, body: "Rejected one", status: "rejected" },
  ]);
  const data = await server.getProductReviews("bought");
  assert(data);
  assert.equal(data.summary.count, 2);
  assert.equal(data.summary.average, 4);
  assert.deepEqual(data.reviews.map((r) => r.name).sort(), ["A", "B"]);
  assert.equal(data.hasMore, false);
  const ratings = await server.getRatingsFor(["bought", "other"]);
  assert.deepEqual(ratings.get("bought"), { average: 4, count: 2 });
  assert.equal(ratings.has("other"), false);
});
