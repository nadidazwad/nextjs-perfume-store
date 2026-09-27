# Attar — Implementation Plan

Phase-by-phase build order for the spec in `docs/SPEC.md`. Written to be executed
by a developer **or an AI coding agent**: every step names its spec tasks, its
files, and a concrete Definition of Done (DoD). Steps within a phase are ordered
by dependency; steps marked ∥ can run in parallel with the previous step.

**Rules for executors (human or AI):**
1. Read `AGENTS.md` and the referenced SPEC sections before starting a step.
2. Do not start a phase until the previous phase's **gate** passes.
3. `pnpm lint && pnpm typecheck && pnpm build` must be green at every gate.
4. Never weaken §3 core principles (integer money, guest-only storefront,
   adapters-with-local-defaults, feature flags, mobile-first) for convenience.
5. If a step's spec is ambiguous, prefer the Jomashop pattern documented in
   `docs/research/jomashop-findings.md`, adapted to manual payments.

---

## Phase 0 — Environment ✅ DONE (scaffolded)

Covers: PF-01, PF-02.
Next.js + TS + Tailwind v4 + shadcn/ui installed; Drizzle + PGlite/postgres dual
driver wired (`src/db/index.ts`); `store.config.ts` + `src/lib/env.ts` +
`.env.example` + `drizzle.config.ts` in place; docs written.

---

## Phase 1 — Data foundation

**Goal:** real schema, seeded demo catalog, shared utilities. No UI yet.
**Covers:** PF-03, PF-04, PF-06, parts of PF-05.

| # | Step | Spec | Files | DoD |
|---|---|---|---|---|
| 1.1 | Utility modules | PF-06 | `src/lib/{id,slug,money,phone}.ts` | Unit-testable pure functions; `formatMoney(37500)` → `"৳37,500"` per config; `normalizePhone("01712345678")` → `"+8801712345678"`; invalid BD phone returns error |
| 1.2 | Full schema | PF-03, SPEC §4 | `src/db/schema.ts` | Every §4.2 table + enums + relations + indexes (PLP filter columns, GIN on product name); `pnpm db:push` succeeds on PGlite AND on a Postgres URL |
| 1.3 | DB scripts | PF-03 | `package.json`, `src/db/migrate.ts` | `db:push`, `db:generate`, `db:migrate`, `db:studio`, `db:seed` scripts work; first migration committed |
| 1.4 | Order helpers | PF-06 | `src/lib/orders/transitions.ts`, `src/lib/order-number.ts` | Transition matrix enforces §4.3 exactly (table-driven); order numbers sequential w/ config prefix; both covered by a small test file |
| 1.5 ∥ | Seed data | PF-04 | `src/db/seed.ts`, `public/seed/*` | `pnpm db:seed` idempotent; fresh clone + `db:push` + `db:seed` yields: admin login works later, ~10 fictional brands, ~60 notes, ~40 products w/ variants+notes+images, collections, banners, homepage sections, static pages, 15 orders across all statuses w/ event timelines |
| 1.6 | Theming bridge | PF-07 | `src/app/globals.css`, `src/app/layout.tsx` | `theme.primary/deal/radius` from config drive shadcn CSS vars; changing a hex in config visibly recolors the default Next page |

**Gate 1:** `pnpm db:push && pnpm db:seed` from a clean clone with no `.env`;
`pnpm db:studio` shows the seeded catalog; build green.

---

## Phase 2 — Storefront catalog (read-only shop)

Implemented and verified on 2026-09-17. See [verification record](PHASE_2_VERIFICATION.md) for checks and the existing PGlite tooling caveat.

**Goal:** a browsable, beautiful, Jomashop-style catalog. No cart yet.
**Covers:** ST-01…ST-08 (search v1), ST-12, ST-13, ST-15, most of ST-16.

