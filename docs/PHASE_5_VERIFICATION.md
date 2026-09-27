# Phase 5 verification (2026-09-26)

Merchandising & community: coupons (ST-18, AD-12), reviews (ST-17, AD-13),
search autosuggest (ST-08), wishlist + recently viewed (ST-14), flag audit (§3.7).

## Automated gates

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` | clean |
| `pnpm test` | 44/44. New: `tests/coupons.test.ts` (discount math, every validity rule + message, admin schema, totals, checkout redemption, idempotent retry, concurrent last uses, windows), `tests/reviews.test.ts` (summary, input schema, verified-purchase rule, approved-only reads) |
| `pnpm build` | green; new routes `/wishlist`, `/admin/coupons`, `/admin/reviews`, `/api/search/suggest` |
| `pnpm catalog:verify` | passed |
| `node scripts/verify-storefront.mjs http://localhost:3000` | passed (now also checks the suggest API shape, 2-char minimum and 160-char cap) |
| Fresh DB: `db:push` → `db:seed` ×2 → `verify-seed.ts` | passed; fingerprints identical across the two seed runs |
| Existing DB: `db:seed` | adds the v2 fixtures once (`demo_seed_v1_coupons_v2`, `_reviews_v2` markers); second run is a no-op |

## Browser checks (Playwright, 360 px and 1440 px)

No horizontal overflow and no console errors on: cart and checkout with a
coupon applied, PDP with reviews, review dialog (errors and success), search
dropdown, wishlist sheet, `/wishlist`, recently-viewed strip (PDP and home),
`/admin/coupons` list and editor, `/admin/reviews` queue.

Flows exercised end to end:

- Coupons: an invalid code and an expired code each show their specific
  message; `demo10` applies and survives a reload; checkout shows the
  "After coupon" line; the placed order stores `couponCode` + `discount`, and
  the confirmation page shows the coupon line.
- Admin coupons: generate a code, create, get the percent >100 field error,
  get the duplicate-code error, toggle from the list (toast), delete through
  `ConfirmButton`.
- Reviews: submit from the PDP (lands pending); approve it from the queue;
  bulk-select two and reject them.
- Search suggest: keyboard. ArrowDown moves `aria-activedescendant`, Escape
  closes (`aria-expanded=false`), Enter opens the highlighted product.
- Keyboard: review stars are a radio group (arrow keys), with a visible focus
  ring; closing the dialog returns focus to "Write a review".

## Flag audit (§3.7)

Method: `store.config.ts → features` was edited while `pnpm dev` ran, and one
Playwright script checked 34 assertions per configuration. Configurations run:
all five flags off together, then each flag off on its own, then all on again
(baseline). All passed 34/34; the config was restored byte-for-byte afterwards.

Every configuration checks: `/`, `/products`, a PDP, `/cart`, `/checkout`,
`/search`, `/brands`, `/track-order`, `/admin`, `/admin/orders`,
`/admin/products` and `/admin/settings` render with no error boundary and no
console errors, and the suggest API answers.

| Flag off | What was asserted |
|---|---|
| `wishlist` | `/wishlist` → HTTP 404 (gated in `proxy.ts` as well as the page, because storefront pages stream a 200 before a page-level `notFound()`); no hearts on cards or the PDP; no header wishlist button; `loadSavedProducts("wishlist")` refuses |
| `reviews` | no `#reviews` section, buy-box rating, card ratings or JSON-LD `aggregateRating`; `getProductReviews`/`getRatingsFor` return without querying; `submitReview` and the admin actions refuse; `/admin/reviews` → 404; nav entry and pending badge hidden; seed and verify-seed skip the table |
| `coupons` | no coupon form or discount line in cart/checkout, even with a stale code in localStorage (the code is dropped); `revalidateCart` never queries coupons; `createOrder` ignores the code and rejects any claimed discount; `/admin/coupons` → 404; nav entry hidden |
| `recentlyViewed` | no strip on the PDP, home or wishlist page; `attar-recent-v1` is never written; `loadSavedProducts("recent")` refuses |
| `dealBadges` | no `−%` badges and no struck-through MSRP on cards, the PDP or the search dropdown |

With both `coupons` and `reviews` off, the "Marketing" nav group disappears.

## Known limits

- The concurrency test runs on PGlite, which serialises transactions. On
  Postgres the guarantee comes from `SELECT … FOR UPDATE` on the coupon row
  plus the guarded `UPDATE … WHERE used_count < max_uses`.
- Coupon uses aren't returned when an order is cancelled (ST-18 counts usage
  at order creation only).
- A code saved in the bag that has stopped qualifying (e.g. the subtotal
  dropped below the minimum) stays saved with an explanation and re-applies
  once the bag qualifies; codes that are invalid, expired or used up are
  dropped.
