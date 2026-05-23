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

## Checks

```bash
bun run typecheck
bun run lint
bun run build
```

Frontend runs on `http://localhost:3000`.
API runs on `http://localhost:3001`.
