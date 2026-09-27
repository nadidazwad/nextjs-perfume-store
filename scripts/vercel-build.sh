#!/bin/sh
# Vercel build command (see vercel.json). Production deploys bring the database
# up to date first; preview deploys (pull requests, Dependabot) only build, so
# an unreviewed branch can never migrate the live database.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  pnpm db:migrate
  # Idempotent: creates the admin once, never resets it. Demo data unless
  # SEED_DEMO_DATA=false. Refuses the demo admin credentials.
  pnpm db:seed
fi
pnpm build
