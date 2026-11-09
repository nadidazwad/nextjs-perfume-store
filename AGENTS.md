# Attar

Open-source perfume store template: a storefront plus admin panel for phone-confirmed orders in Bangladesh-style markets, deployable entirely on free tiers.

- `docs/SPEC.md` is the contract: data model (§4) and the ST-*, AD-* and PF-* tasks with acceptance criteria.
- `CONTRIBUTING.md` has the commands, directory map and recipes. Follow the matching recipe when you rebrand, build admin UI, add a filter, homepage section, notification adapter or feature flag, change the schema, or touch coupons, reviews or the wishlist.
- `store.config.ts` holds store branding and behaviour, `.env.example` every env var, `docs/deploy/` the hosting guides, and `docs/DESIGN_SYSTEM.md` the UI rules.
- Mutations are Server Actions; `src/app/api/` is only auth, uploads, search and the demo-cleanup cron. Import `db` from `src/db/index.ts`, take validated settings from `src/lib/env.ts` (server only), and leave `src/components/ui/` (generated shadcn) as it is.
- For schema changes use `pnpm db:generate` then `pnpm db:migrate`: `pnpm db:push` reports phantom diffs on an existing PGlite database.

## Invariants

1. Money is integers in currency minor units, formatted only by `formatMoney()`.
2. The storefront needs no login: customers are identified by normalized phone number. Do not add customer auth.
3. Every integration is an adapter with a free local default (PGlite, console, local disk) and degrades gracefully when its provider fails, so no paid service becomes required.
4. Order status changes go through `src/lib/orders/transitions.ts` and write an `order_events` row. Never write `orders.status` directly; lint catches the literal `.set({ status })` form in `src/`.
5. Checkout re-validates everything on the server: prices and stock come from the DB, never the client payload.
6. A feature flag in `store.config.ts` gates its UI, routes and queries completely.
7. Store name, phone, currency, zones, payment methods and theme colours come from `store.config.ts`.
8. Mobile first: target 360 px. Shoppers are on Android and admins run shops from phones.
9. Seed data stays fictional, with no real perfume brands or photos (trademark risk in an OSS repo).
10. Server Components by default; `"use client"` only where interaction demands it.
11. Server Actions and routes parse every argument with Zod (`.max()` on strings and arrays) and rate-limit customer-data writes and lookups with `takeRateLimit`. Admin actions start with `await requireAdmin()`; `tests/admin.test.ts` enforces that and flags new `"use server"` modules.
12. Logs carry no customer names, phones, addresses or request payloads; `logging.serverFunctions` stays off.
13. Storefront bundles stay free of Zod: client code may import `store.config.ts` and `catalog/labels.ts`, and `import()` a schema lazily if a form needs one. Lint requires `z` from `@/lib/zod`.
14. Every new table goes in `sandboxTables` or `publicOnlyTables` in `schema.ts` (`tests/sandbox.test.ts` enforces it), and code reading auth or rate-limit tables uses `publicDb`. With `DEMO_MODE` off, stores behave exactly as before.

## Done

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` green, `pnpm db:seed` still idempotent, affected pages checked at 360 px and desktop, and the relevant acceptance criteria in `docs/SPEC.md` met. `pnpm build` and `pnpm dev` share `.next`, so stop dev before building, and delete a leftover `.data/pglite/postmaster.pid` if dev was killed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
