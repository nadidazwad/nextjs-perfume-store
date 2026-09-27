# AGENTS.md — Instructions for AI agents working on Attar

Attar is an open-source perfume e-commerce template: a Jomashop-style storefront
plus an admin panel, built for manual (phone-confirmed) order fulfillment in
Bangladesh-style markets, deployable entirely on free tiers.

## Read these first

| Document | Purpose |
|---|---|
| `docs/SPEC.md` | **The contract.** Full feature spec: data model (§4), storefront tasks ST-*, admin tasks AD-*, platform tasks PF-*, with acceptance criteria |
| `docs/IMPLEMENTATION_PLAN.md` | Build order: phases, steps, gates. Find the current phase before writing code |
| `docs/research/jomashop-findings.md` | UX reference: what Jomashop does and how we adapt it |
| `store.config.ts` | All store branding/behavior. Retailers edit this, not components |
| `.env.example` | Every env var, documented. Validation in `src/lib/env.ts` |
| `docs/deploy/*.md` | Vercel + Neon, Docker, storage (R2/S3), notifications (Telegram/Resend), public demo (`DEMO_MODE`) |
| `docs/PHASE_6_VERIFICATION.md` | Security, performance and release verification |
| `docs/PHASE_7_VERIFICATION.md` | Public demo with sandboxed admin (`DEMO_MODE`): design, tests, live checks |

## Stack

Next.js (App Router, TypeScript, `src/` dir) · Tailwind v4 + shadcn/ui ·
Drizzle ORM (Postgres dialect; embedded PGlite when `DATABASE_URL` unset,
postgres.js otherwise — see `src/db/index.ts`) · Better Auth (admin only) · Zod.
Package manager: **pnpm**.

## Commands

```bash
pnpm dev          # start dev server (works with NO .env file at all)
pnpm build        # production build — must stay green
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # node:test suites in tests/ (DB tests use a throwaway PGlite;
                  # demo sandbox tests need TEST_POSTGRES_URL, else they skip)
pnpm db:generate  # generate a SQL migration from schema.ts changes
pnpm db:migrate   # apply migrations: PGlite locally, DATABASE_URL otherwise
pnpm db:seed      # idempotent demo seed + admin user; --admin-only (or
                  # SEED_DEMO_DATA=false) seeds just the admin
pnpm catalog:verify  # checks listings/facets against a brute-force matcher
pnpm db:studio    # Drizzle Studio
```

`pnpm db:push` exists but is unreliable on an existing PGlite database
(drizzle-kit reports phantom diffs, then fails). Use generate + migrate.

## Directory map

