# Attar — Functional Specification

Open-source perfume e-commerce template: Jomashop-grade storefront + admin panel,
manual (phone-confirmed) order fulfillment, zero-cost deployment.

> **How to read this document.** §1–3 define scope and structure. §4 is the complete
> data model. §5 (storefront), §6 (admin), §7 (platform) are the feature specs,
> broken into numbered tasks (`ST-*`, `AD-*`, `PF-*`) with acceptance criteria.
> Build order lives in `docs/IMPLEMENTATION_PLAN.md`, which references these task
> IDs. UX patterns marked "(J)" were observed on Jomashop — see
> `docs/research/jomashop-findings.md`.

---

## 1. Product definition

**Attar** is a template a perfume retailer forks and deploys as their own store.

- **Storefront**: Jomashop-style deal-driven catalog browsing — brand-first
  navigation, faceted filtering (notes, concentration, gender, size…), strikethrough
  MSRP pricing, image-heavy product pages.
- **Ordering**: no payment gateway. Customer places an order with name + phone +
  address; chooses Cash on Delivery or manual bKash/Nagad (sends money, enters
  TrxID). The shop team is notified instantly (console/email/Telegram), calls the
  customer, confirms, and moves the order through a fulfillment pipeline in the
  admin panel. The order's notes timeline is the "ticket".
- **Deployment**: free-tier friendly. Local dev requires zero external accounts
  (embedded PGlite DB, console notifications, local image storage).

### 1.1 Target users

| User | Needs |
|---|---|
| **Shopper (BD consumer)** | Browse/filter perfumes, trust the shop, order with phone number only, track order without an account |
| **Shop team (1–3 people)** | See new orders instantly, call & confirm, manage catalog/banners/stock from a phone-friendly admin |
| **Retailer/developer forking the template** | Rebrand via one config file, deploy free, extend with AI assistance |
| **AI agent configuring the template** | Predictable structure, typed config, machine-readable instructions (`AGENTS.md`) |

### 1.2 Non-goals (v1)

Payment gateway integration, multi-vendor, multi-currency, multi-language (English
only; Bengali is a documented future concern), customer login accounts, SMS
notifications, courier API integration, loyalty programs, blog. Nothing in the
design may make these impossible later.

---

## 2. Site map

### 2.1 Storefront — route group `src/app/(storefront)/`

| Route | Page |
|---|---|
| `/` | Homepage (admin-managed sections) |
| `/products` | All-products PLP with full faceted filtering |
| `/products/[slug]` | Product detail page |
| `/brands` | Brand index, A–Z (J) |
| `/brands/[slug]` | Brand PLP (brand hero + filtered catalog) |
| `/c/[slug]` | Collection PLP (e.g. `/c/men`, `/c/niche`, `/c/oud`) — a saved filter set with landing content |
| `/search?q=` | Search results (PLP layout) |
| `/cart` | Cart page (also a header drawer) |
| `/checkout` | Checkout form |
| `/order/confirmed/[orderNumber]` | Post-order confirmation |
| `/track-order` | Order lookup: phone + order number |
| `/wishlist` | Wishlist (localStorage) |
| `/pages/[slug]` | Static pages (About, Delivery & Returns, Authenticity, Privacy) |

### 2.2 Admin — route group `src/app/admin/`

| Route | Page |
|---|---|
| `/admin/login` | Email + password login |
| `/admin` | Dashboard: pending-orders queue + stats |
| `/admin/orders`, `/admin/orders/[id]` | Order pipeline; order detail with notes timeline |
| `/admin/products`, `/admin/products/new`, `/admin/products/[id]` | Catalog management |
| `/admin/brands` | Brand CRUD |
| `/admin/taxonomy` | Notes, fragrance families, collections |
| `/admin/banners` | Announcement bar, hero banners, event cards, homepage layout |
| `/admin/customers`, `/admin/customers/[id]` | Customer list & history |
| `/admin/coupons` | Coupon CRUD (v2) |
| `/admin/reviews` | Review moderation (v2) |
| `/admin/pages` | Static page editor |
| `/admin/settings` | Read-only view of active config + env diagnostics |

### 2.3 API routes

Server Actions handle all mutations. The only REST endpoints:
`/api/auth/[...all]` (Better Auth), `/api/search/suggest?q=` (autosuggest, v2),
`/api/uploads` (image upload handler).

