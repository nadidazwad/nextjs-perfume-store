# Self-host with Docker

Run Attar on any machine with Docker: a VPS, a home server, or a free cloud
VM (Oracle Cloud's Always Free tier, for example). This is the free path
that's also fine for a real business, because you're not bound by a hosting
plan's non-commercial terms.

The repo ships with:

- `Dockerfile`: a small production image (Next.js standalone output, runs as a
  non-root user). A second target, `tools`, runs migrations and the seed.
- `compose.yaml`: Postgres, a one-off `setup` service (migrate, then seed),
  and the web app. Images you upload are kept in a volume.

## Quick start

On the server, with Docker and Docker Compose installed:

```bash
git clone https://github.com/<you>/<your-fork>.git attar && cd attar
cp .env.example .env
```

Edit `.env` and set at least:

```bash
POSTGRES_PASSWORD=<a long random password>
BETTER_AUTH_SECRET=<output of: openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://shop.example.com   # your domain, or http://localhost:3000 to try it
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<a strong password>
# SEED_DEMO_DATA=false   # uncomment for a real store with an empty catalog
```

Leave `DATABASE_URL` unset: `compose.yaml` points the app at its own Postgres.
Then:

```bash
docker compose up -d --build
```

The first build takes a few minutes. `setup` waits for Postgres, applies
migrations, runs the seed, and exits. After that the app starts on port 3000.
Open `http://<server>:3000`, place a test order, and sign in at `/admin`.

## HTTPS and client addresses

Put a reverse proxy in front for HTTPS. The admin requires
`NEXT_PUBLIC_APP_URL` to be `https://` unless it's `localhost`. Caddy gets and
renews certificates automatically. A complete `Caddyfile`:

```
shop.example.com {
    reverse_proxy localhost:3000
}
```

Rate limits (checkout, order tracking, reviews, admin sign-in) key on the
client address. Attar takes it from the last hop in `X-Forwarded-For`, which
Caddy and nginx append for you. **Don't expose port 3000 directly to the
internet**, or clients can pick their own address. Per-phone limits still
apply either way. With Caddy on the same machine, bind the app to localhost
by changing the port mapping in `compose.yaml` to `"127.0.0.1:3000:3000"`.

## Updating

```bash
git pull
docker compose up -d --build
```

`setup` runs again and applies any new migrations. The seed is idempotent:
it never resets your admin account or catalog edits.

## Backups

Everything that matters is in two volumes:

| Volume | Contents | Back up with |
|---|---|---|
| `db` | Postgres data | `docker compose exec db pg_dump -U attar attar > attar-$(date +%F).sql` |
| `uploads` | admin-uploaded images (`STORAGE_ADAPTER=local`) | `docker run --rm -v attar_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .` |

The volume name is prefixed with the project directory name (`attar_` if you
cloned into `attar/`). Check it with `docker volume ls`. To keep images in
object storage instead, see [storage.md](storage.md).

## Using an external database

To use Neon or another managed Postgres instead of the bundled one, set
`DATABASE_URL` in `.env`, remove the `db` service, and remove the
`DATABASE_URL` overrides under `setup` and `app` in `compose.yaml`.

## Building the image on its own

```bash
docker build -t attar .                          # web server
docker build -t attar-tools --target tools .     # migrate + seed runner
docker run --rm --env-file .env attar-tools      # needs DATABASE_URL in .env
docker run -d -p 3000:3000 --env-file .env -v attar-data:/app/.data attar
```

No database is needed at build time.

## What was verified

Before release, this setup was run from a clean copy of the repo with Podman
and `podman-compose`: the image built, `setup` migrated and seeded, a
checkout completed, an admin image upload was served, and the order and the
image both survived `compose down` / `up`. Docker Engine and Docker Compose
v2 read the same files.