```
store.config.ts              Store configuration (Zod-validated, typed)
drizzle.config.ts            Drizzle Kit config (auto PGlite/Postgres)
src/
  app/
    (storefront)/            Public shop: /, /products, /products/[slug],
                             /brands, /c/[slug], /search, /cart, /checkout,
                             /order/confirmed/[n], /track-order, /wishlist,
                             /pages/[slug]
    admin/                   Admin panel (Better Auth protected); admin.css
    globals.css              Tailwind + shadcn theme base only
    storefront.css           Storefront design system (tokens at top)
    commerce.css             Cart / checkout / order tracking
    api/                     auth catch-all, uploads, search/suggest ONLY
                             (all other mutations are Server Actions)
    uploads/[key]/route.ts   serves local-adapter images from .data/uploads
                             (production ignores files added to public/)
    robots.ts sitemap.ts     rendered per request (URL comes from runtime env)
    admin/(panel)/coupons    AD-12 coupon CRUD (404 when features.coupons off)
    admin/(panel)/reviews    AD-13 moderation queue (404 when features.reviews off)
  components/
    ui/                      shadcn primitives — do not hand-edit
    storefront/              storefront components (product-card, listing…);
                             ui.tsx = Breadcrumbs, SectionHead, Stars
                             nav.tsx  header rail, mega menus, phone menu
                             quick-add.tsx  card "add this size" button
                             search-suggest.tsx  header combobox (ST-08)
                             product-reviews.tsx + review-form.tsx (ST-17)
                             saved-products.ts   localStorage wishlist/recent
                             wishlist.tsx, recently-viewed.tsx (ST-14)
    demo/                    demo bar + /demo controls (DEMO_MODE only)
    admin/                   admin components; ui.tsx (PageHeader, Panel,
                             StatusBadge…), fields.tsx (ImageField, Switch,
                             Chips, ConfirmButton), combobox.tsx,
                             coupon-editor.tsx, review-queue.tsx
  db/
    schema.ts                All tables (spec: docs/SPEC.md §4)
    index.ts                 db client — ALWAYS import { db } from here;
                             publicDb = never sandbox-routed (auth, rate limits)
    sandbox-router.ts        DEMO_MODE only: routes db per request to a sandbox
    seed.ts                  demo seed (seed-data.ts, seed-assets.ts)
    migrations/              generated SQL, committed; applied by db:migrate
  lib/
    env.ts                   validated env — server only, never in client code
    rate-limit.ts            takeRateLimit (Postgres-backed when DATABASE_URL
                             is set, memory on PGlite), clientIp, and Better
                             Auth's sign-in limiter storage
    admin/                   actions.ts (every export starts with
                             requireAdmin()), schema.ts (Zod), session.ts
    money.ts phone.ts slug.ts id.ts        pure utilities
    orders/transitions.ts    order status state machine (§4.3)
    catalog/params.ts        URL params schema (Zod) + parseCatalogParams
    catalog/labels.ts        display labels; Zod-free, safe for client code
    catalog/query.ts         the ONE composable product query builder
                             (+ getFacets, getCardsByIds, searchSuggestions)
    catalog/verify.ts        `pnpm catalog:verify` reference matcher
    coupons/rules.ts         pure coupon validation + discount math (tested)
    coupons/server.ts        checkCoupon / redeemCoupon (DB, flag-gated)
    reviews/                 schema (input + summary), server (verified
                             purchase, PDP data, card ratings), actions
    notify/                  console | resend | telegram adapters
    demo/                    DEMO_MODE public demo: sandbox lifecycle, signed
                             cookie, actions (start/reset/end/resume), uploads
    storage/                 local (.data/uploads) | s3 (R2-compatible)
  proxy.ts                   per-request CSP script nonce (lib/csp.ts), admin
                             cookie redirect, flag-off 404s
tests/                       node:test suites (pnpm test)
scripts/                     vercel-build.sh (migrate+seed on production
                             deploys only), verify-storefront.mjs (smoke)
docs/                        spec, plan, research, deploy guides, screenshots
public/seed/                 fictional seed images
Dockerfile compose.yaml      self-hosting (docs/deploy/docker.md)
vercel.json                  points Vercel at scripts/vercel-build.sh
.github/                     CI workflow, issue/PR templates, Dependabot
```

## Invariants — never violate

1. **Money is integers** in currency minor units. Format only via
   `formatMoney()`. Never floats, never format inline.
2. **Storefront requires no login.** Customers are identified by normalized
   phone number. Do not add customer auth.
3. **No paid/external service may become required.** Every adapter keeps a
   local default (PGlite, console, local disk). New integrations must follow
   the adapter pattern with graceful degradation.
4. **Order status changes go through `src/lib/orders/transitions.ts`** and
   write an `order_events` row. Never `update orders set status` directly.
5. **Checkout re-validates everything server-side.** Prices and stock always
   come from the DB, never from the client payload.
6. **Feature flags (`store.config.ts → features`)** must fully gate their
   feature: UI, routes, and queries.
7. **Config over hardcoding.** Store name, phone, currency, zones, payment
   methods, theme colors come from `store.config.ts`.
8. **Mobile-first.** Target 360 px width first. BD shoppers are on Android;
   admins run shops from phones.
9. **Seed data stays fictional** — no real perfume brand names or photos
   (trademark risk in an OSS repo).
10. **Server Components by default**; `"use client"` only where interaction
    demands it.
11. **Every public entry point validates and limits.** A Server Action or
    route treats every argument as untrusted, parses it with Zod (with
    `.max()` on strings and arrays), and rate-limits with `takeRateLimit` from `src/lib/rate-limit.ts`
    if it writes or looks up customer data. Admin actions start with
    `await requireAdmin()`. `tests/admin.test.ts` fails if an admin export
    skips it or a new `"use server"` module appears unreviewed.
12. **No PII in logs.** Never log customer names, phones, addresses or
    request payloads. `logging.serverFunctions` stays off; the console
    notifier redacts in production.
13. **Keep Zod out of storefront bundles.** Client components may import
    `store.config.ts` (its schema is a function) and `catalog/labels.ts`,
    not `catalog/params.ts` or other schema modules. Load a schema lazily
    (`import()`) if a client form needs it. Import `z` from `@/lib/zod` (lint
    enforces it): it turns off Zod's eval, which the page CSP blocks.
