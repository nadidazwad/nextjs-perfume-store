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

- Read [`AGENTS.md`](AGENTS.md). It's the map of the codebase for humans and AI
  agents alike: where things live, the invariants, and step-by-step recipes
  (add a filter, a homepage section, a notification adapter, a feature flag).
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

## Reporting bugs and security issues

Use the bug report template for bugs. Report security problems privately (see
[`SECURITY.md`](SECURITY.md)).

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
