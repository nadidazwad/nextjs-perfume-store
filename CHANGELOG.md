# Changelog

## Unreleased

**The storefront feels like an app on phones** (≤760 px; tablets and desktops
are unchanged). A floating glass tab bar (Home, Shop, Search, Saved, Bag)
replaces the header icons; its highlight glides between tabs and it slims down
while you scroll. The header becomes a navigation bar: a back button, and the
page title fades in once the page's own large title scrolls under it.
Bag, Shop, Filters and the wishlist open as bottom sheets you can drag or
flick away, and the page scales back behind them like an iOS page sheet.
Adding to the bag shows an "Added to bag" toast instead of opening the bag.
Product pages get edge-to-edge photos you swipe through (with page dots, a
share button where the phone has a share sheet, and a full-screen viewer),
and the details ride up over the photo as a sheet. Tapping a product card
pushes the product page in from the right, its photo morphing into the
gallery, and the back button pops it (View Transitions; browsers without them
just navigate). Listings get one sticky, swipeable row of Filters, Sort and
one-tap toggles; checkout docks the total and "Place order" at the bottom;
the home page gets a photo hero with page dots, round category shortcuts and
peeking carousels. The store can be installed to the home screen (web app
manifest, generated icon, safe areas for notched phones). Short vibrations
on Android confirm adds and taps. Reduced motion, reduced transparency and
keyboard use all get calmer fallbacks. See "Phone app shell" in
`docs/DESIGN_SYSTEM.md`.

The store's logo stays centred in the phone nav bar on every page, with the
page name appearing under it as you scroll. A load bar along the nav bar
starts the moment a link is tapped. Touchscreens no longer get hover styles
that stay stuck after a tap.

**Testing on a phone:** `pnpm dev` now serves its scripts, and admin sign-in
works, when opened from this machine's own LAN address
(`http://192.168.x.x:3000`). Before, pages loaded but nothing interactive
worked. Development only; production is unchanged.

**Fix:** the admin sign-in form posts instead of defaulting to GET, so if its
script ever fails to load, the password can't end up in the URL.

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