---

## 3. Core principles (binding on all tasks)

1. **Money is integers** in the currency minor unit (`store.config.ts →
   currency.minorUnits`). Formatting only via `formatMoney()` in `src/lib/money.ts`.
2. **Phone-first identity.** Customers have no passwords. A customer record is
   keyed by normalized phone number (`+880…`), auto-created/merged on order.
3. **Guest everything.** No storefront feature may require login.
4. **Server Components by default**; client components only for interactivity
   (cart, filters, gallery, forms).
5. **Every external service is an adapter with a local default** (DB → PGlite,
   notifications → console, storage → local disk).
6. **Config over code.** Branding/behavior changes must be possible in
   `store.config.ts` without touching components.
7. **Feature flags respected everywhere.** If `features.reviews` is false, review
   UI, routes, and queries must not render/execute.
8. **Mobile-first.** BD traffic is overwhelmingly Android phones. Every page must
   be excellent at 360 px wide before desktop styling is considered done.
9. **Seed data is fictional.** No real perfume brand names, product names, or
   photos in the repo (trademark/copyright). Seeded brands/products are invented.

---

## 4. Data model

Implement in `src/db/schema.ts` (Drizzle, Postgres dialect).

### 4.1 Conventions

- Table names snake_case plural. Columns snake_case.
- PK: `id text primary key` via `createId()` (`src/lib/id.ts`, nanoid-style).
- `created_at`/`updated_at` `timestamptz` defaults everywhere.
- Money columns `integer` (minor units). Quantities `integer`.
- Slugs unique, lowercase kebab-case, generated in `src/lib/slug.ts`.

### 4.2 Tables

**brands** — `id, name, slug (uq), brand_type enum('designer','niche','arabian','celebrity','local'), logo_url?, hero_image_url?, description?, is_featured bool, sort_order int`

**collections** — saved filter sets that act as merchandised landing pages
(`/c/men`, `/c/oud`). `id, name, slug (uq), description?, hero_image_url?,
filter_json jsonb (same shape as PLP query params), sort_order, is_active`

**notes** — fragrance notes taxonomy. `id, name (uq), slug (uq), group
enum('citrus','floral','woody','oriental','fresh','spicy','sweet','musky','green','aquatic')`

**products** —
`id, name, slug (uq), brand_id fk, collection_name? (series like "Aventus" (J)),
description text (rich), gender enum('men','women','unisex'),
concentration enum('edt','edp','parfum','extrait','edc','oil','attar'),
packaging enum('standard','tester','sample','mini','gift_set') default standard,
fragrance_family?, perfumer?, launch_year int?, country_of_origin?,
ground_shipping_only bool default false, is_featured bool, is_active bool,
meta jsonb (spare)`

**product_notes** — join. `product_id fk, note_id fk, position
enum('top','heart','base'), pk(product_id, note_id, position)`

**product_variants** — the purchasable unit.
`id, product_id fk, sku (uq), size_ml int, size_label? ("100 ml"),
retail_price int (MSRP), price int (asking/sale), cost_price int? (admin-only),
stock_quantity int default 0, low_stock_override int?, barcode?,
is_default bool, is_active bool`
Constraint: `price <= retail_price`. A product has ≥1 variant; single-size
products still get one variant (uniform code path).

**product_images** — `id, product_id fk, url, alt, sort_order int`
(sort_order 0 = primary, 1 = hover image (J))

**customers** — `id, phone (uq, normalized E.164), name, email?, default_address
jsonb?, tags text[], internal_note?, is_blocked bool default false`
(`is_blocked` matters: fake-order harassment is a real BD COD problem)

**orders** —
`id, order_number (uq, human-readable "ATR-1042" — prefix from config + sequence),
customer_id fk, status enum('pending','confirmed','packed','shipped','delivered',
'cancelled','returned') default pending,
customer_name, customer_phone, customer_email? (denormalized snapshot),
shipping_address jsonb {line1, line2?, area, city, zone_id},
delivery_zone_id, delivery_fee int, subtotal int, discount int default 0,
total int,
payment_method enum('cod','bkash','nagad'), payment_txn_id?,
payment_verified bool default false,
coupon_code?, customer_note?, courier_name?, tracking_id?,
cancelled_reason?, source enum('web') default web`

