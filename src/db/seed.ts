import "./load-env";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, closeDb, type DbTransaction } from "@/db";
import { account, banners, brands, collections, coupons, customers, homepageSections, notes, orderEvents, orderItems, orders, productImages, productNotes, products, productVariants, reviews, settings, staticPages, user, type OrderStatus } from "./schema";
import { createId } from "@/lib/id";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/slug";
import { nextOrderNumber } from "@/lib/order-number";
import { transitionOrderInTransaction } from "@/lib/orders/transitions";
import { storeConfig } from "../../store.config";
import { demoBrands, demoMoney, demoNotes, demoProducts, demoSeedKey } from "./seed-data";

const hour = 60 * 60 * 1000;
const ago = (now: Date, hours: number) => new Date(now.getTime() - hours * hour);
const dates = (date: Date) => ({ createdAt: date, updatedAt: date });

async function seeded(tx: DbTransaction, key: string) {
  return (await tx.select({ key: settings.key }).from(settings).where(eq(settings.key, key))).length > 0;
}
async function markSeeded(tx: DbTransaction, key: string, now: Date) {
  await tx.insert(settings).values({ key, value: { version: 1, seededAt: now.toISOString() } }).onConflictDoNothing();
}

async function seedAdmin(tx: DbTransaction) {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const [existing] = await tx.select().from(user).where(eq(user.email, email));
  if (existing) return existing.id; // Never reset a password, role, or account edited by its owner.
  const id = createId();
  await tx.insert(user).values({ id, name: "Store Admin", email, emailVerified: true, role: "admin" });
  await tx.insert(account).values({
    id: createId(), userId: id, accountId: id, providerId: "credential",
    password: await hashPassword(env.ADMIN_PASSWORD),
  });
  return id;
}

async function seedCatalog(tx: DbTransaction, now: Date) {
  for (const [index, brand] of demoBrands.entries()) {
    const slug = slugify(brand.name);
    await tx.insert(brands).values({
      name: brand.name, slug, brandType: brand.brandType,
      logoUrl: `/seed/brand-${slug}.svg`, heroImageUrl: `/seed/brand-${slug}-hero.svg`,
      description: `${brand.name} is an invented ${brand.brandType} fragrance house in the ${storeConfig.store.name} demo catalog. Its collection explores familiar notes through imagined compositions.`,
      isFeatured: index % 2 === 0, sortOrder: index, ...dates(ago(now, 100 * 24)),
    }).onConflictDoNothing();
  }
  await tx.insert(notes).values(demoNotes).onConflictDoNothing();
  const brandRows = await tx.select().from(brands);
  const noteRows = await tx.select().from(notes);
  const brandIds = new Map(brandRows.map((brand) => [brand.slug, brand.id]));
  const noteIds = new Map(noteRows.map((note) => [note.slug, note.id]));

  for (const product of demoProducts) {
    const { index } = product;
    const createdAt = ago(now, index < 30 ? (90 - index) * 24 : (40 - index) * 24);
    const [inserted] = await tx.insert(products).values({
      name: product.name, slug: product.slug, brandId: brandIds.get(slugify(product.brand.name))!,
      collectionName: `${product.brand.name.split(" ")[0]} Studies`,
      description: `## ${product.name}\n\nAn imagined ${product.fragranceFamily.toLowerCase()} composition from ${product.brand.name}. A bright opening settles into a textured heart and a gentle, lasting base.\n\nThis fictional product demonstrates the catalog, notes pyramid and variant selector. Bottle artwork is an original generated placeholder, not a photograph of a commercial fragrance.`,
      gender: product.gender, concentration: product.concentration, packaging: product.packaging,
      fragranceFamily: product.fragranceFamily, perfumer: `${product.brand.name} Demo Studio`,
      launchYear: now.getUTCFullYear() - index % 4, countryOfOrigin: index >= 32 ? "Bangladesh" : "Fictional demo origin",
      groundShippingOnly: product.packaging === "gift_set", isFeatured: index % 3 === 0,
      meta: { demo: true }, ...dates(createdAt),
    }).onConflictDoNothing().returning();
    // A natural-key collision belongs to an existing catalog owner. Leave it intact.
    if (!inserted) continue;
    for (const [sizeIndex, sizeMl] of product.sizes.entries()) {
      const retailWhole = 1500 + index * 200 + sizeMl * 10;
      const saleWhole = index % 4 === 0 ? retailWhole : Number(BigInt(retailWhole) * BigInt(60 + index % 4 * 5) / 100n);
      await tx.insert(productVariants).values({
        productId: inserted.id, sku: `DEMO-${product.slug.toUpperCase()}-${sizeMl}`,
        sizeMl, sizeLabel: product.packaging === "gift_set" ? `3 × ${sizeMl / 3} ml set` : `${sizeMl} ml`,
        retailPrice: demoMoney(retailWhole), price: demoMoney(saleWhole), costPrice: demoMoney(Number(BigInt(saleWhole) * 55n / 100n)),
        stockQuantity: index === 38 ? 0 : index === 39 ? storeConfig.catalog.lowStockThreshold : 30 + storeConfig.catalog.lowStockThreshold + index % 8,
        lowStockOverride: index === 37 ? storeConfig.catalog.lowStockThreshold + 1 : null,
        isDefault: sizeIndex === 0, ...dates(createdAt),
      });
    }
    await tx.insert(productImages).values([
      { productId: inserted.id, url: product.imageUrl, alt: `${product.brand.name} ${product.name} illustrated demo bottle`, sortOrder: 0, ...dates(createdAt) },
      { productId: inserted.id, url: product.hoverImageUrl, alt: `${product.name} ${product.concentration.toUpperCase()} illustrated bottle detail`, sortOrder: 1, ...dates(createdAt) },
    ]);
    // Rotate over all sixty notes; each product has two notes at every position.
    for (const [positionIndex, position] of (["top", "heart", "base"] as const).entries()) {
      await tx.insert(productNotes).values([0, 1].map((offset) => ({
        productId: inserted.id, noteId: noteIds.get(demoNotes[(index * 3 + positionIndex * 17 + offset) % demoNotes.length].slug)!,
        position, ...dates(createdAt),
      })));
    }
  }
}

