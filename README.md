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

```bash
bun install
```

Copy environment variables:

```bash
cp .env.example .env
```

Start PostgreSQL and Redis:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d
```

Run development servers:

```bash
bun run dev
```

Run database migrations and import catalog data:

```bash
bun run db:migrate
bun run db:import
```

`db:import` loads popular movies and TV shows from TMDb and books from Open Library.
Set `TMDB_API_KEY` in `.env` before running it. The importer is idempotent and skips
content that already exists by external identifiers.
By default, all regular seasons and their episodes are imported for every imported TV show.
Set `IMPORT_TMDB_SEASONS_PER_SHOW` only when you need to limit seasons per show.

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

3. Populate the catalog once (optional, needs `TMDB_API_KEY` in
   `infra/.env.prod` for films and shows; books come from Open Library):

   ```bash
   docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec \
     --workdir /app/apps/api api bun prisma/import-content.ts
   ```

4. Grant a moderator/administrator role to an account (after it has registered):

   ```bash
   docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec \
     --workdir /app/apps/api api bun prisma/grant-role.ts <username> <user|moderator|admin>
   ```

To update after pulling new code, re-run the `up -d --build` command; to stop
the stack use `down` (add `-v` only if you intend to drop the database and
Redis volumes).