**order_items** — price-frozen snapshot.
`id, order_id fk, variant_id fk?, product_name, variant_label, brand_name,
image_url?, unit_price int, quantity int, line_total int`
(snapshot columns survive product deletion; fk nullable + `on delete set null`)

**order_events** — the ticket timeline.
`id, order_id fk, type enum('status_change','note','call_logged','system'),
from_status?, to_status?, message?, actor ('system' | admin user id),
created_at`

**banners** —
`id, placement enum('announcement','hero','event_card','promo_strip'),
title?, subtitle?, image_url?, href?, cta_label?, sort_order, is_active,
starts_at?, ends_at?`

**homepage_sections** —
`id, type enum('hero','category_tiles','event_cards','product_carousel',
'brand_strip','value_props','collection_banner'),
title?, subtitle?, config jsonb (per-type payload: e.g. product_carousel →
{source: 'featured'|'new'|'deals'|'collection', collectionId?, limit}),
sort_order, is_active`

**static_pages** — `id, slug (uq), title, body (markdown), is_active`

**settings** — key/value store for admin-editable runtime settings that don't
belong in code config. `key text pk, value jsonb`

**coupons** (v2) — `id, code (uq, uppercase), type enum('percent','fixed'),
value int, min_subtotal int?, max_uses int?, used_count int default 0,
starts_at?, ends_at?, is_active`

**reviews** (v2) — `id, product_id fk, customer_name, customer_phone?,
rating int 1–5, title?, body, status enum('pending','approved','rejected')
default pending, verified_purchase bool (phone matches a delivered order
containing the product)`

Better Auth also generates its own tables (`user`, `session`, `account`,
`verification`) for **admin users only**.

### 4.3 Order status rules

```
pending   -> confirmed | cancelled
confirmed -> packed | cancelled
packed    -> shipped | cancelled
shipped   -> delivered | returned
delivered -> (terminal)
cancelled -> (terminal)
returned  -> (terminal)
```

- Transitions validated in `src/lib/orders/transitions.ts`; invalid transitions
  throw. Every transition writes an `order_events` row.
- Stock decrements on `pending → confirmed`; restores on cancellation *after*
  confirmation and on `returned`. (COD orders cancel frequently *before*
  confirmation — those never touched stock.)

---

## 5. Storefront tasks (ST)

### ST-01 · Global layout & header
Sticky header: logo (config), search bar (center, collapses to icon on mobile),
wishlist icon w/ count, cart icon w/ count opening a **drawer** (J). Above it the
contact strip: phone (tel: link) + WhatsApp deep link (`wa.me/<config number>`).
Primary nav below: `Brands | Men | Women | Unisex | New Arrivals | Deals | +
active collections`. Desktop: Brands opens a mega-menu panel (featured brand
logos + A–Z columns) (J); other items open panels with collection links.
Mobile: hamburger → full-height sheet with accordion nav.
**Accept:** all config-driven; keyboard navigable; no layout shift from cart
count hydration.

### ST-02 · Announcement bar
Renders active `announcement` banners (respecting start/end dates) above the
header; multiple messages rotate every 5 s (J). Dismissible per session.
Hidden entirely when `announcementBar.enabled` is false or no active rows.

### ST-03 · Footer
Config-driven: contact block (address lines, phone, email), social icons, links
to static pages, payment-method badges (COD/bKash/Nagad per enabled config),
trust line, copyright. Newsletter input stub (logs to console; adapter later).

### ST-04 · Homepage
Renders `homepage_sections` ordered by `sort_order`, each type its own component:
- `hero` — full-width banner carousel from `hero` banners (J)
- `category_tiles` — image tile grid (J "Shop by Category")
- `event_cards` — image cards + title/subtitle from `event_card` banners (J "Sales & Events")
- `product_carousel` — configurable source: featured / new arrivals / deals
  (highest % off) / a collection (J "Trending Now", "Featured Daily Deals")
- `brand_strip` — horizontally scrolling featured-brand logos (J)
- `value_props` — 3–4 icon blurbs (authenticity, delivery, easy returns, phone
  confirmation) (J)
- `collection_banner` — wide banner linking to a collection
**Accept:** empty DB → sensible fallback hero; all sections server-rendered;
carousels are the shadcn/embla carousel with touch support.

