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
