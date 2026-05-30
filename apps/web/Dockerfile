# syntax=docker/dockerfile:1
#
# Build context is the monorepo root (src/). Build from there:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=... -t fictrio-web .
# or via infra/docker-compose.prod.yml (context: ..).

# --- build stage -------------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /app

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY packages/contracts packages/contracts
COPY apps/web apps/web

# contracts is consumed through its built dist/.
RUN bun run --cwd packages/contracts build

# NEXT_PUBLIC_* values are inlined at build time, so the API URL the browser
# calls must be known here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run --cwd apps/web build

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone bundle mirrors the monorepo layout (outputFileTracingRoot),
# so server.js lands at apps/web/server.js. static/ and public/ are not part
# of the standalone trace and must be copied alongside it.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["bun", "apps/web/server.js"]
