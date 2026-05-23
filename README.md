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

## Checks

```bash
bun run typecheck
bun run lint
bun run build
```

Frontend runs on `http://localhost:3000`.
API runs on `http://localhost:3001`.
