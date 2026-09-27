# Phase 7 verification (2026-09-27)

Public demo with a sandboxed admin, behind `DEMO_MODE`. Visitors click **Try
the admin** on the live demo, get a private copy of the store for 2 hours,
and use the real admin on it. Live at
`https://nextjs-perfume-store.vercel.app/demo` since 2026-09-27.

Decisions (maintainer, at the start): self-serve one-click access with the
generated login shown to the visitor; 2-hour TTL, 50 live sandboxes; the
"validated then discarded" fallback only with approval. It wasn't needed.

## Automated gates

| Check | Result |
|---|---|
| `pnpm lint`, `pnpm typecheck` | clean |
| `pnpm test` with `TEST_POSTGRES_URL` (local Postgres 17 and GitHub CI) | 77/77 (was 54). CI gained a Postgres service, so the isolation suite runs on every push: 77 pass, 0 skipped |
| `pnpm test` without Postgres | 62 pass, 15 skip with a reason (the sandbox tests need real schemas) |
| `pnpm build` with no env, and with `DEMO_MODE=true` | both green |
| `db:migrate` → `db:seed` ×2 → `catalog:verify` (PGlite, flag off) | passed; the second seed is a no-op |
| `tests/sandbox.test.ts` against **Neon** (throwaway database, pooled + direct) | all isolation tests passed; only the timing budget failed from Bangladesh (see 7.2) |
| `scripts/verify-demo.mjs` (Playwright, production build, local Postgres) | 19/19, 360 px and 1440 px |
| Same script against the live demo | 18/18 (rate-limit step skipped, see Known limits) |

## Flag off: every real store is unchanged

- With `DEMO_MODE` unset, `db` and `publicDb` are the same Drizzle client
  over the same postgres.js client as before. Tested on PGlite and on
  Postgres, where a validly signed sandbox cookie pointing at an existing
  sandbox-shaped schema is ignored.
- A `demo` user is never an admin, the demo Server Actions refuse, the
  cleanup job and `/demo` answer 404, suggest keeps
  `public, s-maxage=60`, links carry no `ugc` rel, and checkout and reviews
  aren't gated (tests).
- On a flag-off production server (`next start` against Postgres): `/demo`,
  `/demo/resume` and `/api/cron/demo-cleanup` returned 404, there was no demo bar
  on the storefront or admin login, and suggest was `public`. The live demo
  was checked the same way after the first push, before `DEMO_MODE` was set.

## 7.1 Demo switch and role

`DEMO_MODE` in `env.ts` defaults to off. Turning it on requires a Postgres
`DATABASE_URL`, plus `DATABASE_URL_DIRECT` when that URL is a Neon pooler. It
isn't restricted to production, because the isolation tests run with it on;
the deploy guide sets it for the Production environment only.
`adminSession()` accepts a `demo` user only in demo mode, and only while the
request is routed to that user's own live sandbox. A demo login without its
sandbox cookie, with another visitor's cookie, or past expiry is rejected
(test). Such a login is sent to `/demo/resume`, which re-attaches its own
sandbox.

## 7.2 Sandbox lifecycle

`createSandbox()` takes an advisory lock, removes expired sandboxes (and the
oldest if 50 are live), then in one transaction and one multi-statement round
trip creates `demo_<id>`:
- `CREATE TABLE … (LIKE public.x INCLUDING ALL)` for every store table,
  copying their indexes, checks and defaults;
- the rows;
- the order-number sequence with its current value;
- every foreign key, re-pointed inside the sandbox (introspected once per
  process).

A test checks that the copy matches `public` row for row, has the same
number of constraints of each kind, and that no foreign key points outside
the sandbox.

Which tables are copied is declared in `schema.ts`: `sandboxTables` (17
store tables plus `sandbox_uploads`) and `publicOnlyTables` (auth, rate
limits, the registry). A test fails if a table in `schema.ts` or in the
migrated database isn't in exactly one of them (AGENTS.md invariant 14).

| Where | Creation time |
|---|---|
| Local Postgres | 100–120 ms |
| Neon from Bangladesh (test process ~90 ms away) | 1.48 s, over the 1 s budget: about nine round trips |
| Live demo, click → credentials, measured from Bangladesh | 0.85–1.8 s, including the browser round trip, sign-in and cold starts |

The server-side time inside `sin1` wasn't measured on its own.

## 7.3 Per-request routing (test-first)

The isolation tests were written first and run against real Postgres. Each
was mutation-checked: disabling routing fails three of them; adding `public`
to the sandbox `search_path` fails the fail-closed test.

- `db` wraps a small router client under Drizzle. Each query and
  transaction reads the request's cookies (`next/headers`). If there is an
  HMAC-signed `attar_sandbox` cookie, it's bound to the current admin session
  cookie, and the sandbox is still in the registry (cached 5 s per instance),
  the query runs on that sandbox's connection. Otherwise it runs on the shared
  client. Scripts and migrations have no request and always use the shared
  client.
