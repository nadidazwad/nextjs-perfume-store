# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the
repository's **Security** tab and choose **Report a vulnerability**. Don't
open a public issue, and don't include real customer data in the report.

Include what you found, how to reproduce it, and the version or commit. We aim
to acknowledge reports within a week and will credit you in the fix unless
you'd rather stay anonymous.

## Supported versions

Security fixes go into the latest release. Attar is a template you fork, so
pull fixes from upstream into your store.

## What's already in place

Admin actions verify the session on the server. All input is validated with
Zod and length-capped. Checkout re-prices everything from the database.
Checkout, order tracking, reviews and admin sign-in are rate limited (shared
through Postgres in production). Uploads are type- and size-checked and
re-encoded. Security headers are set on every response. Order details are
kept out of production logs. See `docs/PHASE_6_VERIFICATION.md` for how each
of these was checked.