async function seedMerchandising(tx: DbTransaction, now: Date) {
  await tx.insert(collections).values([
    { name: "Men", slug: "men", description: "Fresh citrus, dry woods and aromatic discoveries.", filterJson: { gender: ["men"] }, sortOrder: 0, heroImageUrl: "/seed/men.svg" },
    { name: "Women", slug: "women", description: "Explore florals, soft musks and warm amber.", filterJson: { gender: ["women"] }, sortOrder: 1, heroImageUrl: "/seed/women.svg" },
    { name: "Niche", slug: "niche", description: "Unusual compositions from our fictional independent houses.", filterJson: { brandType: ["niche"] }, sortOrder: 2, heroImageUrl: "/seed/niche.svg" },
    { name: "Deals", slug: "deals", description: "Browse fragrances priced below their demo retail price.", filterJson: { deal: true, sort: "discount" }, sortOrder: 3, heroImageUrl: "/seed/deals.svg" },
  ]).onConflictDoNothing();
  const [niche] = await tx.select().from(collections).where(eq(collections.slug, "niche"));
  const freeDelivery = storeConfig.checkout.freeDeliveryOver;
  const deliveryCopy = freeDelivery === null
    ? storeConfig.checkout.deliveryZones.map((zone) => `${zone.label}: ${formatMoney(zone.fee)}`).join(" · ")
    : `Free delivery on orders of ${formatMoney(freeDelivery)} or more`;
  const bannerRows: typeof banners.$inferInsert[] = [
    { placement: "announcement", title: "Discover the fictional fragrance edit", href: "/products", sortOrder: 0 },
    { placement: "announcement", title: deliveryCopy, href: "/pages/delivery-returns", sortOrder: 1 },
    { placement: "hero", title: "Find your next fragrance", subtitle: "Explore fresh arrivals from our imagined fragrance houses.", imageUrl: "/editorial/fragrance-still-life.webp", href: "/products?sort=newest", ctaLabel: "Explore new arrivals", sortOrder: 0 },
    { placement: "hero", title: "Small bottles, rich notes", subtitle: "Discover perfume oils and attars.", imageUrl: "/seed/hero-oils.svg", href: "/products?concentration=oil&concentration=attar", ctaLabel: "Discover oils", sortOrder: 1 },
    { placement: "event_card", title: "Gift sets", subtitle: "Boxed and ready to give", imageUrl: "/seed/brand-sahmira-scents-hero.svg", href: "/products?packaging=gift_set", ctaLabel: "Shop gift sets", sortOrder: 0 },
    { placement: "event_card", title: "Minis & samples", subtitle: "Try a scent before the full bottle", imageUrl: "/seed/brand-elowen-stage-hero.svg", href: "/products?packaging=mini&packaging=sample", ctaLabel: "Shop small sizes", sortOrder: 1 },
    { placement: "promo_strip", title: "A conversation before every delivery", subtitle: storeConfig.checkout.confirmationNote, href: "/pages/delivery-returns", ctaLabel: "How ordering works", sortOrder: 0 },
  ];
  await tx.insert(banners).values(bannerRows.map((banner) => ({ ...banner, startsAt: ago(now, 24) })));
  // Homepage order: trust first, then browse paths, then merchandising.
  await tx.insert(homepageSections).values([
    { type: "hero", config: {}, sortOrder: 0 },
    { type: "value_props", title: "Why shop with us", config: { items: [
      { icon: "phone", title: "Confirmed by phone", description: "We call to confirm every order before it ships." },
      { icon: "truck", title: "Clear delivery fees", description: deliveryCopy },
      { icon: "shield-check", title: "Know what you buy", description: "Notes, concentration and size on every page." },
      { icon: "message-circle", title: "Help choosing", description: `Call ${storeConfig.contact.phone} for advice.` },
    ] }, sortOrder: 1 },
    { type: "category_tiles", title: "Shop by category", config: { tiles: ["men", "women", "niche", "deals"].map((slug, index) => ({ title: ["Men", "Women", "Niche", "Deals"][index], href: `/c/${slug}`, imageUrl: `/seed/${slug}.svg` })) }, sortOrder: 2 },
    { type: "product_carousel", title: "Today's deals", config: { source: "deals", limit: 8 }, sortOrder: 3 },
    { type: "event_cards", title: "Gifts & discovery", config: {}, sortOrder: 4 },
    { type: "brand_strip", title: "Fragrance houses", config: {}, sortOrder: 5 },
    { type: "product_carousel", title: "Trending now", config: { source: "featured", limit: 8 }, sortOrder: 6 },
    { type: "collection_banner", title: "A different direction", subtitle: "Discover our imagined niche houses.", config: { collectionId: niche.id, imageUrl: "/seed/niche.svg", href: "/c/niche", ctaLabel: "Explore niche" }, sortOrder: 7 },
    { type: "product_carousel", title: "New arrivals", config: { source: "new", limit: 8 }, sortOrder: 8 },
  ]);
  const zones = storeConfig.checkout.deliveryZones.map((zone) => `- ${zone.label}: ${formatMoney(zone.fee)}; estimated ${zone.etaDays}.`).join("\n");
  await tx.insert(staticPages).values([
    { slug: "about", title: "About us", body: `# About ${storeConfig.store.name}\n\n${storeConfig.store.tagline}\n\nThis is a demonstration perfume store. Every fragrance house and product in this catalog is fictional, and all bottle artwork is generated for the template.\n\nBrowse without creating an account. Our team confirms orders by phone.\n\nContact: ${storeConfig.contact.phone}${storeConfig.contact.email ? ` · ${storeConfig.contact.email}` : ""}.` },
    { slug: "delivery-returns", title: "Delivery & returns", body: `# Delivery & returns\n\n${storeConfig.checkout.confirmationNote}\n\n## Delivery zones\n\n${zones}\n\n${deliveryCopy}. Delivery estimates begin after confirmation.\n\n## Returns\n\nContact ${storeConfig.contact.phone} with your order number to discuss a delivery issue. This demo content must be replaced with the retailer's own return policy before accepting real orders.` },
    { slug: "authenticity", title: "Authenticity", body: "# Know what you are buying\n\nOur product pages show the brand, concentration, size, packaging and notes. Tester, sample, mini and gift-set packaging is labeled explicitly.\n\nThis template uses fictional merchandise and original placeholder artwork. A retailer must replace this page with its own sourcing and authenticity information before launch." },
    { slug: "privacy", title: "Privacy", body: `# Privacy\n\nThis demo checkout collects a name, phone number, delivery address and optional email to fulfill an order. Customers do not create login accounts.\n\nOrder tracking requires both the order number and phone number. Store staff use order notes and call history to manage delivery.\n\nContact ${storeConfig.contact.email ?? storeConfig.contact.phone} about information supplied to the store. Replace this illustrative page with the retailer's applicable privacy policy before launch.` },
  ]).onConflictDoNothing();
}

