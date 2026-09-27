# Changelog

## Unreleased

**Public demo with a sandboxed admin** (`DEMO_MODE`, off by default): on a
showcase deployment, any visitor can open `/demo` and get a private copy of
the store for 2 hours (a Postgres schema per visitor, up to 50 at once), with
a demo admin login that also works from another device. Edits, orders and
uploads are visible only to that visitor; Reset and End are one click; expired
copies are removed automatically. Real stores are unaffected.
See `docs/deploy/public-demo.md`.

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
