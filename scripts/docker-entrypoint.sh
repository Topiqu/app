#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

cd "$(dirname "$0")"
echo 'Applying database migrations before application startup'
DATABASE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}" \
  CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1 \
  bun --bun migrate/node_modules/prisma/build/index.js migrate deploy --schema migrate/schema.prisma

exec bun --bun server/index.mjs