| # | Step | Spec | Notes | DoD |
|---|---|---|---|---|
| 2.1 | Storefront shell | ST-01, ST-02, ST-03 | `(storefront)` layout: announcement bar, contact strip, header, nav + mega menu, footer, mobile sheet nav | Config-driven; mobile nav excellent at 360 px; cart/wishlist icons render (counts stubbed 0) |
| 2.2 | Catalog query layer | ST-06 dep | `src/lib/catalog/query.ts`: one composable builder — filters, sort, pagination, facet counts; + `ProductCardData` mapper | All PLP filter combos expressible; unit-sanity file exercising main combos against seed data |
| 2.3 | Product card | ST-05 | `src/components/storefront/product-card.tsx` | Matches spec incl. hover-swap, deal badge, struck pricing, stock states |
| 2.4 | PLP | ST-06 | `/products` + shared `<ProductListing>` used by brand/collection/search | URL-param filters SSR-rendered; sidebar (desktop) + sheet (mobile); chips; sort; pagination; zero-state |
| 2.5 ∥ | Brand pages | ST-12 | `/brands`, `/brands/[slug]` | A–Z index; brand hero + scoped PLP |
| 2.6 ∥ | Collections | ST-13 | `/c/[slug]` | `filter_json` pre-applied, refinable |
| 2.7 | PDP | ST-07 | Gallery+lightbox, buy box (variant selector, price stack, stock, delivery promise, trust block), notes pyramid, spec table, related products | Complete per spec except Add-to-cart button (disabled w/ tooltip "Phase 3") |
| 2.8 | Search v1 | ST-08 | `/search` on PLP layout | Name/brand/description matching, ranked brand-name hits first |
| 2.9 ∥ | Static pages | ST-15 | `/pages/[slug]` markdown | Seeded pages render; footer auto-links |
| 2.10 | Homepage | ST-04 | All 7 section types from seeded `homepage_sections` | Homepage demos like a real deal-driven store; Lighthouse perf ≥ 85 mobile on seeded data |
| 2.11 | SEO base | ST-16 | metadata, sitemap, robots, JSON-LD, 404/error/loading | Valid Product JSON-LD on PDP (test with validator); sitemap lists all public URLs |

**Gate 2:** clean clone → seeded store fully browsable on phone & desktop;
every ST-01…08/12/13/15 acceptance criterion checked; build green.

---

## Phase 3 — Cart, checkout & ordering

Implemented on 2026-09-20. See [verification record](PHASE_3_VERIFICATION.md) for automated and browser evidence, plus remaining physical-device and live-provider checks.

**Goal:** a shopper can order; the team gets notified. The template becomes usable
for a real business.
**Covers:** ST-09, ST-10, ST-11, PF-05 (notify), PF-09 (checkout parts).

| # | Step | Spec | Notes | DoD |
|---|---|---|---|---|
| 3.1 | Cart state | ST-09 | Provider + `useCart()` + localStorage sync + server revalidation action | Survives refresh; price/stock drift surfaced; header count live |
| 3.2 | Cart UI | ST-09 | Drawer + `/cart` page + free-delivery progress bar | Empty/filled states; qty capped at stock |
| 3.3 | Checkout page | ST-10 | Form w/ zod client+server validation; zones & payment methods from config; bKash TrxID flow | Invalid BD phone blocked inline; fee updates live; config-disabled methods absent |
| 3.4 | Order creation action | ST-10, PF-09 | Server Action: revalidate cart → upsert customer (blocked check) → order + items + event → notify → redirect | Prices always from DB; concurrent stock safety (transaction); honeypot + rate limit; cart cleared only on success |
| 3.5 ∥ | Notification adapters | PF-05 | `src/lib/notify/{index,console,resend,telegram}.ts` | Console default prints rich order summary; telegram/resend work when env set; failures never break checkout |
| 3.6 | Confirmation + tracking | ST-11 | Confirmation page + `/track-order` | Timeline from order_events; requires phone AND order number; rate-limited |

**Gate 3:** end-to-end on a phone: browse → filter → PDP → cart → checkout
(COD and bKash-TrxID) → confirmation → track-order shows pending; console
notification printed; stock untouched until confirmation (verify in studio).

---

## Phase 4 — Admin panel

**Goal:** the team runs the whole business from `/admin`.
**Covers:** AD-01…AD-11, PF-05 (storage), remaining PF-09.

| # | Step | Spec | Notes | DoD |
|---|---|---|---|---|
| 4.1 | Auth + shell | AD-01 | Better Auth credentials; middleware guard; sidebar layout w/ pending badge | Unauthed redirect; seeded admin logs in; logout |
| 4.2 | Orders list | AD-03 | Status tabs w/ counts, filters, search | Finds order by phone fragment; tabs correct |
| 4.3 | Order detail / ticket | AD-04 | Transition buttons (legal only), cancel-reason, ship prompt, payment-verify, timeline + note/call composer | Stock decrements once on confirm; restores on post-confirm cancel/return; all mutations in timeline |
| 4.4 | Dashboard | AD-02 | Stat cards + call queue + activity feed | Queue ordered oldest-first; tel: links work |
| 4.5 | Storage adapter + uploads | PF-05 | local + s3 impls; `/api/uploads` w/ validation; client resize→WebP | Upload works with zero env (local) and with R2 creds (s3) |
| 4.6 | Products list + editor | AD-05, AD-06 | 4-tab editor; variants inline table; images sortable; notes pickers | Create a full product from scratch in admin → appears correctly on storefront incl. filters |
| 4.7 ∥ | Brands & taxonomy | AD-07 | CRUD + collection filter-builder UI | Delete-guard when products exist |
| 4.8 ∥ | Banners & homepage | AD-08 | Placement tabs; homepage section manager w/ drag-sort | Reordering sections reorders homepage |
| 4.9 ∥ | Customers | AD-09 | List w/ cancelled-count signal; detail; block toggle | Blocked customer's checkout politely rejected |
| 4.10 ∥ | Static pages admin | AD-10 | Markdown editor w/ preview | Edits render on storefront |
| 4.11 | Settings & diagnostics | AD-11 | Config viewer + adapter status + test notification | Test button fires active adapter |

