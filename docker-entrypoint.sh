#!/bin/sh
set -e

# Migrations run here rather than at image-build time, so a rebuilt image never
# mutates the database and the build stays reproducible without DB access.
#
# Opt-in per service: set RUN_MIGRATIONS=true on the `web` service only. The
# `worker` service must leave it false — two services racing `migrate deploy`
# on boot is pointless (Prisma takes an advisory lock, so it is safe, just noise).
#
# Rolling back to an older image tag applies nothing: `migrate deploy` only moves
# forward, and an older image simply knows about fewer migrations.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] running prisma migrate deploy"
  bun run release
fi

exec "$@"
