import { relations, sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgEnum, pgSequence, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "../lib/id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const brandType = pgEnum("brand_type", ["designer", "niche", "arabian", "celebrity", "local"]);
export const noteGroup = pgEnum("note_group", ["citrus", "floral", "woody", "oriental", "fresh", "spicy", "sweet", "musky", "green", "aquatic"]);
export const gender = pgEnum("gender", ["men", "women", "unisex"]);
export const concentration = pgEnum("concentration", ["edt", "edp", "parfum", "extrait", "edc", "oil", "attar"]);
export const packaging = pgEnum("packaging", ["standard", "tester", "sample", "mini", "gift_set"]);
export const notePosition = pgEnum("note_position", ["top", "heart", "base"]);
export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"]);
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export const paymentMethod = pgEnum("payment_method", ["cod", "bkash", "nagad"]);
export const orderSource = pgEnum("order_source", ["web"]);
export const orderEventType = pgEnum("order_event_type", ["status_change", "note", "call_logged", "system"]);
export const bannerPlacement = pgEnum("banner_placement", ["announcement", "hero", "event_card", "promo_strip"]);
export const homepageSectionType = pgEnum("homepage_section_type", ["hero", "category_tiles", "event_cards", "product_carousel", "brand_strip", "value_props", "collection_banner"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed"]);
export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const orderNumberSequence = pgSequence("order_number_seq", { startWith: 1001, increment: 1 });

/** Saved URL filter values. Phase 2 validates these in the shared catalog query layer. */
export type CatalogFilters = {
  brand?: string[]; brandType?: (typeof brandType.enumValues)[number][];
  gender?: (typeof gender.enumValues)[number][]; concentration?: (typeof concentration.enumValues)[number][];
  packaging?: (typeof packaging.enumValues)[number][]; family?: string[]; note?: string[];
  size?: ("under-50" | "50-99" | "100-plus")[]; minPrice?: number; maxPrice?: number;
  inStock?: boolean; deal?: boolean; q?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "discount" | "name";
};
export type ShippingAddress = { line1: string; line2?: string; area: string; city: string; zone_id: string };
export type HomepageSectionConfig = {
  source?: "featured" | "new" | "deals" | "collection"; collectionId?: string; limit?: number;
  tiles?: { title: string; href: string; imageUrl: string }[];
  items?: { icon: string; title: string; description: string }[];
  imageUrl?: string; href?: string; ctaLabel?: string;
};

export const brands = pgTable("brands", {
  id: id(), name: text("name").notNull(), slug: text("slug").notNull().unique(),
  brandType: brandType("brand_type").notNull(), logoUrl: text("logo_url"), heroImageUrl: text("hero_image_url"),
  description: text("description"), isFeatured: boolean("is_featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0), ...timestamps(),
}, (t) => [index("brands_type_idx").on(t.brandType)]);

export const collections = pgTable("collections", {
  id: id(), name: text("name").notNull(), slug: text("slug").notNull().unique(), description: text("description"),
  heroImageUrl: text("hero_image_url"), filterJson: jsonb("filter_json").$type<CatalogFilters>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
});
export const notes = pgTable("notes", {
  id: id(), name: text("name").notNull().unique(), slug: text("slug").notNull().unique(), group: noteGroup("group").notNull(), ...timestamps(),
}, (t) => [index("notes_group_idx").on(t.group)]);
export const products = pgTable("products", {
  id: id(), name: text("name").notNull(), slug: text("slug").notNull().unique(),
  brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "restrict" }),
  collectionName: text("collection_name"), description: text("description").notNull().default(""),
  gender: gender("gender").notNull(), concentration: concentration("concentration").notNull(),
  packaging: packaging("packaging").notNull().default("standard"), fragranceFamily: text("fragrance_family"),
  perfumer: text("perfumer"), launchYear: integer("launch_year"), countryOfOrigin: text("country_of_origin"),
  groundShippingOnly: boolean("ground_shipping_only").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false), isActive: boolean("is_active").notNull().default(true),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}), ...timestamps(),
}, (t) => [
  index("products_brand_idx").on(t.brandId), index("products_gender_idx").on(t.gender),
  index("products_concentration_idx").on(t.concentration), index("products_packaging_idx").on(t.packaging),
  index("products_family_idx").on(t.fragranceFamily), index("products_active_created_idx").on(t.isActive, t.createdAt),
  index("products_featured_idx").on(t.isFeatured),
  index("products_name_gin_idx").using("gin", sql`to_tsvector('simple', ${t.name})`),
]);
export const productNotes = pgTable("product_notes", {
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  noteId: text("note_id").notNull().references(() => notes.id, { onDelete: "restrict" }),
  position: notePosition("position").notNull(), ...timestamps(),
}, (t) => [primaryKey({ columns: [t.productId, t.noteId, t.position] }), index("product_notes_note_idx").on(t.noteId, t.productId)]);
export const productVariants = pgTable("product_variants", {
  id: id(), productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(), sizeMl: integer("size_ml").notNull(), sizeLabel: text("size_label"),
  retailPrice: integer("retail_price").notNull(), price: integer("price").notNull(), costPrice: integer("cost_price"),
  stockQuantity: integer("stock_quantity").notNull().default(0), lowStockOverride: integer("low_stock_override"), barcode: text("barcode"),
  isDefault: boolean("is_default").notNull().default(false), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [
  index("variants_product_idx").on(t.productId), index("variants_price_idx").on(t.price), index("variants_size_idx").on(t.sizeMl),
  index("variants_stock_idx").on(t.stockQuantity),
  uniqueIndex("variants_one_default_idx").on(t.productId).where(sql`${t.isDefault} = true`),
  check("variants_price_check", sql`${t.price} >= 0 AND ${t.price} <= ${t.retailPrice}`),
  check("variants_cost_check", sql`${t.costPrice} IS NULL OR ${t.costPrice} >= 0`),
  check("variants_stock_check", sql`${t.stockQuantity} >= 0`), check("variants_size_check", sql`${t.sizeMl} > 0`),
  check("variants_low_stock_check", sql`${t.lowStockOverride} IS NULL OR ${t.lowStockOverride} >= 0`),
]);
export const productImages = pgTable("product_images", {
  id: id(), productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(), alt: text("alt").notNull(), sortOrder: integer("sort_order").notNull().default(0), ...timestamps(),
}, (t) => [index("product_images_order_idx").on(t.productId, t.sortOrder)]);
export const customers = pgTable("customers", {
  id: id(), phone: text("phone").notNull().unique(), name: text("name").notNull(), email: text("email"),
  defaultAddress: jsonb("default_address").$type<ShippingAddress>(), tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  internalNote: text("internal_note"), isBlocked: boolean("is_blocked").notNull().default(false), ...timestamps(),
}, (t) => [check("customers_phone_e164_check", sql`${t.phone} ~ '^[+][1-9][0-9]{7,14}$'`)]);
export const orders = pgTable("orders", {
  id: id(), orderNumber: text("order_number").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  status: orderStatus("status").notNull().default("pending"),
  customerName: text("customer_name").notNull(), customerPhone: text("customer_phone").notNull(), customerEmail: text("customer_email"),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(), deliveryZoneId: text("delivery_zone_id").notNull(),
  deliveryFee: integer("delivery_fee").notNull(), subtotal: integer("subtotal").notNull(), discount: integer("discount").notNull().default(0), total: integer("total").notNull(),
  paymentMethod: paymentMethod("payment_method").notNull(), paymentTxnId: text("payment_txn_id"), paymentVerified: boolean("payment_verified").notNull().default(false),
  couponCode: text("coupon_code"), customerNote: text("customer_note"), courierName: text("courier_name"), trackingId: text("tracking_id"),
  cancelledReason: text("cancelled_reason"), source: orderSource("source").notNull().default("web"), ...timestamps(),
}, (t) => [
  index("orders_customer_idx").on(t.customerId), index("orders_status_created_idx").on(t.status, t.createdAt),
  index("orders_created_idx").on(t.createdAt), index("orders_phone_idx").on(t.customerPhone), index("orders_payment_idx").on(t.paymentMethod),
  check("orders_amounts_check", sql`${t.subtotal} >= 0 AND ${t.deliveryFee} >= 0 AND ${t.discount} >= 0 AND ${t.discount} <= ${t.subtotal} + ${t.deliveryFee} AND ${t.total} = ${t.subtotal} + ${t.deliveryFee} - ${t.discount}`),
]);
export const orderItems = pgTable("order_items", {
  id: id(), orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: text("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(), variantLabel: text("variant_label").notNull(), brandName: text("brand_name").notNull(), imageUrl: text("image_url"),
  unitPrice: integer("unit_price").notNull(), quantity: integer("quantity").notNull(), lineTotal: integer("line_total").notNull(), ...timestamps(),
}, (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_variant_idx").on(t.variantId),
  check("order_items_amounts_check", sql`${t.unitPrice} >= 0 AND ${t.quantity} > 0 AND ${t.lineTotal} = ${t.unitPrice}::bigint * ${t.quantity}`)]);
export const orderEvents = pgTable("order_events", {
  id: id(), orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }), type: orderEventType("type").notNull(),
  fromStatus: orderStatus("from_status"), toStatus: orderStatus("to_status"), message: text("message"),
  // Deliberately not an FK: 'system' and historical/deleted admin IDs remain valid.
  actor: text("actor").notNull().default("system"), ...timestamps(),
}, (t) => [index("order_events_timeline_idx").on(t.orderId, t.createdAt), index("order_events_created_idx").on(t.createdAt)]);
export const banners = pgTable("banners", {
  id: id(), placement: bannerPlacement("placement").notNull(), title: text("title"), subtitle: text("subtitle"), imageUrl: text("image_url"), href: text("href"), ctaLabel: text("cta_label"),
  sortOrder: integer("sort_order").notNull().default(0), isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }), ...timestamps(),
}, (t) => [index("banners_placement_idx").on(t.placement, t.isActive, t.sortOrder), check("banners_window_check", sql`${t.endsAt} IS NULL OR ${t.startsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`)]);
export const homepageSections = pgTable("homepage_sections", {
  id: id(), type: homepageSectionType("type").notNull(), title: text("title"), subtitle: text("subtitle"),
  config: jsonb("config").$type<HomepageSectionConfig>().notNull().default({}), sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [index("homepage_sections_order_idx").on(t.isActive, t.sortOrder)]);
export const staticPages = pgTable("static_pages", {
  id: id(), slug: text("slug").notNull().unique(), title: text("title").notNull(), body: text("body").notNull(), isActive: boolean("is_active").notNull().default(true), ...timestamps(),
});
/** Fixed-window request counters shared across serverless instances. Keys are SHA-256 hashes, never raw IPs or phones. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("rate_limits_expires_idx").on(t.expiresAt)]);
export const settings = pgTable("settings", { key: text("key").primaryKey(), value: jsonb("value").$type<unknown>().notNull(), ...timestamps() });
export const coupons = pgTable("coupons", {
  id: id(), code: text("code").notNull().unique(), type: couponType("type").notNull(), value: integer("value").notNull(),
  minSubtotal: integer("min_subtotal"), maxUses: integer("max_uses"), usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true), ...timestamps(),
}, (t) => [check("coupons_code_check", sql`${t.code} = upper(${t.code}) AND length(${t.code}) > 0`),
  check("coupons_value_check", sql`${t.value} > 0 AND (${t.type} <> 'percent' OR ${t.value} <= 100)`),
  check("coupons_usage_check", sql`${t.usedCount} >= 0 AND (${t.maxUses} IS NULL OR ${t.maxUses} > 0) AND (${t.minSubtotal} IS NULL OR ${t.minSubtotal} >= 0)`),
  check("coupons_window_check", sql`${t.endsAt} IS NULL OR ${t.startsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`)]);
export const reviews = pgTable("reviews", {
  id: id(), productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(), customerPhone: text("customer_phone"), rating: integer("rating").notNull(), title: text("title"), body: text("body").notNull(),
  status: reviewStatus("status").notNull().default("pending"), verifiedPurchase: boolean("verified_purchase").notNull().default(false), ...timestamps(),
}, (t) => [check("reviews_rating_check", sql`${t.rating} BETWEEN 1 AND 5`), index("reviews_product_status_idx").on(t.productId, t.status)]);

// Better Auth core tables use its singular model names and camelCase TS fields.
export const user = pgTable("user", {
  id: id(), name: text("name").notNull(), email: text("email").notNull().unique(), emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"), role: text("role").notNull().default("admin"), ...timestamps(),
});
export const session = pgTable("session", {
  id: id(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), ipAddress: text("ip_address"), userAgent: text("user_agent"), ...timestamps(),
}, (t) => [index("session_user_idx").on(t.userId)]);
export const account = pgTable("account", {
  id: id(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"), ...timestamps(),
}, (t) => [index("account_user_idx").on(t.userId), uniqueIndex("account_provider_account_idx").on(t.providerId, t.accountId)]);
export const verification = pgTable("verification", {
  id: id(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), ...timestamps(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const brandsRelations = relations(brands, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }), variants: many(productVariants), images: many(productImages), notes: many(productNotes), reviews: many(reviews),
}));
export const notesRelations = relations(notes, ({ many }) => ({ products: many(productNotes) }));
export const productNotesRelations = relations(productNotes, ({ one }) => ({
  product: one(products, { fields: [productNotes.productId], references: [products.id] }), note: one(notes, { fields: [productNotes.noteId], references: [notes.id] }),
}));
export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({ product: one(products, { fields: [productVariants.productId], references: [products.id] }), orderItems: many(orderItems) }));
export const productImagesRelations = relations(productImages, ({ one }) => ({ product: one(products, { fields: [productImages.productId], references: [products.id] }) }));
export const customersRelations = relations(customers, ({ many }) => ({ orders: many(orders) }));
export const ordersRelations = relations(orders, ({ one, many }) => ({ customer: one(customers, { fields: [orders.customerId], references: [customers.id] }), items: many(orderItems), events: many(orderEvents) }));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({ order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }), variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }) }));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({ order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }) }));
export const reviewsRelations = relations(reviews, ({ one }) => ({ product: one(products, { fields: [reviews.productId], references: [products.id] }) }));
export const userRelations = relations(user, ({ many }) => ({ sessions: many(session), accounts: many(account) }));
export const sessionRelations = relations(session, ({ one }) => ({ user: one(user, { fields: [session.userId], references: [user.id] }) }));
export const accountRelations = relations(account, ({ one }) => ({ user: one(user, { fields: [account.userId], references: [user.id] }) }));