const demoPaths: OrderStatus[][] = [
  [], [], [], [], ["confirmed"], ["confirmed"],
  ["confirmed", "packed"], ["confirmed", "packed"],
  ["confirmed", "packed", "shipped"], ["confirmed", "packed", "shipped"],
  ["confirmed", "packed", "shipped", "delivered"], ["confirmed", "packed", "shipped", "delivered"],
  ["cancelled"], ["confirmed", "cancelled"], ["confirmed", "packed", "shipped", "returned"],
];

async function seedOrders(tx: DbTransaction, now: Date, adminId: string) {
  const enabledPayments = (["cod", "bkash", "nagad"] as const).filter((method) => storeConfig.checkout.paymentMethods[method].enabled);
  if (!enabledPayments.length) throw new Error("Demo orders require at least one enabled checkout payment method.");
  const demoCustomers: typeof customers.$inferSelect[] = [];
  for (let index = 0; index < 10; index++) {
    const phone = normalizePhone(`01700000${String(100 + index)}`);
    const zone = storeConfig.checkout.deliveryZones[index % storeConfig.checkout.deliveryZones.length];
    await tx.insert(customers).values({
      phone, name: `Demo Customer ${index + 1}`, email: `customer${index + 1}@example.com`,
      defaultAddress: { line1: `Demo House ${index + 1}, Example Road`, area: "Demo Area", city: "Dhaka", zone_id: zone.id },
      tags: index < 5 ? ["demo", "returning"] : ["demo"], internalNote: "Fictional fixture. Do not call or deliver.",
      ...dates(ago(now, 30 * 24)),
    }).onConflictDoNothing();
    const [customer] = await tx.select().from(customers).where(eq(customers.phone, phone));
    demoCustomers.push(customer);
  }
  for (const [index, path] of demoPaths.entries()) {
    const status = path.at(-1) ?? "pending";
    const age = { pending: (index + 1) * 2, confirmed: 26, packed: 40, shipped: 64, delivered: 144, cancelled: 40, returned: 240 }[status];
    const createdAt = ago(now, age + (index % 2));
    const at = (hours: number) => new Date(createdAt.getTime() + hours * hour);
    const customer = demoCustomers[index % demoCustomers.length];
    const zone = storeConfig.checkout.deliveryZones[index % storeConfig.checkout.deliveryZones.length];
    const method = enabledPayments[index % enabledPayments.length];
    const itemRows: typeof orderItems.$inferInsert[] = [];
    const orderId = createId();
    for (const offset of [0, 1]) {
      // Snapshot current catalog data, never fixture prices supplied as an order payload.
      const [item] = await tx.select({ product: products, variant: productVariants, brand: brands }).from(products)
        .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
        .innerJoin(brands, eq(brands.id, products.brandId)).where(eq(products.slug, demoProducts[index * 2 + offset].slug));
      if (!item) throw new Error("A demo order product needs a default variant.");
      const [image] = await tx.select().from(productImages).where(and(eq(productImages.productId, item.product.id), eq(productImages.sortOrder, 0)));
      const quantity = offset === 0 && index % 5 === 0 ? 2 : 1;
      itemRows.push({ orderId, variantId: item.variant.id, productName: item.product.name, brandName: item.brand.name,
        variantLabel: item.variant.sizeLabel ?? `${item.variant.sizeMl} ml`, imageUrl: image?.url,
        unitPrice: item.variant.price, quantity, lineTotal: item.variant.price * quantity, ...dates(createdAt) });
    }
    const subtotal = itemRows.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = storeConfig.checkout.freeDeliveryOver !== null && subtotal >= storeConfig.checkout.freeDeliveryOver ? 0 : zone.fee;
    await tx.insert(orders).values({
      id: orderId, orderNumber: await nextOrderNumber(tx), customerId: customer.id,
      customerName: customer.name, customerPhone: customer.phone, customerEmail: customer.email,
      shippingAddress: { ...customer.defaultAddress!, zone_id: zone.id }, deliveryZoneId: zone.id,
      deliveryFee, subtotal, total: subtotal + deliveryFee, paymentMethod: method,
      paymentTxnId: method === "cod" ? null : `DEMO-TRX-${String(index + 1).padStart(4, "0")}`,
      customerNote: index % 3 === 0 ? "Please call before delivery. This is a fictional demo order." : "Fictional demo order; do not fulfill.",
      ...dates(createdAt),
    });
    await tx.insert(orderItems).values(itemRows);
    await tx.insert(orderEvents).values([
      { orderId, type: "status_change", toStatus: "pending", actor: "system", message: "Order placed; awaiting phone confirmation.", ...dates(createdAt) },
      { orderId, type: "system", actor: "system", message: "Demo order received through the web checkout fixture. No notification was sent.", ...dates(at(0.01)) },
      { orderId, type: "note", actor: adminId, message: "Delivery address reviewed. Keep bottles upright and protect the parcel.", ...dates(at(0.15)) },
      { orderId, type: "call_logged", actor: adminId, message: status === "pending" ? "No answer on first call; follow up later." : index === 12 ? "Customer declined during the confirmation call." : "Spoke with customer; items and delivery address confirmed.", ...dates(at(0.5)) },
    ]);
    for (const [step, to] of path.entries()) {
      await transitionOrderInTransaction(tx, orderId, to, {
        actor: adminId, occurredAt: at([1, 18, 30, 100][step]),
        cancelledReason: to === "cancelled" ? index === 12 ? "Customer declined" : "Customer requested cancellation before dispatch" : undefined,
        courierName: to === "shipped" ? "Demo Parcel Service" : undefined,
        trackingId: to === "shipped" ? `DEMO-TRACK-${index + 1}` : undefined,
        paymentVerified: to === "confirmed" && method !== "cod" ? true : undefined,
        message: to === "returned" ? "Parcel returned unopened; stock restored after inspection." : undefined,
      });
    }
  }
}

