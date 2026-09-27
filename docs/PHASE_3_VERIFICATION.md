# Phase 3 implementation and verification

Implemented 20 September 2026. Scope is steps 3.1 through 3.6 of the implementation plan. Admin screens remain Phase 4; coupons remain Phase 5.

## Delivered

- `attar-cart-v1` persistence, cross-tab updates, server quotes, live header count, drawer and cart page. Price changes, reduced stock and unavailable items produce visible messages.
- Product-page add-to-bag controls, stock-capped quantities, removal, empty/loading/error states and configured free-delivery progress.
- Guest checkout with shared Zod validation, normalized Bangladesh phone numbers, configured zones and enabled payment methods, manual-payment instructions and required TrxID.
- Transactional customer upsert, blocked-customer check, database-priced item snapshots and initial pending event. A request UUID prevents duplicate orders on retry. Variant locks coordinate with confirmation; checkout never decrements stock.
- Phone/IP process-local rate limits, honeypot, field limits, private confirmation cookie, phone-and-order tracking and public-only status timeline. Next.js development Server Action argument logging is disabled to avoid contact details in routine logs.
- Console, Resend and Telegram notification adapters. Next.js `after` schedules notifications after the order response; caught failures cannot roll back an order. Provider requests have bounded timeouts.

## Evidence

| Requirement | Evidence |
| --- | --- |
| Persistent cart and quantity limits | Browser refresh retained one River Saffron item; increase stopped at its stock of three; removal in a second tab updated the first tab |
| Mobile ordering | 360 × 800 browser: catalog, in-stock filter, PDP, drawer, cart, checkout, COD confirmation and tracking |
| COD | Local test order ATR-1016, pending, subtotal/total 7,425, free delivery, one pending event, payment unverified |
| bKash | Local test order ATR-1017, pending, subtotal 3,640, outside-Dhaka fee 130, total 3,770, test TrxID stored, payment unverified |
| Validation | Invalid mobile number and missing TrxID blocked inline; disabled Nagad absent; zone fee updated live |
| Notification | Both browser orders printed rich console summaries after saving |
| Stock | Direct database query confirmed River Saffron remained at three after its pending order; isolated database tests assert stock unchanged for COD and bKash and only one confirmation can consume the last unit |
| Tracking privacy | Wrong phone rejected; correct phone returned pending timeline; another confirmation URL without its matching cookie showed the lookup prompt |
| Responsive UI | Drawer, cart, checkout, confirmation and tracking inspected at 360 px; cart and checkout inspected at 1440 px. Measured cart/confirmation widths 345/345 and desktop checkout 1425/1425, with no horizontal overflow |
| Keyboard | Escape closed the cart drawer and returned focus to Add to bag |
| Database seed | Ran twice consecutively, then again after browser orders; existing catalog, stock and orders preserved |
| Automated tests | 25 individual tests passed outside the sandbox, including checkout transactions, duplicates, stock, tracking privacy, rate limits, notification request serialization and provider failure isolation |
| Build | Production webpack build passed with all four Phase 3 routes, no `.env` required for compilation |

## UI polish review

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH, resolved | `src/components/storefront/product-details.tsx` | Disabled ordering controls | Working stock-aware add-to-bag controls | Complete interaction cycle |
| HIGH, resolved | `src/components/storefront/checkout.tsx` | No checkout | Labeled fields, inline errors, pending submission and retained bag on failure | Visible feedback beyond motion |
| MEDIUM, resolved | `src/components/storefront/cart.tsx` | Header count and bag stub | Live count, image rows, 44 px quantity controls and empty state | Consistent controls and hit areas |
| LOW, resolved | `src/app/commerce.css` | No commerce layouts | Restrained existing palette, image outlines, responsive rows and summary | Preserve store style and readable hierarchy |

Existing pointer/keyboard motion policy and reduced-motion CSS are reused. No perpetual decorative motion was added to this repeated shopping flow. Approve for inspected states.

## Verification limits and deployment notes

- Physical Android phone, Facebook WebView, OS reduced-motion switching and DevTools 10% speed replay: **Not verified**. Mobile checks used a 360 px browser viewport.
- Real Resend delivery and Telegram delivery: **Not verified**. Credentials were not provided and no external test messages were sent. Requests and failure handling were tested with mocked transport. Implementations follow the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) and [Telegram sendMessage API](https://core.telegram.org/bots/api#sendmessage).
- Database verification used direct Drizzle queries and isolated transaction tests rather than the Studio UI.
- Rate limits are process-local as specified. Production must configure its trusted proxy to replace `x-forwarded-for`; multiple instances need a shared limiter if stronger global limits are required.
- No database schema change or new application dependency was required.
- The sandbox build reports `Could not parse output from TypeScript's --showConfig`; the unrestricted build passes. Sandboxed test output only reports test files, so the verified 25-test count comes from the unrestricted run.
- This workspace has no usable Git repository. No commit was created.

The local implementation and browser ordering paths are verified. The physical-device and live-provider checks above remain before claiming the full deployment gate.
