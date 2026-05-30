#!/bin/sh
# Apply pending migrations (idempotent — a no-op when the schema is current),
# then start the compiled API. DATABASE_URL is provided by the environment.
set -e

cd /app/apps/api
echo "Applying database migrations..."
bun x prisma migrate deploy

echo "Starting API..."
exec bun dist/main.js
