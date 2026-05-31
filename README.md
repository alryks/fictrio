# Fictrio

Web application for rating and discussing movies, TV shows, and books.

## Stack

- Bun workspaces
- Turborepo
- TypeScript
- Next.js, React, Tailwind CSS, shadcn/ui
- NestJS with Fastify
- PostgreSQL
- Redis

## Project Structure

```text
apps/
  api/  NestJS API
  web/  Next.js frontend
infra/  Local infrastructure
```

## Setup

Copy the development environment file:

```bash
cp infra/.env.dev.example infra/.env.dev
```

### Option A — full stack in Docker

Runs PostgreSQL, Redis, the API and the web app as built images:

```bash
docker compose --env-file infra/.env.dev -f infra/docker-compose.dev.yml up -d --build
```

App: `http://localhost:3000`, API: `http://localhost:3001`. The API container
applies database migrations on start. Re-run the command after changing code to
rebuild.

### Option B — host dev servers with hot reload

Start only the backing services in Docker, then run the apps on the host:

```bash
bun install
docker compose --env-file infra/.env.dev -f infra/docker-compose.dev.yml up -d postgres redis
bun run dev
```

The host tools (`bun run dev`, `bun run db:*`, tests) read `infra/.env.dev`.

Run database migrations (Option B, on the host):

```bash
bun run db:migrate
```

Grant a moderator or administrator role to an existing account (registration only
assigns `user`). The command is idempotent:

```bash
bun run db:grant-role <username> <user|moderator|admin>
```

Moderators and administrators can hide and restore reviews, comments and lists;
hidden content stays visible only to moderators, administrators and its author/owner.

Administrators additionally manage the catalog and accounts from the UI: they can
edit a work's title, original title and description or delete it (from the work
card), activate/deactivate any account, and grant or revoke the moderator and
administrator roles (from a user's profile). A deactivated account keeps read
access to its own profile but, like a guest, cannot rate, review, comment or
create lists; its profile, feed and historical content (reviews, comments,
ratings and lists) are visible only to the owner and administrators. That
content is filtered at read time — it is never altered or removed from the
database.

## Checks

```bash
bun run typecheck
bun run lint
bun run build
```

Frontend runs on `http://localhost:3000`.
API runs on `http://localhost:3001`.

## Content import

Set `TMDB_API_KEY` to a TMDB v4 read access token and set
`OPEN_LIBRARY_USER_AGENT` to an identifying value with contact information.
The scripts throttle requests through `TMDB_REQUEST_DELAY_MS` and
`OPEN_LIBRARY_REQUEST_DELAY_MS`.

```bash
bun run content:candidates:movies 1000 data/movie_candidates.csv
bun run content:candidates:shows 1000 data/show_candidates.csv
bun run content:candidates:books 1000 data/book_candidates.csv
bun run content:fetch:movies 500 data/movie_candidates.csv data/movies.csv
bun run content:fetch:shows 100 data/show_candidates.csv data/shows.csv data/seasons.csv data/episodes.csv
bun run content:fetch:books 500 data/book_candidates.csv data/books.csv
bun run content:import:movies data/movies.csv
bun run content:import:shows data/shows.csv data/seasons.csv data/episodes.csv
bun run content:import:books data/books.csv
```

## Production deployment (VPS, fictrio.sklyar.app)

The whole stack — PostgreSQL, Redis, the API and the web app — runs through
`infra/docker-compose.prod.yml`. TLS and routing are delegated to an existing
Traefik instance on the host; the `api` and `web` services advertise themselves
to it through container labels. Routing is single-origin:

- `https://fictrio.sklyar.app` serves the web app;
- `https://fictrio.sklyar.app/api/*` is proxied to the API with the `/api` prefix
  stripped (so the browser, CSRF double-submit cookie and session all stay on
  one origin — no CORS, no cross-subdomain cookies).

Prerequisites on the VPS: Docker with the Compose plugin, a running Traefik
with an HTTPS entrypoint named `websecure` and an ACME certificate resolver,
and DNS `A`/`AAAA` records for `fictrio.sklyar.app` (and `www.fictrio.sklyar.app`) pointing at
the host.

1. Copy the repository to the VPS and create the environment file:

   ```bash
   cp infra/.env.prod.example infra/.env.prod
   # then edit infra/.env.prod
   ```

   Set strong `JWT_SECRET`, `POSTGRES_PASSWORD` and `REDIS_PASSWORD`, and match
   `TRAEFIK_NETWORK` (the external Docker network your Traefik attaches to) and
   `TRAEFIK_CERTRESOLVER` (your ACME resolver name) to the existing Traefik
   setup. `NEXT_PUBLIC_API_URL` is baked into the web bundle at build time and
   must be `https://fictrio.sklyar.app/api`. Keep the Postgres password free of
   URL-reserved characters (`@ : / ? # &`).

2. Build and start the stack:

   ```bash
   docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
   ```

   The API container applies database migrations (`prisma migrate deploy`,
   which also provisions the `app_user`/`app_moderator`/`app_admin` roles and
   the SQL routines) on every start before serving, so the schema is brought
   up to date automatically.

3. Grant a moderator/administrator role to an account (after it has registered):

   ```bash
   docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec \
     --workdir /app/apps/api api bun prisma/grant-role.ts <username> <user|moderator|admin>
   ```

To update after pulling new code, re-run the `up -d --build` command; to stop
the stack use `down` (add `-v` only if you intend to drop the database and
Redis volumes).