**Gate 4:** full business simulation without touching code or DB directly:
add brand → add product w/ images → shopper orders it → notification →
confirm (stock drops) → pack → ship (courier id) → deliver; then a second
order cancelled with reason. All admin pages usable at 360 px.

---

## Phase 5 — Merchandising & community (v2 features)

**Covers:** ST-17, ST-18, ST-08 autosuggest, ST-14, AD-12, AD-13.

| # | Step | Spec | DoD |
|---|---|---|---|
| 5.1 | Coupons | ST-18, AD-12 | Percent + fixed; all validity rules; usage counting; admin CRUD; "after coupon" price display on cart/checkout |
| 5.2 | Reviews | ST-17, AD-13 | Submit → pending → moderate → approved renders w/ distribution bars + verified badge; aggregates on cards optional |
| 5.3 ∥ | Search autosuggest | ST-08 | Debounced dropdown, products + brands, keyboard nav |
| 5.4 ∥ | Wishlist + recently viewed | ST-14 | Flag-gated; `/wishlist` page; PDP recently-viewed strip |
| 5.5 | Flag audit | §3.7 | Toggling each `features.*` flag off removes the feature everywhere without errors |

**Gate 5:** all v2 features on in seed demo; flag-off audit passes; build green.

---

## Phase 6 — Open-source release

**Covers:** PF-08, PF-09 audit, final polish.

| # | Step | DoD |
|---|---|---|
| 6.1 | Security & hardening audit | Walk PF-09 checklist; every Server Action verifies session where required; rate limits in place; upload validation |
| 6.2 | Performance pass | Lighthouse mobile ≥ 85 on home/PLP/PDP (seeded); images sized; DB indexes verified against slow-query check |
| 6.3 | README + deploy guides | Quickstart (zero-account local), Vercel+Neon button walkthrough (with Hobby-tier non-commercial warning), R2 + Telegram + Resend guides, Docker file + guide, FAQ, screenshots/GIF |
| 6.4 | AGENTS.md final sync | File map, invariants, "how to add a filter/section/adapter" recipes verified against final code |
| 6.5 | CI + license + community files | GitHub Actions (lint/typecheck/build), MIT LICENSE, CONTRIBUTING.md, issue templates, `db:seed` smoke test in CI |
| 6.6 | Release | Tag v0.1.0; deploy public demo store; README badges/links |

**Gate 6 (ship):** a stranger can fork → deploy → rebrand via `store.config.ts` →
take a real order, following README alone, spending ৳0.

---

## Phase 7 — Public demo with sandboxed admin

**Covers:** a public showcase deployment where visitors can use the real admin
panel without changing what anyone else sees. **Done 2026-09-27** and live;
decisions, deviations and evidence in `docs/PHASE_7_VERIFICATION.md`.

**Goal:** a visitor clicks "Try the admin", gets a private copy of the demo
store that expires on its own, and can edit products, confirm orders, change
the homepage and place orders. Their changes show up in both the admin and the
storefront **for them only**. Everyone else keeps seeing the pristine demo.

**Approach: one Postgres schema per visitor.** Store tables resolve through
`search_path`, so a sandbox is a copy of the store tables in schema
`demo_<id>`. Requests carrying that visitor's sandbox cookie run with
`search_path = demo_<id>, public`. Auth, sessions and rate-limit tables are
never copied, so they keep resolving to `public`. All of it sits behind
`DEMO_MODE=true`. With the flag off (every real store), the code path is
identical to today, and a test proves it.