- Sandbox connections: direct URL, `max: 1`, at most 8 per instance
  (least recently used closed first), idle after 20 s.
- Auth, sessions and rate limits use `publicDb`, which is never routed.

Tests: two sandboxes never see each other's writes (admin edit, checkout
with sequence and stock, order transition). An anonymous request sees
neither. A fingerprint of every store table and the sequence in `public` is
unchanged after all of it. Forged, expired, other-session, no-session,
wrong-secret and garbage cookies fall back to the shared client.

**Deviations from the plan, with evidence:**

| Plan | Built | Why |
|---|---|---|
| `search_path = demo_<id>, public` | `search_path = demo_<id>` only | With `public` on the path, a query from a sandbox whose schema was just dropped silently writes to the real store (mutation test). Without it, it errors. Nothing routed needs `public`: auth and rate limits use `publicDb` |
| `search_path` as a startup parameter on the direct URL | passed as `options=-c search_path=…`, then checked | **Neon's direct endpoint silently ignored a bare `search_path` startup parameter** (the connection reported `"$user", public`), while local Postgres honoured it. `options` works on the direct endpoint; the pooler rejects it (`08P01 unsupported startup parameter`). Each sandbox connection now proves `current_schemas()` is exactly its schema before its first query, or refuses (test) |
| "valid, unexpired sandbox cookie" | plus registry liveness | An ended or evicted sandbox's visitor becomes an anonymous shopper instead of hitting errors. A registered sandbox whose schema is missing still fails closed (test) |

## 7.4 "Try the admin"

- `/demo`: one click creates `demo-<hex>@demo.invalid` with a random
  password, a sandbox and a signed-in session. The login and its expiry stay
  on screen after the page refreshes into "running". Limited to 3 starts per
  IP per hour (the 4th was refused locally).
- The demo bar runs across storefront and admin:
  - a sandbox visitor sees a live countdown with Reset and End, each confirmed
    inline;
  - an anonymous visitor sees "This is a demo store. Try the admin";
  - the owner in the admin sees "Original demo store: new demo stores copy
    what you change here".
- Signing in with the demo login on another device lands in the same
  sandbox (live check). This goes through a `/demo/resume` page and Server
  Action: a route-handler redirect inside an RSC navigation rendered a blank
  page.
- Checked at 360 px and 1440 px (screenshots in `docs/screenshots/demo/`).
  Two bugs were found and fixed from the screenshots: an unreadable confirm
  button in the admin (a CSS specificity problem), and a refresh that hid
  the just-issued password.

## 7.5 Demo-safe side effects

- Order alerts always use the redacted console adapter, whatever
  `NOTIFY_ADAPTER` says (test with a stubbed `fetch`). The test-notification
  action and button are off.
- Uploads from a demo user go to their sandbox's `sandbox_uploads` table
  (bytea, 30 images max) and are served by `/uploads/[key]` with
  `private, max-age=86400`.
  - Other visitors get 404 (live check).
  - A write refuses unless the connection's `current_schema()` is a `demo_`
    schema, so `public.sandbox_uploads` stays empty (test; live: 0 rows).
  - Keys start with `sbx-` so the storefront skips the image optimizer,
    which fetches without the visitor's cookies.
- Search suggest is `private, no-store` for everyone in demo mode (live
  header). It is private for everyone rather than only for sandbox
  requests, so the CDN can't serve an anonymous response to a sandbox
  visitor either.
- Outbound `http(s)` links typed into banners, tiles, event cards, the
  announcement bar, pages and product descriptions render
  `rel="nofollow ugc"`.
- The other responses that were cacheable don't carry sandbox data: public
  `/uploads` files and S3 objects. Pages were already `force-dynamic`.

## 7.6 Cleanup

- Starting a demo removes expired sandboxes first. `/api/cron/demo-cleanup`
  (Bearer `CRON_SECRET`, daily at 21:30 UTC via `vercel.json`) is the
  backstop. Cleanup also removes demo users left without a sandbox and
  `demo_` schemas without a registry row (tests).
- **Live:** four test sandboxes were moved past their expiry and the cron
  endpoint was called with the production secret. It removed 4 sandboxes,
  4 schemas, 4 demo users and 6 demo sessions, and kept the owner.
- **Deviation:** the plan's "re-seed `public` if its fingerprint drifts" was
  not built. `public` is copied into every sandbox, so the real risk was an
  anonymous visitor's typed name and phone reaching every later demo
  visitor. In demo mode, checkout and review submission therefore need a
  sandbox (test; live: an anonymous checkout is refused with a pointer to
  "Try the admin"). `public` now changes only through the owner's admin, so
  a drift check would only undo the owner's own edits. The seed never resets
  data anyway.

## 7.7 Deploy

- The first push (7.1–7.6) went out with the flag off. Vercel applied
  migrations `0003_demo_sandboxes` and `0004_sandbox_uploads` to Neon, and
  the demo kept working. CI passed.