async function seedOptionalFeatures(tx: DbTransaction, now: Date) {
  if (storeConfig.features.coupons && !(await seeded(tx, `${demoSeedKey}_coupons`))) {
    await tx.insert(coupons).values([
      { code: "DEMO10", type: "percent", value: 10, minSubtotal: demoMoney(2000), maxUses: 100, startsAt: ago(now, 24) },
      { code: "DEMO300", type: "fixed", value: demoMoney(300), minSubtotal: demoMoney(3000), maxUses: 50, startsAt: ago(now, 24) },
    ]).onConflictDoNothing();
    await markSeeded(tx, `${demoSeedKey}_coupons`, now);
  }
  if (storeConfig.features.reviews && !(await seeded(tx, `${demoSeedKey}_reviews`))) {
    const [delivered] = await tx.select({ productId: products.id, customerName: orders.customerName, customerPhone: orders.customerPhone })
      .from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(orders.status, "delivered")).limit(1);
    if (delivered) {
      await tx.insert(reviews).values([
        { ...delivered, rating: 5, title: "A thoughtful everyday scent", body: "Fictional demo review: the opening is bright and the drydown feels soft. The package arrived safely.", status: "approved", verifiedPurchase: true },
        { productId: delivered.productId, customerName: "Demo Reviewer", rating: 4, title: "Soft and easy to wear", body: "Fictional demo review awaiting moderation.", status: "pending", verifiedPurchase: false },
        { productId: delivered.productId, customerName: "Demo Review Example", rating: 2, body: "Fictional off-topic review illustrating the rejected moderation state.", status: "rejected", verifiedPurchase: false },
      ]);
    }
    await markSeeded(tx, `${demoSeedKey}_reviews`, now);
  }
  // Phase 5 demo depth: rating spreads, verified badges and a non-live coupon.
  // Separate markers so stores seeded before these fixtures existed get them once.
  if (storeConfig.features.coupons && !(await seeded(tx, `${demoSeedKey}_coupons_v2`))) {
    await tx.insert(coupons).values([
      { code: "DEMOEXPIRED", type: "percent", value: 15, maxUses: 20, usedCount: 7, startsAt: ago(now, 60 * 24), endsAt: ago(now, 30 * 24) },
    ]).onConflictDoNothing();
    await markSeeded(tx, `${demoSeedKey}_coupons_v2`, now);
  }
  if (storeConfig.features.reviews && !(await seeded(tx, `${demoSeedKey}_reviews_v2`))) {
    const delivered = await tx.selectDistinctOn([products.id], { productId: products.id, customerName: orders.customerName, customerPhone: orders.customerPhone, slug: products.slug })
      .from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(orders.status, "delivered")).orderBy(products.id);
    const [first, ...others] = delivered.sort((a, b) => a.slug.localeCompare(b.slug));
    const body = (text: string) => `Fictional demo review: ${text}`;
    const rows: typeof reviews.$inferInsert[] = [];
    // The product already carrying the v1 approved review gets a full spread.
    const [v1] = await tx.select({ productId: reviews.productId }).from(reviews).where(eq(reviews.status, "approved")).limit(1);
    const spreadProduct = v1?.productId ?? first?.productId;
    if (spreadProduct) {
      rows.push(
        { productId: spreadProduct, customerName: "Demo Shopper Nadia", rating: 5, title: "My signature now", body: body("lasts through a full office day and gets compliments by lunch."), status: "approved", ...dates(ago(now, 20 * 24)) },
        { productId: spreadProduct, customerName: "Demo Shopper Arif", rating: 4, title: "Great, a little sweet", body: body("the opening is lovely. The drydown leans sweeter than I expected."), status: "approved", ...dates(ago(now, 14 * 24)) },
        { productId: spreadProduct, customerName: "Demo Shopper Tania", rating: 4, body: body("good projection for the first two hours, then stays close to the skin."), status: "approved", ...dates(ago(now, 9 * 24)) },
        { productId: spreadProduct, customerName: "Demo Shopper Rafi", rating: 3, title: "Nice but not for summer", body: body("pleasant, but too heavy for hot afternoons. Better in the evening."), status: "approved", ...dates(ago(now, 4 * 24)) },
      );
    }
    // Verified purchases: the delivered customers review what they bought.
    for (const [i, row] of [first, ...others].filter(Boolean).entries()) {
      if (row.productId === spreadProduct) continue;
      rows.push({ productId: row.productId, customerName: row.customerName, customerPhone: row.customerPhone, rating: i % 2 ? 4 : 5, title: i % 2 ? "Well packed, smells as described" : "Exactly as expected", body: body("delivery was quick and the bottle arrived sealed."), status: "approved", verifiedPurchase: true, ...dates(ago(now, 3 * 24 + i)) });
    }
    rows.push({ productId: spreadProduct ?? first.productId, customerName: "Demo Visitor", rating: 1, title: "Arrived late", body: body("waiting for moderation. Illustrates a low rating in the queue."), status: "pending", ...dates(ago(now, 5)) });
    if (rows.length) await tx.insert(reviews).values(rows);
    await markSeeded(tx, `${demoSeedKey}_reviews_v2`, now);
  }
}

