# Phase 6 verification (2026-09-27)

Open-source release: security audit (6.1, PF-09), performance (6.2),
README and deploy guides (6.3, PF-08), AGENTS.md sync (6.4), CI and community
files (6.5). Release (6.6) is prepared locally and waits on the maintainer:
see [Release checklist](#release-checklist-66).

## Automated gates

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` | clean. `typecheck` now runs `next typegen` first, so it works in a fresh clone (it failed there before; see 6.5) |
| `pnpm test` | 54/54 (was 44). New: shared rate limiter (memory expiry, flood eviction, atomic Postgres counting, hashed keys, client IP), admin sign-in rate limit, every admin action starts with `requireAdmin()`, the set of `"use server"` modules is reviewed, redacted order alerts, production URL validation, store config validation, S3 adapter signing, local upload serving |
| `pnpm build` | green with no `.env` and no database |
| `pnpm db:migrate` → `db:seed` ×2 → `verify-seed.ts` | passed; the second seed is a no-op |
| `pnpm catalog:verify` | passed on the demo seed **and** on a 20,000-product catalog. It now checks every facet group's counts against the listing total and compares totals, not just the first page |
| `node scripts/verify-storefront.mjs` | passed on the production build (61 sitemap URLs) |
| CI dry run | the workflow's steps replayed verbatim in a fresh copy of the repo: passed |

## 6.1 Security and hardening (PF-09)

Method: every Server Action (5 modules, 18 exports), both API routes
(`/api/uploads`, `/api/search/suggest`), the auth route and the upload path
were read against the PF-09 list, and each fix was then checked on a
production build (`next start` against Postgres 17 in a container).

| PF-09 item | Before | Now | Checked by |
|---|---|---|---|
| Server re-validates price and stock at checkout | in place (row locks, DB prices, coupon re-check, discount match) | unchanged | existing checkout tests |
| Rate limits on checkout, tracking and reviews | per-process memory only (per instance on serverless); a full store (10,000 keys) **refused every new visitor**; client IP taken from the spoofable first `X-Forwarded-For` hop | `src/lib/rate-limit.ts`: one atomic `INSERT … ON CONFLICT` per check in a new `rate_limits` table when `DATABASE_URL` is set, memory on PGlite, falls back to memory if the DB errors; keys are SHA-256 hashes (no raw IPs or phones stored); full memory store evicts the oldest window; IP is the last (proxy-appended) hop | tests; production: 11th tracking lookup for one phone refused, `rate_limits` holds only hashes |
| Admin sign-in brute force | Better Auth 5/min, per instance | same limits, stored through the shared limiter (`customStorage`) | test (6th bad password → 429); production: `401 ×5, 429` |
| Blocked customers rejected | in place | unchanged | existing test |
| Input length caps | storefront schemas capped; admin actions took **unvalidated `id` arguments** (8 actions) and uncapped ID lists | shared `idSchema` (1–100 chars) on every admin `id`/ID list | typecheck + tests |
| Upload MIME and size validation | in place (session, origin, rate limit, 5 MB streaming cap, sharp format sniff, re-encode) | unchanged | production: no session 401, wrong origin 403, spoofed PNG 400, 6 MB 413 |
| Admin mutations verify the session | all 13 admin actions call `requireAdmin()` | plus a test that fails if an export doesn't start with it (mutation-tested) or a new `"use server"` module appears | test |
| No PII in logs beyond what admins need | the default console notifier printed **name, phone, address and TrxID into production logs** | in production the console adapter logs only item count, total, payment method and the admin link; full text in dev and via Telegram/Resend | test; production log inspected after a real checkout |

Also fixed:

- **Seeding a real database with the demo admin** (`admin@example.com` /
  `admin1234`) only warned, and only when `NODE_ENV=production`. It now
  refuses whenever `DATABASE_URL` is set. That also fails a Vercel production
  deploy that forgot `ADMIN_EMAIL`/`ADMIN_PASSWORD`, with the reason.
- **`NEXT_PUBLIC_APP_URL` unset or `http://` in production** silently fell
  back to `http://localhost:3000`. That meant admin cookies without `Secure`
  and an upload origin check that could never pass. Production now requires
  it, over https (localhost excepted, for local Docker tests). Checked: the
  session cookie is `HttpOnly; SameSite=Lax`; Better Auth adds `Secure` and
  the `__Secure-` prefix for an https base URL.
- **Security headers:** none were set. Every response now has `nosniff`,
  `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, and a
  CSP limited to `frame-ancestors`, `base-uri`, `form-action` and
  `object-src`. `X-Powered-By` is removed.

## 6.2 Performance

### Lighthouse (mobile, seeded demo, production build, median of 3 runs)

| Page | Before | After fetchPriority | After removing the skeleton | Final (also Zod out of bundles) |
|---|---|---|---|---|
| Home | 87 · LCP 3.79 s · TBT 141 ms | 88 | 93 | **95** · LCP 3.01 s · TBT 37 ms |
| PLP `/products` | 89 · LCP 3.66 s · TBT 82 ms | 89 | 94 | **95** · LCP 3.01 s · TBT 32 ms |
| PDP | 91 · LCP 3.50 s · TBT 83 ms | 91 | 94 | **95** · LCP 2.94 s · TBT 33 ms |

Accessibility 95–97, best practices 100, SEO 100 on all three. CLS 0.

Target ≥ 85: met. The spec's NFR is *LCP < 2.5 s on mid-range Android over
4G*. Lighthouse's default profile is slower than that (1.6 Mbps, 150 ms RTT).
With a typical 4G profile (9 Mbps, 100 ms RTT, 4× CPU slowdown): home 1.12 s,
PLP 1.21 s, PDP 1.12 s, all scoring 100.

What changed:

1. **The storefront `loading.tsx` skeleton was the main LCP cost.** Pages
   streamed a skeleton and swapped the real content in later, so the LCP image
   painted after the JavaScript loaded (observed LCP ≈ 240 ms against
   load ≈ 140 ms), and missing products returned HTTP 200. Removed with the
   maintainer's approval; ST-16 in SPEC.md is amended. Observed LCP now equals
   first paint (~100 ms). Missing products, brands, collections and pages now
   return a real **404**. Cart and checkout keep their skeletons.
2. **LCP images** use `loading="eager"` + `fetchPriority="high"`. Next 16
   deprecates `priority`, which only added a preload with no priority hint.
3. **Zod no longer ships on home, PLP or PDP** (26 KiB gzipped). It came from
   `store.config.ts` (the schema is now a function, validated in
   `next.config.ts`, so a bad config still stops dev and build: checked with
   `primary: "red"`), `catalog/params.ts` (labels moved to a Zod-free
   `labels.ts`), the cart's localStorage check (now a small structural check,
   since the server re-validates anyway), and the review form (its schema
   loads when the dialog opens). Zod now loads only on `/checkout`.

### Database at scale (20,000 products, 40,000 variants, 120,000 note links)

A scale database was generated from the seed, and `auto_explain` logged
every query over 20 ms. Server response time is the median of 5 requests:

| URL | Before | After |
|---|---|---|
| `/products` | 735 ms | 166 ms |
| `/products?note=oud` | 525 ms | 147 ms |
| `/products?size=100-plus&deal=1` | 414 ms | 102 ms |
| `/c/deals` | 741 ms | 189 ms |
| `/search?q=oud` | 351 ms | 117 ms |
| PDP | 257 ms | 81 ms |
| `/brands`, suggest API | 79 ms, 86 ms | 81 ms, 75 ms |

- **Facet queries ran one after another.** The eight facet counts now run
  concurrently.
- **Postgres JIT** spent ~215 ms compiling a 35 ms related-products query
  (the planner overestimates its cost). Migration `0002_disable_jit` turns JIT
  off for the database. On hosts where the app's role can't change database
  settings, it logs a notice and leaves the default (tested with a non-owner
  role).
- **`count(distinct …)`** sorted 114,000 rows to disk for the notes facet.
  Notes and sizes now de-duplicate first (hash aggregate, 240 → 117 ms); the
  other facets drop the redundant `distinct`. Counts are unchanged: checked by
  `catalog:verify` on both catalogs.
- **Index check:** every index the NFR lists exists and the filtered queries
  use them. The GIN index on `to_tsvector('simple', name)` is **not used**:
  search matches `ILIKE '%term%'` across name, brand, description and
  collection. Search is still ~120 ms at 20,000 products. See known limits.

### Checked at 360 px and 1440 px

Home, PLP, PDP and the 404 page: no horizontal overflow, no console errors
(apart from the deliberate 404). Facet counts match listing totals. The bag
survives a reload, and a tampered localStorage bag is discarded. An empty
review submit shows 3 field errors (lazily loaded schema). Client navigation
from home to PLP works without the skeleton.

## 6.3 README, deploy guides, Docker

- `README.md` rewritten: what you get, screenshots (`docs/screenshots/`),
  zero-account quickstart, rebranding, deploy options with the Hobby-tier
  warning, Deploy-to-Vercel button, FAQ.
- Guides in `docs/deploy/`: `vercel-neon.md`, `docker.md`, `storage.md` (R2
  and other S3-compatible hosts), `notifications.md` (Telegram, Resend).
- `vercel.json` + `scripts/vercel-build.sh`: production deploys migrate and
  seed before building; preview deploys only build, so a pull request can't
  migrate the live database. `SEED_DEMO_DATA=false` / `db:seed --admin-only`
  seeds only the admin for a real store.
- `Dockerfile` (standalone output, non-root, `tools` target for
  migrate + seed) and `compose.yaml` (Postgres, one-off setup, app, volumes).

Verified:

| Path | How | Result |
|---|---|---|
| Quickstart | README commands verbatim in a fresh copy, no `.env` | install, migrate, seed, dev; demo admin sign-in; a checkout placed |
| Docker | `podman build` both targets; `podman-compose up` from a fresh copy with only `.env` edited | image 313 MB; setup migrated and seeded; checkout, admin sign-in and image upload worked; the order and the image survived `compose down` / `up` |
| Vercel build script | `VERCEL_ENV` simulated against Postgres | preview: build only; production + demo credentials: fails with the reason; production + `SEED_DEMO_DATA=false`: migrations, admin only (0 products), build |
| Empty store | admin-only seed, then every storefront and admin page | all render; no error boundaries |
| S3 adapter | real uploads against RustFS, an S3-compatible server that enforces SigV4 | signed upload, anonymous public read (bytes match), delete, idempotent delete, traversal key refused, wrong secret rejected |

Bugs found and fixed while testing the guides:

- **Uploaded images 404'd in every production deployment.** Next only
  serves `public/` files that existed at build time, and the local adapter
  wrote to `public/uploads`. Uploads now go to `.data/uploads` and are served
  by `src/app/uploads/[key]/route.ts` (key regex, immutable caching). Tested
  in a unit test, on `next start`, and in Docker.
- **`robots.txt` was prerendered** with the build-time URL, so Docker images
  pointed crawlers at `localhost:3000`. It now renders per request.
- **`db:push` fails on an existing PGlite database**: drizzle-kit reports two
  phantom diffs (an array default and a composite key), then sends several
  statements in one prepared statement. The docs now use
  `db:generate` + `db:migrate` throughout, which the tests already used.
- Re-running migrations printed raw `NOTICE` objects. Notices are now one
  line, and the expected "already exists, skipping" ones are silent.

## 6.4 AGENTS.md

Every path in the file map was checked for existence (all present), and every
named symbol too. Updated: commands (`test`, `catalog:verify`,
`db:seed --admin-only`, the `db:push` caveat), the file map (rate limiter,
labels, uploads route, deploy files, `.github/`, tests, scripts), three new
invariants (validate + limit every public entry point, no PII in logs, keep
Zod out of storefront bundles), and four recipes that had drifted: the PLP
filter (schema lives in `params.ts`; facet groups, number/boolean coercion
and the verify matcher were missing), homepage section (admin editor
location, enum migration), notification adapter (env conditional check,
deploy guide), schema change (generate + migrate).

## 6.5 CI and community files

- `.github/workflows/ci.yml`: lint, typecheck, test, build (no env), then
  migrate + seed + seed again + `catalog:verify` on PGlite. A second job
  builds both Docker targets. Not yet run on GitHub: the steps were replayed
  in a fresh copy, and that replay caught the fresh-clone `typecheck` failure
  fixed above.
- `.github/dependabot.yml` (npm grouped weekly, GitHub Actions weekly), issue
  forms (bug, feature), PR template.
- `LICENSE` (MIT, "Attar contributors"), `CONTRIBUTING.md`, `SECURITY.md`
  (private vulnerability reporting), `CHANGELOG.md`.
- Pre-release scan: no secret-shaped strings, no stray large files; `.data/`,
  `.env*`, `.next/`, build info and `next-env.d.ts` are ignored.

## Known limits

- **External services weren't exercised with real accounts:** Vercel, Neon,
  Cloudflare R2, Telegram and Resend. Those guides follow each provider's
  documented flow; the adapters are covered by unit tests with mocked
  `fetch`, and the S3 adapter by a real SigV4 server. The Vercel + Neon path
  should be walked end to end when the public demo is deployed (6.6).
- **Simulated LCP on Lighthouse's default slow-4G profile is ~2.9–3.0 s.**
  What remains is mostly the React and Next.js runtime. On a 4G profile, LCP
  is 1.1–1.2 s.
- **The product-name GIN index is unused**, as described above. Options: add
  trigram indexes (`pg_trgm`, which PGlite loads differently) or drop the
  index. Left as is pending a decision.
- **No `script-src` CSP.** Next's inline scripts would need per-request
  nonces.
- **Client IP needs a proxy.** The last `X-Forwarded-For` hop is trusted.
  Vercel, Caddy and nginx set it. With port 3000 exposed directly, clients can
  choose their IP. Per-phone limits still apply. The Docker guide says so.
- **JIT stays on** where the database role can't `ALTER DATABASE`. The app
  works, just slower on very large catalogs.
- **The full flag audit (§3.7) wasn't re-run.** The only change inside gated
  code is the review form's lazy schema import, and it's still reached only
  when `features.reviews` is on.
- Compose was tested with `podman-compose`, not Docker Compose v2.
- The local dev database built with `db:push` was moved to
  `.data/pglite.pre-phase6-backup` (ignored by git); the current one was
  rebuilt with `db:migrate`. An earlier dev upload remains in
  `public/uploads/` (also ignored).

## Release checklist (6.6)

Everything above is local; nothing has been initialised, pushed, tagged or
deployed.

1. ~~Choose the GitHub owner and repository name~~: done,
   `nadidazwad/nextjs-perfume-store`; placeholders replaced.
2. Optionally put a name in `LICENSE` instead of "Attar contributors".
3. `git init`, first commit, create the GitHub repository, push `main`.
4. In the repository settings, enable **Private vulnerability reporting**
   (`SECURITY.md` and the issue form link to it).
5. Watch the first CI run.
6. Deploy the public demo with [docs/deploy/vercel-neon.md](deploy/vercel-neon.md),
   place a real order, and add the demo link to the README. Don't publish
   the demo's admin login: sandboxed visitor access to the admin is planned
   as Phase 7 in `docs/IMPLEMENTATION_PLAN.md`.
7. Tag `v0.1.0` and publish a GitHub release from `CHANGELOG.md`.