- With the maintainer's approval, `DEMO_MODE=true`, `DATABASE_URL_DIRECT`
  and a new `CRON_SECRET` were added for **Production only**, then
  production was redeployed.
- New guide `docs/deploy/public-demo.md`; `.env.example`, `env.ts`,
  `vercel-neon.md`, AGENTS.md and the README updated.
- The owner's login is still a normal `admin`: it signs in to `/admin`,
  edits `public`, and has no sandbox.

### Gate 7 on the live demo

| Check | Result |
|---|---|
| Visitor A (360 px) and visitor B (1440 px) each start a demo store | pass |
| Both rename the same product and each sees only their own name | pass |
| Both place an order and each admin lists only its own customer | pass |
| A uploads an image and adds it to the product; A's storefront shows it (200) | pass |
| An anonymous visitor sees the original name, no sandbox image, 404 on A's image URL | pass |
| The anonymous visitor's checkout is refused; `/admin` sends them to sign-in | pass |
| A signs in with the generated login in a fresh browser and lands in A's sandbox | pass |
| Reset brings A back to the original; B is unaffected | pass |
| End deletes B's store and signs B out; B sees the original | pass |
| Expiry: expired sandboxes, demo users and sessions are removed by cleanup | pass (expiry forced; see Known limits) |
| `public` afterwards: 15 orders, sequence at 1015, product name original, 0 uploads | unchanged |

## 7.8 Showcase

- The README links **Try the admin**, and the gallery gains a "Public demo"
  section with four screenshots from the live demo (38 in total). The
  generated password is masked in the published image.
- The existing gallery wasn't re-shot: a real store's UI didn't change, and
  captures from the live demo would now all include the demo bar.
- The optional GIF wasn't made.

## Known limits

- **Expiry was forced, not waited out.** The test sandboxes' `expires_at`
  was moved into the past before calling the cleanup job. The unit tests
  cover the clock paths, but a natural 2-hour expiry on the live demo and
  the first scheduled cron run (21:30 UTC) haven't been observed yet.
- **Per-IP start limits and CGNAT.** From the maintainer's connection, the
  demo saw several different public IPs in one test run: the ISP rotates
  NAT addresses. A tracking lookup was keyed on the machine's IPv4 as
  expected, so the app reads client IPs correctly. The effect is that
  visitors behind one carrier NAT share a start budget, and a rotating
  visitor can get more than 3 starts. The cap of 50 and oldest-first
  eviction bound the damage either way.
- **Demo users can call Better Auth's self-service endpoints**, for example
  change their password or name. That only touches their own `public.user`
  row, which is deleted at expiry.
- Every sandbox copies whatever the owner has in `public` at that moment,
  including edits made through the owner's admin.
- Each busy sandbox holds one direct Neon connection per server instance
  (at most 8 per instance). Neon's compute allowed 901 connections at the
  time of testing.
- `scripts/verify-demo.mjs` needs `playwright-core` and a Chromium binary,
  installed outside the project, so it isn't part of CI.

## Follow-ups after Phase 7 (same day)

| Item | What was done | Checked by |
|---|---|---|
| Neon password rotated | `DATABASE_URL` still had the old password, so the redeploy failed at `db:migrate` (`28P01`) and the live site returned 500. Also, `DATABASE_URL_DIRECT` had been given the pooled URL. Both were set from the new URL (pooled / direct), then production was redeployed | both URLs connect; live `verify-demo` 18/18 afterwards |
| Dependabot #1–#5 | merged together (GitHub Actions versions, Next 16.3.6, React 19.3, drizzle-orm 0.45.3, TypeScript 6); CI conflicts resolved by hand | full gate + Postgres suite locally, `verify-demo` 19/19, CI 80/80 |
| Dependabot #6 (`@types/node` 26) | closed; `@types/node` pinned to `^24` to match the Node 24 runtime, and Dependabot skips its majors | typecheck |
| Unused name GIN index | dropped (migration 0005, `IF EXISTS`); SPEC performance line updated | `catalog:verify`; index absent on Neon |
| `script-src` CSP | `src/proxy.ts` sends every page the base policy plus `script-src 'self' 'nonce-…' 'strict-dynamic'`; APIs and assets keep the base policy. The root 404 renders per request. Zod is imported from `src/lib/zod.ts` (jitless, lint-enforced): its eval probe was the one violation, on `/checkout` | `tests/proxy.test.ts`; 27 pages crawled with a `securitypolicyviolation` listener: 0 violations locally (prod + dev) and live; `verify-storefront` and `verify-demo` pass |

## Waiting on the maintainer

1. **Rotate the Neon password once more** (the current one was pasted into a
   chat). Update `DATABASE_URL` (pooled) **and** `DATABASE_URL_DIRECT` (the
   same URL without `-pooler`) in Vercel before redeploying: the old password
   stops working the moment you rotate.
2. **Revoke the Vercel token** (`~/.vercel-attar-token`).
3. Optionally check Vercel → Cron Jobs after 21:30 UTC for the first
   scheduled cleanup; the test sandboxes still live expire on their own.
