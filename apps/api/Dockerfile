# syntax=docker/dockerfile:1
#
# Build context is the monorepo root (src/). Build from there:
#   docker build -f apps/api/Dockerfile -t fictrio-api .
# or via infra/docker-compose.prod.yml (context: ..).

# --- build stage -------------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /app

# Install dependencies first, keyed only on the manifests so the layer is
# cached across source-only changes.
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

# Copy the sources the API needs (contracts is a workspace dependency).
COPY packages/contracts packages/contracts
COPY apps/api apps/api

# contracts is consumed through its built dist/; build it before the API.
RUN bun run --cwd packages/contracts build

# A syntactically valid URL is enough for `prisma generate`; it never
# connects. The real URL is supplied at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN cd apps/api && bun x prisma generate
RUN bun run --cwd apps/api build

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bun uses an isolated layout: the package store is /app/node_modules/.bun and
# each workspace's node_modules holds symlinks into it. Copy the store plus the
# api and contracts workspace trees so module resolution and the pinned Prisma
# CLI (apps/api/node_modules/prisma) work without re-installing.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./apps/api/docker-entrypoint.sh"]
