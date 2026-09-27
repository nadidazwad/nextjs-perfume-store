# Changelog

## v0.3.0 (2026-09-27)

**Product cards, rebuilt** in the admin panel's language: a grey panel with
the photo and a white info plate. Cards now show concentration, size and how
many sizes are on offer as tags, flag stock only when it's low or sold out,
and have a quick-add button that puts the shown size in the bag (it widens to
"Add 50 ml" on hover). The whole card is one link, so it's a single tab stop.

**Navigation, rebuilt.** The desktop row is a grey rail whose highlight
glides to the item under the pointer. "Shop" and "Brands" open full-width
panels: ways to shop and collections as icon-tile rows with a featured
collection, and every brand as a monogram tile beside its lead fragrance.
Track order and Deals sit on the right. The phone menu follows the admin
sidebar: labelled groups of icon-tile rows, brands as a tile grid, and a
call/WhatsApp card at the bottom.

**Motion and micro-interactions:** the wishlist heart fills with a scale-in,
header counts pop when they go up, checkboxes tick in, the free-delivery bar
glides, messages and coupon cards ease in, skeletons shimmer, the review
dialog opens with the lightbox's transition, "Clear all" shows its 4-second
window, and order confirmation and a sent review get a self-drawing tick.
Admin gets a sliding Write/Preview pill, animated checkboxes and press
feedback on chips and tabs. Everything is CSS transitions or small keyframes
on transform/opacity; keyboard use stays instant and reduced motion keeps
fades only.

## v0.2.0 (2026-09-27)

**Public demo with a sandboxed admin** (`DEMO_MODE`, off by default): on a
showcase deployment, any visitor can open `/demo` and get a private copy of
the store for 2 hours (a Postgres schema per visitor, up to 50 at once), with
a demo admin login that also works from another device. Edits, orders and
uploads are visible only to that visitor; Reset and End are one click; expired
copies are removed automatically. Real stores are unaffected.
See `docs/deploy/public-demo.md`.

**Security:** pages now send a `script-src` Content-Security-Policy with a
per-request nonce (`'strict-dynamic'`), so only Next's own scripts run.

**Maintenance:** Next 16.3.6, React 19.3, drizzle-orm 0.45.3, TypeScript 6,
`@types/node` aligned with the Node 24 runtime, CI actions updated. The unused
product-name GIN index is dropped (migration 0005).

## v0.1.0 (2026-09-27)

The first public release.

**Storefront:** homepage with configurable sections, brand pages, collections,
product listing with perfume-specific filters and live counts, search with
suggestions, product pages with notes pyramid, size variants, gallery and
related products, bag and checkout (Cash on Delivery, manual bKash/Nagad with
TrxID), order confirmation and tracking, wishlist, recently viewed, coupons,
and verified-purchase reviews. Mobile-first from 360 px.

**Admin:** order queue built around the confirmation call (status timeline,
call log, notes, payment verification, courier details), products and
variants with stock, brands, notes, collections, homepage sections, banners,
static pages, customers with blocking, coupons, review moderation, settings
and diagnostics.

**Platform:** one typed `store.config.ts` for branding and behaviour; runs
with no accounts locally (embedded Postgres, console alerts, local images);
adapters for Telegram and Resend alerts and S3-compatible storage (R2); Vercel
+ Neon and Docker deployment guides; Postgres-backed rate limits; security
headers; GitHub Actions CI.
