# Contributing to Attar

Thanks for helping. Attar is a template that small shops fork and run
themselves, so changes should keep it simple to deploy, free to run, and easy
to rebrand.

## Set up

You need Node.js 22 or newer and pnpm (`corepack enable`). No accounts and no
`.env` file:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev          # http://localhost:3000, admin at /admin (admin@example.com / admin1234)
```

## Before you start

- Read [`AGENTS.md`](AGENTS.md) for the invariants. The commands, directory map
  and step-by-step recipes (add a filter, a homepage section, a notification
  adapter, a feature flag) are further down this page.
- Features are specified in [`docs/SPEC.md`](docs/SPEC.md). For anything
  bigger than a fix, open an issue first so we can agree on the approach.
- UI work follows [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). Design
  for 360 px first.

The invariants that reviews check most often:

- Money is an integer in minor units, formatted only with `formatMoney()`.
- Customers never log in. They're identified by phone number.
- No paid service becomes required. Integrations are adapters with a free
  local default.
- Feature flags in `store.config.ts` gate the UI, the route and the queries.
- Server Actions and routes validate input with Zod, cap lengths, and
  rate-limit anything public. Admin actions start with `requireAdmin()`.
- Seed data stays fictional: no real brand names or product photos.

## Making a change

1. Create a branch.
2. If you change `src/db/schema.ts`, run `pnpm db:generate` and commit the new
   migration, then `pnpm db:migrate`.
3. Add or update tests in `tests/` for logic changes. They run on an embedded
   database, so no setup is needed.
4. Run everything CI runs:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```

   Don't run `pnpm build` while `pnpm dev` is running.
5. Check the pages you touched at 360 px and on desktop. Attach screenshots to
   the pull request for UI changes.

## Pull requests

Keep them focused: one change per pull request is easier to review and
revert. Describe what changed and why, and how you checked it. The template
has a short checklist.

## Commands

```bash
pnpm dev          # start dev server (works with NO .env file at all); to test
                  # on a phone, open http://<this machine's LAN IP>:3000 on
                  # the same Wi-Fi (dev allows its own private IPs:
                  # src/lib/dev-origins.ts)
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

## Where things live

Next.js (App Router, TypeScript, `src/` dir) · Tailwind v4 + shadcn/ui ·
Drizzle ORM (Postgres dialect; embedded PGlite when `DATABASE_URL` unset,
postgres.js otherwise — see `src/db/index.ts`) · Better Auth (admin only) · Zod.

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
    app-shell.css            Phone-only (≤760px) app shell: tab bar, nav bar,
                             bottom sheets, page transitions
    (storefront)/template.tsx  View-transition wrapper (push/pop on phones)
    manifest.ts apple-icon.tsx pwa-icon/  home-screen install
    api/                     auth catch-all, uploads, search/suggest, demo-cleanup
                             cron ONLY (all other mutations are Server Actions)
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
                             app-shell.tsx  phone tab bar, back button,
                             collapsing title, added-to-bag toast
                             sheet-drag.tsx drag-to-dismiss bottom sheets
                             device.ts      usePhone, haptic
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

Release checks are in `docs/PHASE_6_VERIFICATION.md` (security, performance,
release) and `docs/PHASE_7_VERIFICATION.md` (public demo with sandboxed admin).

## Recipes

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

## Reporting bugs and security issues

Use the bug report template for bugs. Report security problems privately (see
[`SECURITY.md`](SECURITY.md)).

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