### ST-05 · Product card (shared component)
(J) Image (aspect 1:1) swapping to 2nd image on hover; brand name bold;
product name (2-line clamp); concentration + size line ("EDP · 100 ml");
`-36%` deal badge (config `theme.deal` color) when `price < retail_price` and
`features.dealBadges`; `৳510` struck + `৳375` price; "Limited stock" tag when
`0 < stock ≤ lowStockThreshold`; "Out of stock" overlay state; wishlist heart
(optimistic, localStorage); whole card links to PDP.
**Accept:** used by every grid/carousel; renders from a single typed
`ProductCardData` shape produced by one shared query helper.

### ST-06 · PLP — listing, filtering, sorting, pagination
Used by `/products`, `/brands/[slug]`, `/c/[slug]`, `/search`.
Breadcrumb, H1, result count (J), sort select: Newest / Price low→high /
Price high→low / Biggest discount / Name. Filter sidebar (desktop) & filter
sheet (mobile) with active-filter chips:
- Brand (searchable checkbox list, A–Z index when >20 brands (J))
- Gender, Concentration, Packaging, Fragrance family
- Notes (grouped by note group) (J "Fragrance Notes Group")
- Size buckets (<50 / 50–99 / 100+ ml), Price range (min/max inputs),
  Availability (in stock), Deals only (has discount) (J "Coupon Offers" analog)
All filter state lives in URL query params (shareable, SSR-rendered, indexed).
Numbered pagination (J), `pageSize` from config.
**Accept:** any filter combination returns correct results via one composable
Drizzle query builder (`src/lib/catalog/query.ts`); filter changes don't reset
scroll unnecessarily; zero-result state suggests clearing filters.

