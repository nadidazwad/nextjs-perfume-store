# Run a public demo with a sandboxed admin

`DEMO_MODE=true` turns a deployment into a showcase: any visitor can click
**Try the admin**, get a private copy of the store for 2 hours, and use the
real admin panel on it. Their edits, orders and uploads show up in their admin
and storefront only. Everyone else keeps seeing the original demo.

> [!CAUTION]
> Demo mode is for a dedicated showcase deployment, never for a store that
> takes real orders. It lets strangers into the admin and blocks orders from
> anyone without a sandbox.

This is how [the project's live demo](https://nextjs-perfume-store.vercel.app)
runs. Start from a normal [Vercel + Neon deployment](vercel-neon.md) with the
demo data seeded.

## How it works

- Each visitor sandbox is a Postgres schema, `demo_<id>`, holding a copy of
  every store table (products, orders, homepage, settings…), made from
  `public` in one transaction (about 350 ms next to the database).
- Requests from a visitor carry a signed `attar_sandbox` cookie bound to their
  admin session. `db` sends those requests to a small connection whose
  `search_path` is that schema alone. Admin logins, sessions and rate limits
  always stay in `public`.
- Up to 50 sandboxes live at once, for 2 hours each. The 51st replaces the
  oldest. Expired sandboxes, their demo logins and their images are deleted
  when the next visitor starts one, and by a daily cleanup job.
- A visitor's uploaded images are stored in their sandbox, so demo mode needs
  no bucket. Order alerts only reach the server log, redacted.
- Visitors without a sandbox can browse but not order or review: `public` is
  copied into every sandbox, so anything they typed would be shown to every
  later demo visitor. `public` changes only through your own admin login.
- With `DEMO_MODE` unset, none of this runs: `/demo` and the cleanup job
  return 404, and `db` is the plain shared client.

## Set it up

1. **Direct connection string.** In Neon, click **Connect**, switch
   **Connection pooling** off and copy the string: the same URL without
   `-pooler`. Sandbox connections need it, because Neon's pooler rejects a
   per-connection `search_path`.
2. **Environment variables.** In Vercel → Settings → Environment Variables,
   add these for the **Production** environment only (a preview deployment
   must never run in demo mode against the live database):

   | Name | Value |
   |---|---|
   | `DEMO_MODE` | `true` |
   | `DATABASE_URL_DIRECT` | the direct string from step 1 |
   | `CRON_SECRET` | a random string (`openssl rand -hex 32`); Vercel Cron sends it to the cleanup job |

   Keep `DATABASE_URL` as the pooled string. Your own `ADMIN_EMAIL` account
   stays a normal administrator. Don't publish its password: visitors use
   **Try the admin**.
3. **Redeploy** production. The build applies the migrations that create the
   sandbox tables. `vercel.json` already schedules the daily cleanup
   (21:30 UTC; Hobby allows one run a day).
4. **Check it**: open `/demo` in two private windows, start a demo store in
   each, rename the same product in both, and check that each window shows
   only its own name while a third window shows the original.

## Limits and costs

- A sandbox of the seeded demo is well under 1 MB; 50 of them fit easily in
  Neon's free storage. Each busy sandbox holds at most one direct connection
  per server instance, idle ones close after 20 seconds.
- Starting a demo is limited to 3 per visitor IP per hour, resets to 10 per
  hour, and uploads to 30 images per sandbox.
- Anything you change in the admin with your own login changes the original
  demo, and every sandbox started afterwards copies it.

## Turning it off

Remove `DEMO_MODE` (and `DATABASE_URL_DIRECT`, `CRON_SECRET`) and redeploy.
Leftover sandboxes are harmless; to remove them, run this in Neon's SQL editor
first, while demo mode is still on, or afterwards:

```sql
do $$ declare s text; begin
  for s in select nspname from pg_namespace where nspname ~ '^demo_[a-z0-9]{16}$' loop
    execute format('drop schema %I cascade', s);
  end loop;
end $$;
delete from "user" where role = 'demo';
```

Forks that never use demo mode can delete the `crons` entry in `vercel.json`;
the job answers 404 without touching the database anyway.
