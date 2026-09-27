# Deploy on Vercel + Neon

This is the fastest free path from a fork to a live store you can order from:
about 15 minutes, no card required. Neon hosts the Postgres database, and
Vercel builds and serves the app.

> [!WARNING]
> **Vercel's free Hobby plan is for non-commercial use only.** It's fine for
> trying Attar, a demo, or a store you're still setting up. Once you take real
> orders as a business, move to Vercel Pro or self-host with
> [Docker](docker.md), which can also cost ৳0 on a free VM.

## What you need

- A GitHub account with your fork of this repository
- A [Neon](https://neon.tech) account (free plan, no card)
- A [Vercel](https://vercel.com) account (Hobby plan, sign in with GitHub)

## 1. Create the database on Neon

1. In Neon, create a project. Pick the region closest to your customers
   (for Bangladesh, *AWS Asia Pacific (Singapore)*).

   > [!IMPORTANT]
   > Vercel runs your server code in Washington, D.C. (`iad1`) unless you
   > change it. Keep the app and the database together: either pick Neon's
   > *AWS US East 1 (N. Virginia)*, or after importing on Vercel set
   > **Settings → Functions → Function Region** to the region matching your
   > database (Singapore is `sin1`). Otherwise every query crosses an ocean.
2. On the project dashboard, click **Connect**. Keep **Connection pooling**
   switched on and copy the connection string. It looks like
   `postgresql://neondb_owner:…@ep-…-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
   This is your `DATABASE_URL`.

You don't create any tables yourself. The first production deploy runs the
migrations.

## 2. Import the project on Vercel

1. In Vercel, click **Add New → Project** and import your fork.
2. Leave the framework preset (Next.js) and the build settings as they are.
   The repo's `vercel.json` already sets the build command.
3. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `BETTER_AUTH_SECRET` | a random string: run `openssl rand -hex 32`, or use any password generator for 64 characters |
   | `NEXT_PUBLIC_APP_URL` | `https://<project-name>.vercel.app`, using the project name shown above the variables. Use your own domain later |
   | `ADMIN_EMAIL` | the email you'll sign in to the admin with |
   | `ADMIN_PASSWORD` | a strong password (at least 8 characters) |

   Optional: set `SEED_DEMO_DATA` to `false` to start with an empty catalog
   instead of the demo store. See [Going live](#going-live).

4. Click **Deploy**.

On production deploys, the build runs `pnpm db:migrate`, then `pnpm db:seed`,
then `pnpm build` (see `scripts/vercel-build.sh`). The seed runs every time
but only acts once: it creates your admin account and, unless you turned it
off, the demo catalog. It never resets anything you change later.

> [!NOTE]
> If the build fails with *"Refusing to seed: ADMIN_EMAIL and ADMIN_PASSWORD
> are still the demo defaults"*, you skipped `ADMIN_EMAIL` or
> `ADMIN_PASSWORD`. Add them and redeploy.

## 3. Take a real order

1. Open `https://<project-name>.vercel.app`, add a product to the bag and
   check out with your own phone number.
2. Open `/admin`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and find the
   order under **Orders**. Confirm it, pack it, ship it.
3. Check the order from the customer side at `/track-order`.

New-order alerts go to the Vercel function logs until you set up
[Telegram or email](notifications.md). In production, that log line leaves out
customer contact details, so open the order in the admin to see them.

## 4. Make it yours

Edit `store.config.ts` in your fork (the GitHub web editor is fine): store
name, phone, currency, delivery zones and fees, your bKash/Nagad numbers,
colours, feature flags. Commit, and Vercel redeploys automatically. An invalid
value fails the build with the field name and the reason.

## 5. Image uploads

Vercel's filesystem is read-only, so admin image uploads need object storage.
Set up [Cloudflare R2 or another S3-compatible bucket](storage.md). Until you
do, the store works but uploading a product photo in the admin fails with a
message. Demo images ship with the app and aren't affected.

## Going live

Before you announce the store:

- **Start from a clean database** if you seeded the demo. The demo includes
  fictional customers and orders you don't want in your books. In Neon, create
  a new branch or database, point `DATABASE_URL` at it, set
  `SEED_DEMO_DATA=false`, and redeploy. You get your admin account and an
  empty catalog. Add pages such as *About*, *Delivery* and *Returns* under
  **Admin → Pages**. Active pages appear in the footer automatically.
- **Set up order alerts** with [Telegram or Resend](notifications.md).
- **Use your domain**: add it under Vercel → Settings → Domains, then change
  `NEXT_PUBLIC_APP_URL` to it and redeploy.
- **Move off Hobby** (see the warning at the top).

## Updating

Pull changes from upstream into your fork. Each production deploy applies new
migrations before it builds. Preview deploys (pull requests, Dependabot)
never touch the database. If you give previews a `DATABASE_URL` at all, point
it at a separate Neon branch.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Pages show an error and the logs say `Invalid environment variables` | The log lists each variable and why it failed. `NEXT_PUBLIC_APP_URL` must start with `https://` |
| Can't sign in to `/admin` after changing the domain | `NEXT_PUBLIC_APP_URL` must match the address in the browser. Update it and redeploy |
| "Too many attempts" at checkout while testing | Limits are per phone and per address for 15 minutes. Wait, or use another phone number |
| Build fails at `db:migrate` | Check that `DATABASE_URL` is the full Neon string including `?sslmode=require` |
| `ETIMEDOUT` after about a second when you run `pnpm db:migrate` or `db:seed` **from your own computer** against a faraway database | Node gives each server address only 250 ms to answer. Allow more: `NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000 pnpm db:migrate`. Vercel isn't affected when the app and database share a region |
