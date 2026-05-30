#!/bin/sh
# Apply pending migrations (idempotent — a no-op when the schema is current),
# then start the compiled API. DATABASE_URL is provided by the environment.
set -e

cd /app/apps/api
echo "Applying database migrations..."
# Run the pinned, locally installed Prisma CLI directly with bun (the slim bun
# image has no `node` for the bin shebang, and `bun x prisma` would fetch the
# latest major from the registry). DATABASE_URL is provided by the environment.
bun node_modules/prisma/build/index.js migrate deploy

echo "Starting API..."
exec bun dist/src/main.js