### ST-07 · PDP
(J layout) Breadcrumb `Home > Products > {Brand} > {Product}`.
Left: gallery — main image w/ tap-to-zoom lightbox + thumbnail strip.
Right buy box, in order: linked brand; H1; SKU line; stock badge
(`IN STOCK` / `LOW STOCK — only N left` / `OUT OF STOCK`); deal badge;
price stack (`Retail ৳X` struck / `৳Y` / "You save ৳Z (36%)") (J);
**variant selector** (size buttons; disabled when variant out of stock);
quantity stepper; Add to cart (sticky bottom bar on mobile); wishlist;
delivery promise block from config zones ("Inside Dhaka: 1-2 days ৳70 …");
payment methods line ("COD · bKash"); authenticity/trust block (J);
phone + WhatsApp "Ask about this product" links.
Below: Description (rich text); **Notes pyramid** — Top/Heart/Base chips
linking to `/products?note=` (our upgrade over Jomashop's prose-only notes);
spec table (Brand, Type, Concentration, Size, Gender, Family, Perfumer,
Launch year, Origin, Barcode) (J); Related products (same brand or shared
notes, excluding self, max 8).
**Accept:** JSON-LD `Product` schema; `generateMetadata` per product; ground
`ground_shipping_only` renders a shipping-restriction note; 404 for
inactive/unknown slugs.

### ST-08 · Search
Header search → `/search?q=`. Postgres ILIKE + trigram-ish matching across
product name, brand name, collection_name, description. PLP layout with all
filters available. v2: `/api/search/suggest` powering a dropdown with top 5
products (thumb + price) + matching brands, debounced 150 ms, keyboard
navigable (J).

### ST-09 · Cart
Client state in localStorage (`attar-cart-v1`), context provider +
`useCart()`. Line = variantId + qty. Drawer (J) + `/cart` page: item rows
(image, name, variant, unit price, qty stepper, remove), subtotal, "delivery
calculated at checkout", free-delivery progress bar when config'd
("৳1,200 away from free delivery"). On load, revalidates lines server-side
(price drift, stock, deactivation) and surfaces changes.
**Accept:** survives refresh; qty capped at stock; empty state with CTA (J).

### ST-10 · Checkout
Single page, mobile-first, no login. Sections:
1. **Contact** — name*, phone* (BD format validated: `01[3-9]XXXXXXXX`,
   normalized to E.164), email (optional).
2. **Delivery** — address line*, area*, city*, delivery zone select from
   config (fee shown live).
3. **Payment** — radio: COD / bKash / Nagad (only enabled ones). bKash/Nagad
   selection reveals config instructions + the shop's number + required TrxID
   input.
4. **Note** — optional customer note.
5. **Summary** — items, subtotal, delivery fee, free-delivery discount, total;
   config `confirmationNote` displayed prominently ("our team will call you").
Submit = Server Action: re-validate cart server-side → upsert customer by
phone → create order + items + initial `order_events` row → fire notification
adapter → redirect to confirmation. Rate-limited per phone/IP (crude in-memory
+ honeypot field) against fake-order spam.
**Accept:** invalid phone blocks submit with inline error; order lands in
admin within one request cycle; cart cleared only after success.

### ST-11 · Order confirmation & tracking
Confirmation page: big order number, "what happens next" steps (call →
confirm → deliver), payment instructions again if bKash/Nagad, WhatsApp/phone
links, "Track your order" link.
`/track-order`: phone + order number → status timeline (pending → … with
dates from `order_events`), items, total, courier + tracking id when shipped.
Not guessable: requires both phone AND order number to match.

### ST-12 · Brand pages
`/brands`: A–Z index grouped alphabetically, search-as-you-filter, featured
brands strip w/ logos (J). `/brands/[slug]`: hero (logo, description) + PLP
scoped to brand.

### ST-13 · Collections
`/c/[slug]`: hero + PLP pre-filtered by `filter_json`, user can refine further.
Powers nav items like Men / Niche / Oud / Gift Sets without code changes.

### ST-14 · Wishlist & recently viewed (flag-gated)
Both localStorage, no server writes. `/wishlist` renders product cards from
stored ids (server-fetched by id list). Recently-viewed strip (last 10) on PDP
+ homepage slot. Both disabled cleanly via feature flags.

### ST-15 · Static pages
`/pages/[slug]` renders `static_pages` markdown. Seed: about, delivery-returns,
authenticity, privacy. Footer links auto-list active pages.

### ST-16 · SEO & platform polish
`generateMetadata` everywhere (config `titleTemplate`); OG images (static
default; product pages use primary image); `sitemap.ts` (products, brands,
collections, static pages); `robots.ts`; canonical URLs; JSON-LD (`Product`,
`BreadcrumbList`, `Organization`); 404 + error pages branded (missing
products, brands, collections and pages return a real HTTP 404). PLP/PDP
render complete server HTML with no route-level loading skeleton: a skeleton
delays LCP and makes `notFound()` arrive after a 200 (Phase 6 decision, see
docs/PHASE_6_VERIFICATION.md). Cart and checkout keep their skeletons.

### ST-17 · Reviews — storefront (v2, flag-gated)
PDP: rating summary (avg + distribution bars (J)), approved reviews list
(paginated), "Write a review" dialog (name*, phone, rating*, title, body*) →
lands as `pending`. "Verified purchase" badge when phone matches a delivered
order with this product. Star aggregates denormalized onto product query.

### ST-18 · Coupons — storefront (v2, flag-gated)
Cart/checkout coupon input; Server Action validates (active, window, min
subtotal, uses left) and applies discount to summary + order. Invalid codes
get specific error messages. Coupon usage incremented only on order creation.

---

## 6. Admin tasks (AD)

Admin lives at `/admin`, protected by Better Auth email/password sessions
(middleware guard). Desktop-first but fully usable at 360 px (BD teams run
shops from phones). Layout: sidebar (collapsible to icons) + topbar with
"View store" link and pending-orders badge.

### AD-01 · Auth
Better Auth credential provider; single role "admin" v1 (schema keeps a
`role` column for future). Login page, session cookie, logout. Seed script
creates the initial admin from env (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), warns
loudly on default credentials in production. Unauthed `/admin/*` → login.

### AD-02 · Dashboard
Top: stat cards — Pending orders, Today's orders, This week's revenue
(confirmed+ only), Low-stock variants count. Center: **the call queue** —
pending orders oldest-first: order number, age ("2 h ago"), customer name +
phone (tel: link), total, payment method, item count → detail. Below: recent
activity feed from `order_events` (last 20).

### AD-03 · Orders list
Table: order number, created, customer (name + phone), items count, total,
payment (method + verified badge), status chip. Status tabs w/ counts
(All / Pending / Confirmed / Packed / Shipped / Delivered / Cancelled /
Returned). Filters: date range, payment method, search (order #, phone,
name). Pagination. Row → detail.

### AD-04 · Order detail — the ticket
Header: order number, status chip, created date, **action buttons for legal
transitions only** (§4.3): Confirm / Cancel / Pack / Ship / Deliver / Return.
- Confirm on a bKash/Nagad order surfaces TrxID + "mark payment verified".
- Cancel requires a reason (dropdown: no answer ×3 / customer declined /
  duplicate / suspected fake / other + free text).
- Ship prompts courier name + tracking id.
Body: items table (image, name, variant, qty, unit, line total), totals block,
customer block (phone tel: link, address, zone, customer note, link to
customer page + "Nth order from this customer"), payment block.
**Timeline**: `order_events` newest-first — status changes, notes, call logs.
Composer adds a note or logs a call ("no answer" one-click). Everything
optimistic + Server Actions.
**Accept:** stock decremented exactly once on confirm; restored on
post-confirmation cancel/return; every mutation lands in the timeline.

### AD-05 · Products list
Table: thumb, name, brand, concentration, variants count, price range, total
stock (red badge ≤ threshold), active toggle, featured toggle. Search + brand
/ status / stock filters. Bulk activate/deactivate. "New product" CTA.

### AD-06 · Product editor
Tabbed form (create + edit share it):
1. **Basics** — name, brand (searchable select + inline "new brand" dialog),
   collection name, gender, concentration, packaging, family, description
   (markdown textarea w/ preview), perfumer, launch year, origin, flags
   (active, featured, ground-shipping-only).
2. **Variants** — inline-editable rows: size ml, label, SKU (auto-suggested
   `BRAND-PRODUCT-100` pattern), retail price, price, stock, barcode, default
   radio, active. Guard: ≥1 variant, exactly 1 default. Price > retail blocked.
3. **Images** — uploader (drag-drop + file picker) → storage adapter; sortable
   thumbnails (0 = primary, 1 = hover); alt text; delete. Client-side resize
   to ≤1600 px WebP before upload.
4. **Notes** — three multi-select pickers (Top/Heart/Base) over notes taxonomy,
   grouped by note group; inline "create note".
Slug auto-generated, editable, uniqueness-checked. Zod-validated Server
Actions; per-field errors.

### AD-07 · Brands & taxonomy
`/admin/brands`: CRUD table — name, type, logo upload, hero image, description,
featured, sort. Delete blocked if products exist (offer deactivate).
`/admin/taxonomy`: tabs for Notes (name + group; merge tool nice-to-have) and
Collections (name, slug, hero, description, `filter_json` via a **filter
builder UI** identical to PLP sidebar, active, sort).

### AD-08 · Banners & homepage
`/admin/banners`: tabs per placement (announcement / hero / event cards /
promo strip): image upload, title, subtitle, href, CTA, schedule
(starts/ends), active, drag-sort. `/admin/homepage`: sortable list of
homepage sections; add/edit section w/ type-specific config form (carousel
source, tile links…); toggle active. Live "preview on store" link.

### AD-09 · Customers
List: name, phone, orders count, delivered count, cancelled count (fake-order
signal), total spent, last order, blocked badge. Search name/phone. Detail:
info card, editable internal note + tags, **block toggle** (blocked customers'
checkouts are rejected with a polite "call us" message), order history table.

### AD-10 · Static pages
CRUD: slug, title, markdown body w/ preview, active. Warn before deleting
seeded pages linked from footer.

### AD-11 · Settings & diagnostics
Read-only render of active `store.config.ts` (grouped, pretty) with "edit
store.config.ts and redeploy" guidance; env diagnostics panel: which DB
driver / notify adapter / storage adapter are active, with green/amber
status + a "send test notification" button.

### AD-12 · Coupons (v2)
CRUD table: code, type, value, min subtotal, window, uses (used/max), active.
Generate-code button. Usage count visible.

### AD-13 · Reviews moderation (v2)
Queue of pending reviews: product, name, rating, body, verified badge →
approve/reject. Tabs by status. Bulk actions.

---

## 7. Platform tasks (PF)

### PF-01 · Repo & tooling ✅ (scaffolded)
Next.js (App Router, TS, Tailwind v4, `src/`), shadcn/ui, Drizzle + PGlite/
postgres dual driver, Better Auth, Zod. ESLint + `tsc --noEmit` in CI.

### PF-02 · Config & env ✅ (scaffolded)
`store.config.ts` (Zod-parsed, typed) + `src/lib/env.ts` (conditional
requirements per adapter; production-only requirements).

### PF-03 · DB schema & migrations
Implement §4 in `src/db/schema.ts`. Scripts: `db:push` (dev), `db:generate` +
`db:migrate` (prod), `db:studio`. Migrations committed from Phase 1 onward.

### PF-04 · Seed
`pnpm db:seed` (idempotent — safe to re-run): admin user from env; ~10
fictional brands across brand types; notes taxonomy (~60 notes, all groups);
~40 products with variants/notes/generated placeholder images (branded
gradient + name SVGs committed to `public/seed/`); 4 collections
(Men/Women/Niche/Deals); homepage sections + banners mirroring the Jomashop
anatomy; static pages; 15 demo orders across all statuses with realistic
event timelines; 2 coupons.
**A fresh clone must demo like a real store.**

### PF-05 · Adapters
`src/lib/notify/` — interface `notifyNewOrder(order)`, `notifyTestPing()`;
impls: console, resend, telegram; picked by env; failures logged, never
block checkout (fire-and-forget with try/catch).
`src/lib/storage/` — interface `putObject(buffer, key) → url`,
`deleteObject(key)`; impls: local (public/uploads + .gitignore), s3
(aws4fetch signed calls — works for R2/S3/Supabase/MinIO).

### PF-06 · Utilities
`src/lib/money.ts` (formatMoney, calcDiscount%), `src/lib/phone.ts`
(BD validation/normalization/display), `src/lib/slug.ts`, `src/lib/id.ts`,
`src/lib/orders/transitions.ts`, `src/lib/order-number.ts` (prefix +
DB sequence).

### PF-07 · Theming
`globals.css` maps `theme.primary` / `theme.deal` / `theme.radius` into the
shadcn CSS-variable system (build-time injection via CSS vars in root
layout). Changing config colors restyles the whole store, both route groups.

### PF-08 · Deployment & docs
README: 5-minute local quickstart (no accounts), Deploy-to-Vercel button +
Neon walkthrough (with explicit note: Vercel Hobby is non-commercial —
test/hobby only), Cloudflare + Docker guides (docs/deploy/*.md, may land
v2), adapter setup guides (Telegram bot, Resend, R2), FAQ.
`AGENTS.md` kept in sync as the AI-facing map. GitHub Actions CI:
lint + typecheck + build. MIT license.

### PF-09 · Hardening
Server-side re-validation of every price/stock at checkout (never trust
client); rate limiting on checkout + track-order + review submission;
blocked-customer rejection; input length caps; image upload MIME/size
validation; admin mutations verify session server-side in every action;
no PII in logs beyond what admins need.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | PLP/PDP LCP < 2.5 s on mid-range Android over 4G; `next/image` everywhere; PLP queries indexed (brand_id, price, gender, concentration; GIN on product name) |
| Accessibility | Semantic landmarks, focus states, alt text enforced in admin, filter sidebar operable by keyboard, WCAG AA contrast for both theme colors (documented check) |
| SEO | See ST-16. Storefront is fully crawlable server-rendered HTML |
| Security | See PF-09 + Better Auth defaults; admin cookies httpOnly/secure/sameSite |
| Browser support | Evergreen + Android WebView (Facebook in-app browser is huge in BD — test checkout in it) |
| Code quality | `pnpm lint && pnpm typecheck && pnpm build` green at every phase gate |

---

## 9. Glossary

| Term | Meaning |
|---|---|
| Concentration | Perfume oil strength class: EDC < EDT < EDP < Parfum < Extrait; `oil`/`attar` = alcohol-free oils |
| Notes pyramid | Top (opening) / Heart (middle) / Base (drydown) scent notes |
| Tester | Genuine product in plain packaging, sold cheaper (J filter) |
| Decant/Sample | Small quantity repackaged from an original bottle |
| TrxID | bKash/Nagad transaction id the customer receives after sending money |
| COD | Cash on delivery — dominant BD payment method |
| PLP / PDP | Product listing page / product detail page |