14. **Every new table is classified for demo sandboxes.** Add it to
    `sandboxTables` (store data, copied per visitor) or `publicOnlyTables`
    (auth-like, never copied) in `schema.ts`; `tests/sandbox.test.ts` fails
    otherwise. Code reading auth or rate-limit tables uses `publicDb`.
    With `DEMO_MODE` off, real stores must behave exactly as before.

## Common recipes

- **Rebrand the store**: edit `store.config.ts` only. Colors and corner style
  flow through CSS vars set in the root layout (PF-07). For deeper visual
  changes edit the tokens at the top of `src/app/storefront.css`, not
  individual rules. See `docs/DESIGN_SYSTEM.md`.
- **Build admin UI**: compose `components/admin/ui.tsx` + `fields.tsx`
  primitives and `admin-*` classes; never raw unstyled inputs. Verify at 360 px.
- **Add a PLP filter**: add the field to `catalogParamsSchema` in
  `src/lib/catalog/params.ts` (and to `listKeys` if multi-valued, or to the
  number/boolean coercion lists in `parseCatalogParams`; labels go in
  `labels.ts`); add the predicate to `catalogWhere` (product
  fields) or `variantWhere` (variant fields) in `src/lib/catalog/query.ts`;
  add it to the `groups` list in `getFacets` if it needs counts; add the
  control in `src/components/storefront/filters.tsx`. `catalogHref` threads
  URL params generically. Mirror the predicate in `catalog/verify.ts` and run
  `pnpm catalog:verify`.
- **Add a homepage section type**: add the value to `homepageSectionType` in
  `schema.ts` and run `pnpm db:generate` (it's a Postgres enum); render it in
  `src/components/storefront/homepage.tsx`; in the admin, add it to the
  `homepage` type options and the config form in
  `src/components/admin/entity-editor.tsx`, extending `sectionConfig` in
  `src/lib/admin/schema.ts` for any new config fields.
- **Add a notification adapter**: new file in `src/lib/notify/` implementing
  `NotificationAdapter` (`types.ts`), register it in the `adapters` map in
  `notify/index.ts`, extend the `NOTIFY_ADAPTER` enum and its required-vars
  check in `src/lib/env.ts`, document it in `.env.example` and
  `docs/deploy/notifications.md`. Never log provider responses.
- **Schema change**: edit `src/db/schema.ts` → `pnpm db:generate` (commit the
  new file in `src/db/migrations/`) → `pnpm db:migrate` → update
  `src/db/seed.ts` if the shape affects seeded data. A new table also goes into `sandboxTables` or
  `publicOnlyTables` (invariant 14). Vercel production
  deploys and the Docker `setup` service apply migrations automatically.

- **Coupons**: rules live in `src/lib/coupons/rules.ts` (pure). The cart
  quote (`revalidateCart`) and checkout (`createOrder`) both call
  `checkCoupon`; checkout locks the coupon row and `redeemCoupon` increments
  `usedCount` with a guarded UPDATE inside the order transaction. The client
  sends the code *and* the discount it displayed; a mismatch aborts the order.
  Free delivery is measured on the subtotal after the discount.
- **Reviews**: guests submit via `submitReview` (lands `pending`). "Verified
  purchase" = the phone has a *delivered* order containing any size of the
  product (`hasDeliveredPurchase`), re-checked when an admin approves.
  Phones are never shown on the storefront.
- **Wishlist / recently viewed**: IDs only, in localStorage (`attar-wishlist-v1`,
  `attar-recent-v1`) via `saved-products.ts`; cards are fetched with the
  `loadSavedProducts` Server Action, which refuses when the flag is off and
  lets the client prune IDs whose products disappeared.
- **Add a feature flag**: add it to `features` in `store.config.ts`, then gate
  (1) UI, (2) the route with `notFound()`, (3) queries/actions (return early),
  (4) the admin nav entry in `components/admin/navigation.tsx`. Verify with
  the flag off: pages load, route 404s, no console errors.

## Definition of done, always

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (CI runs the
same, plus a migrate + seed + seed-again smoke test on PGlite), seed still
runs (`pnpm db:seed` idempotent), affected pages verified at 360 px and
desktop, and the relevant acceptance criteria in `docs/SPEC.md` are met.
Never run `pnpm build` while `pnpm dev` is running: they share `.next`.
If dev was killed, delete a leftover `.data/pglite/postmaster.pid`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
