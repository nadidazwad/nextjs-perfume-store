## What and why

<!-- What does this change, and what problem does it solve? Link the issue if there is one. -->

## How it was checked

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass
- [ ] Affected pages checked at 360 px and on desktop (screenshots below for UI changes)
- [ ] Schema changes include a migration from `pnpm db:generate`, and `pnpm db:seed` still runs twice cleanly
- [ ] Follows the invariants in `AGENTS.md` (integer money, no customer login, adapters keep a free local default, feature flags fully gate, fictional seed data)