async function main() {
  // Any real Postgres may be reachable from the internet; never create a guessable admin there.
  if ((env.DATABASE_URL || env.NODE_ENV === "production") && (env.ADMIN_EMAIL === "admin@example.com" || env.ADMIN_PASSWORD === "admin1234")) {
    console.error("Refusing to seed: ADMIN_EMAIL and ADMIN_PASSWORD are still the demo defaults. Set both (see .env.example) and run `pnpm db:seed` again.");
    process.exitCode = 1;
    return;
  }
  // `pnpm db:seed --admin-only` (or SEED_DEMO_DATA=false): a real store's first
  // run, without the demo catalog, customers or orders.
  if (process.argv.includes("--admin-only") || process.env.SEED_DEMO_DATA === "false") {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(727017, 1)`);
      await seedAdmin(tx);
    });
    console.log(`Admin account ${env.ADMIN_EMAIL.toLowerCase()} is ready. No demo data was added.`);
    return;
  }
  const result = await db.transaction(async (tx) => {
    // Serialize seed runs across Postgres clients. The marker and fixtures commit together.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(727017, 1)`);
    const adminId = await seedAdmin(tx);
    const alreadySeeded = await seeded(tx, demoSeedKey);
    const now = new Date();
    if (!alreadySeeded) {
      await seedCatalog(tx, now);
      await seedMerchandising(tx, now);
      await seedOrders(tx, now, adminId);
      await markSeeded(tx, demoSeedKey, now);
    }
    await seedOptionalFeatures(tx, now);
    return alreadySeeded;
  });
  console.log(result ? "Demo seed already applied; catalog edits, stock, orders, timelines, and admin credentials preserved." : "Seeded 10 fictional brands, 60 notes, 40 products, 80 variants, 80 images, 4 collections, 7 banners, 9 homepage sections, 4 pages, 10 customers, and 15 orders.");
  console.log(`Optional fixtures: coupons ${storeConfig.features.coupons ? "enabled (3)" : "disabled"}; reviews ${storeConfig.features.reviews ? "enabled" : "disabled"}. Admin account checked without resetting existing credentials.`);
}

main().catch((error) => { console.error("Seed failed:", error); process.exitCode = 1; }).finally(closeDb);