| # | Step | DoD |
|---|---|---|
| 7.1 | Demo mode switch and role | `DEMO_MODE` in `env.ts` (off by default, production-only allowed on a dedicated deployment); a `demo` user role that `requireAdmin()` accepts only when demo mode is on; `adminSession` still rejects `demo` users when it's off (test) |
| 7.2 | Sandbox lifecycle | `createSandbox()`: `CREATE SCHEMA demo_<id>`, copy the store tables (structure + rows) from a pristine template schema in one transaction (target < 1 s on Neon); `dropSandbox()`; a cap on live sandboxes (e.g. 50) with oldest-first eviction; TTL (default 2 h) stored with the demo user |
| 7.3 | Per-request database routing | `src/db/index.ts` resolves the client per request: default client unless the request has a valid, unexpired sandbox cookie bound to a demo session; sandbox clients use the Neon **direct** (non-pooled) URL with `search_path` set, `max: 1`, LRU-closed. Scripts, migrations and non-demo requests are untouched. Tests: two sandboxes can't see each other's writes, and the public schema never changes |
| 7.4 | "Try the admin" flow | `/demo` page (only when `DEMO_MODE`): one click creates a demo user (`demo-<id>@demo.invalid` + random password), a sandbox, and a signed-in session, then lands on `/admin`. It also shows the generated email/password and expiry, so the visitor can sign in again from another device before it expires. Rate limited per IP (e.g. 3 per hour). A banner across admin and storefront shows "Demo sandbox: expires in 1 h 42 m · Reset · End" |
| 7.5 | Demo-safe side effects | notifications forced to `console`; uploads stored inside the sandbox (a small `sandbox_uploads` bytea table served by `/uploads/[key]`), so no R2 is needed and nothing outlives the sandbox; "send test notification" disabled; the search-suggest `Cache-Control` becomes `private` for sandbox requests, so the CDN can't serve one visitor's data to another; outbound links in pages and banners stay as typed but render `rel="nofollow ugc"` in demo mode |
| 7.6 | Cleanup | expired sandboxes and demo users are dropped lazily on each new `/demo` request, plus a daily Vercel Cron job (Hobby allows one run a day) as a backstop; a pristine-template check re-seeds `public` if its fingerprint drifts |
| 7.7 | Deploy the public demo | Vercel + Neon demo project (non-commercial, so Hobby is fine), `DEMO_MODE=true`, README "Live demo" link and "Try the admin" button; the maintainer's own admin account stays a normal `admin` user |
| 7.8 | Showcase | README gallery refreshed from the live demo; optional short GIF of the order → confirm → ship flow |

**Gate 7:** two visitors in separate browsers each start a sandbox, edit the
same product and place orders. Each sees only their own changes in admin and
storefront, a third anonymous visitor sees neither, and both sandboxes and
demo users are gone after the TTL. With `DEMO_MODE` off, the full Phase 6 gate
passes unchanged and `/demo` returns 404.

**Decisions to make at the start of Phase 7:**

1. **Self-serve vs issued access.** Self-serve one-click (recommended for a
   showcase: no waiting, no email) or owner-issued credentials generated from
   the real admin for specific people. The plan supports self-serve, with the
   credentials shown to the visitor. Owner-issued is a small extra page.
2. **TTL and cap.** 2 hours and 50 live sandboxes fit comfortably in Neon's
   free storage (a seeded sandbox is well under 1 MB).
3. **Fallback if per-request routing proves too risky:** a read-only demo
   admin whose saves are validated and then rolled back ("Saved in demo mode,
   not stored"). Much simpler, but visitors don't see their changes persist.

**Risks:** the per-request client (7.3) touches the one module every query
goes through. It must be a no-op when demo mode is off and covered by tests
before anything else lands. Neon's pooled connections may reject a
`search_path` startup parameter, hence the direct URL with tiny per-sandbox
pools. Cold starts on Vercel add sandbox-creation latency on first use only.

---

## Post-v1 backlog (explicitly deferred)

Bengali localization (next-intl), courier adapters (Pathao/Steadfast/RedX),
SMS adapter (BulkSMS BD), payment gateway adapters (bKash Merchant API,
SSLCommerz), sales analytics dashboard, inventory purchase orders, gift-set
bundle builder, multi-admin roles, image CDN transforms, Meilisearch adapter.

## Suggested AI-agent parallelization

Steps marked ∥ are safe to delegate to parallel agents (disjoint write sets).
Good splits: Phase 2 → one agent on shell+homepage (2.1, 2.10), one on
catalog+PLP (2.2–2.4), one on PDP (2.7); Phase 4 → orders track (4.2–4.4) vs
catalog track (4.5–4.7) vs content track (4.8, 4.10). Merge points are the
phase gates. Shared contracts (`ProductCardData`, catalog query API, schema)
must land before fan-out.
