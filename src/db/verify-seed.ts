/** Fresh-seed acceptance check: node --import tsx src/db/verify-seed.ts [--fingerprint] */
import "./load-env";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { db, closeDb } from "@/db";
import { env } from "@/lib/env";
import { canTransition } from "@/lib/orders/transitions";
import { storeConfig } from "../../store.config";
import { demoProducts } from "./seed-data";
import { account, banners, brands, collections, coupons, customers, homepageSections, notes, orderEvents, orderItems, orders, productImages, productNotes, products, productVariants, reviews, session, settings, staticPages, user, verification, type OrderStatus } from "./schema";

async function main() {
  // Include auth rows and runtime markers in the fingerprint, not just table counts.
  const tables = { brands, collections, notes, products, productNotes, productVariants, productImages, customers, orders, orderItems, orderEvents, banners, homepageSections, staticPages, settings, coupons, reviews, user, session, account, verification };
  const snapshot: Record<string, unknown> = {};
  for (const [name, table] of Object.entries(tables)) {
    // Keep disabled optional features completely out of query execution.
    if (name === "coupons" && !storeConfig.features.coupons || name === "reviews" && !storeConfig.features.reviews) continue;
    const rows = await db.select().from(table);
    snapshot[name] = rows.map((row) => JSON.stringify(row)).sort();
  }
  snapshot.orderNumberSequence = await db.select({ lastValue: sql<string>`last_value::text`, isCalled: sql<boolean>`is_called` }).from(sql`order_number_seq`);
  const fingerprint = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  if (process.argv.includes("--fingerprint")) {
    console.log(fingerprint);
    return;
  }

  const brandRows = await db.select().from(brands);
  const noteRows = await db.select().from(notes);
  const productRows = await db.select().from(products);
  const variantRows = await db.select().from(productVariants);
  const imageRows = await db.select().from(productImages);
  const productNoteRows = await db.select().from(productNotes);
  const collectionRows = await db.select().from(collections);
  const bannerRows = await db.select().from(banners);
  const sectionRows = await db.select().from(homepageSections);
  const pageRows = await db.select().from(staticPages);
  const orderRows = await db.select().from(orders);
  const itemRows = await db.select().from(orderItems);
  const eventRows = await db.select().from(orderEvents);
  const userRows = await db.select().from(user);
  const accountRows = await db.select().from(account);
  const counts = { brands: brandRows.length, notes: noteRows.length, products: productRows.length, variants: variantRows.length, images: imageRows.length, productNotes: productNoteRows.length, collections: collectionRows.length, banners: bannerRows.length, homepageSections: sectionRows.length, pages: pageRows.length, orders: orderRows.length, orderItems: itemRows.length, orderEvents: eventRows.length };
  assert.deepEqual(counts, { brands: 10, notes: 60, products: 40, variants: 80, images: 80, productNotes: 240, collections: 4, banners: 7, homepageSections: 9, pages: 4, orders: 15, orderItems: 30, orderEvents: 87 });
  assert.equal(new Set(brandRows.map((row) => row.brandType)).size, 5);
  assert.equal(new Set(noteRows.map((row) => row.group)).size, 10);
  assert.equal(new Set(productRows.map((row) => row.gender)).size, 3);
  assert.equal(new Set(productRows.map((row) => row.concentration)).size, 7);
  assert.equal(new Set(productRows.map((row) => row.packaging)).size, 5);
  assert.equal(new Set(bannerRows.map((row) => row.placement)).size, 4);
  assert.equal(new Set(sectionRows.map((row) => row.type)).size, 7);
  assert.deepEqual(collectionRows.map((row) => row.slug).sort(), ["deals", "men", "niche", "women"]);
  assert.deepEqual(pageRows.map((row) => row.slug).sort(), ["about", "authenticity", "delivery-returns", "privacy"]);

  const imageUrls = new Set<string>();
  for (const product of productRows) {
    const variants = variantRows.filter((row) => row.productId === product.id);
    assert.equal(variants.length, 2, `${product.slug} needs both size variants`);
    assert.equal(variants.filter((row) => row.isDefault).length, 1);
    assert.deepEqual(imageRows.filter((row) => row.productId === product.id).map((row) => row.sortOrder).sort(), [0, 1]);
    assert.equal(new Set(productNoteRows.filter((row) => row.productId === product.id).map((row) => row.position)).size, 3);
  }
  for (const row of imageRows) { assert(row.alt.trim()); imageUrls.add(row.url); }
  for (const row of [...brandRows, ...collectionRows]) if (row.heroImageUrl) imageUrls.add(row.heroImageUrl);
  for (const row of brandRows) if (row.logoUrl) imageUrls.add(row.logoUrl);
  for (const row of bannerRows) if (row.imageUrl) imageUrls.add(row.imageUrl);
  for (const url of imageUrls) {
    // Only bundled, fictional artwork: generated SVG fixtures or the generated editorial photos.
    assert((url.startsWith("/seed/") && url.endsWith(".svg")) || url.startsWith("/editorial/"), url);
    await access(join(process.cwd(), "public", url));
  }

  const statusCounts: Partial<Record<OrderStatus, number>> = {};
  const retainedStock = new Map<string, number>();
  for (const order of orderRows) {
    statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
    assert(order.orderNumber.startsWith(`${storeConfig.store.orderNumberPrefix}-`));
    assert(storeConfig.checkout.paymentMethods[order.paymentMethod].enabled);
    assert(storeConfig.checkout.deliveryZones.some((zone) => zone.id === order.deliveryZoneId));
    const items = itemRows.filter((row) => row.orderId === order.id);
    assert.equal(items.reduce((sum, row) => sum + row.lineTotal, 0), order.subtotal);
    assert.equal(order.total, order.subtotal + order.deliveryFee - order.discount);
    for (const item of items) {
      assert.equal(item.lineTotal, item.unitPrice * item.quantity);
      if (["confirmed", "packed", "shipped", "delivered"].includes(order.status) && item.variantId) {
        retainedStock.set(item.variantId, (retainedStock.get(item.variantId) ?? 0) + item.quantity);
      }
    }
    const events = eventRows.filter((row) => row.orderId === order.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    assert.deepEqual([...new Set(events.map((row) => row.type))].sort(), ["call_logged", "note", "status_change", "system"]);
    assert(events.every((event) => event.createdAt >= order.createdAt && event.createdAt <= new Date()));
    const transitions = events.filter((event) => event.type === "status_change");
    assert.equal(transitions[0].fromStatus, null);
    assert.equal(transitions[0].toStatus, "pending");
    let current: OrderStatus = "pending";
    for (const event of transitions.slice(1)) {
      assert.equal(event.fromStatus, current);
      assert(event.toStatus && canTransition(current, event.toStatus));
      current = event.toStatus;
    }
    assert.equal(current, order.status);
    if (order.status === "cancelled") assert(order.cancelledReason);
    if (["shipped", "delivered", "returned"].includes(order.status)) assert(order.courierName && order.trackingId);
  }
  assert.deepEqual(statusCounts, { pending: 4, confirmed: 2, packed: 2, shipped: 2, delivered: 2, cancelled: 2, returned: 1 });
  for (const variant of variantRows) {
    assert(Number.isSafeInteger(variant.price) && Number.isSafeInteger(variant.retailPrice));
    assert(variant.price >= 0 && variant.price <= variant.retailPrice);
    const product = productRows.find((row) => row.id === variant.productId)!;
    const fixture = demoProducts.find((row) => row.slug === product.slug)!;
    const initial = fixture.index === 38 ? 0 : fixture.index === 39 ? storeConfig.catalog.lowStockThreshold : 30 + storeConfig.catalog.lowStockThreshold + fixture.index % 8;
    assert.equal(variant.stockQuantity, initial - (retainedStock.get(variant.id) ?? 0), `Stock mismatch for ${variant.sku}`);
  }

  const admin = userRows.find((row) => row.email === env.ADMIN_EMAIL.toLowerCase());
  assert(admin && admin.role === "admin");
  const credential = accountRows.find((row) => row.userId === admin.id && row.providerId === "credential");
  assert(credential?.password && credential.accountId === admin.id);
  assert(await verifyPassword({ hash: credential.password, password: env.ADMIN_PASSWORD }), "Better Auth must accept the seeded password");
  if (storeConfig.features.coupons) {
    const couponRows = await db.select().from(coupons);
    assert.deepEqual(couponRows.map((row) => row.code).sort(), ["DEMO10", "DEMO300", "DEMOEXPIRED"]);
    for (const coupon of couponRows) assert(coupon.maxUses === null || coupon.usedCount <= coupon.maxUses);
  }
  if (storeConfig.features.reviews) {
    const reviewRows = await db.select().from(reviews);
    // v1: approved + pending + rejected; v2: 4-review spread, one verified review per other delivered product, one pending.
    const deliveredProducts = new Set(orderRows.filter((order) => order.status === "delivered").flatMap((order) => itemRows.filter((item) => item.orderId === order.id).map((item) => variantRows.find((variant) => variant.id === item.variantId)?.productId)));
    assert.equal(reviewRows.length, 3 + 4 + (deliveredProducts.size - 1) + 1);
    assert.equal(new Set(reviewRows.map((row) => row.status)).size, 3);
    assert.equal(reviewRows.filter((row) => row.status === "pending").length, 2);
    assert(reviewRows.filter((row) => row.verifiedPurchase).length >= 2);
    for (const review of reviewRows) assert(review.rating >= 1 && review.rating <= 5 && review.body.startsWith("Fictional"));
    for (const review of reviewRows.filter((row) => row.verifiedPurchase)) {
      assert(orderRows.some((order) => order.status === "delivered" && order.customerPhone === review.customerPhone && itemRows.some((item) => item.orderId === order.id && variantRows.some((variant) => variant.id === item.variantId && variant.productId === review.productId))));
    }
  }
  console.log(JSON.stringify({ counts, statuses: statusCounts, localSvgFiles: imageUrls.size, adminPasswordCompatible: true, stockAndTimelinesValid: true, fingerprint }, null, 2));
}

main().catch((error) => { console.error("Seed verification failed:", error); process.exitCode = 1; }).finally(closeDb);
