# syntax=docker/dockerfile:1
#
# topiqu-blog — self-hosted image (Dokploy / any BuildKit-capable Docker host).
# Runs the Nitro `node-server` build under the bun runtime.
#
# Requires BuildKit for the `--mount=type=secret` steps (Dokploy uses buildx).

# ---- build ----------------------------------------------------------------
FROM oven/bun:1.3.14 AS build
WORKDIR /app

ENV NUXT_TELEMETRY_DISABLED=1 \
    NITRO_PRESET=node-server \
    NODE_ENV=production \
    APP_ENV=production

# `argon2` is a native addon; prebuilds usually hit, these are the fallback.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential \
 && rm -rf /var/lib/apt/lists/*

# Public build-time values. These end up in the client bundle by design, so they
# are plain build args — supply them from Dokploy's "Build Args".
ARG NUXT_PUBLIC_SENTRY_DSN=""
ARG TURNSTILE_SITE_KEY=""
ARG STRIPE_PK=""
ARG CDN_URL="https://cdn.topiqu.com"
ARG BASE_DOMAIN="topiqu.com"
ARG AUTH_ORIGIN=""
ARG SENTRY_URL=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ENV NUXT_PUBLIC_SENTRY_DSN=$NUXT_PUBLIC_SENTRY_DSN \
    TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY \
    STRIPE_PK=$STRIPE_PK \
    CDN_URL=$CDN_URL \
    BASE_DOMAIN=$BASE_DOMAIN \
    AUTH_ORIGIN=$AUTH_ORIGIN \
    SENTRY_URL=$SENTRY_URL \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

# Runtime-only credentials are NOT baked in. `nuxt prepare` / `nuxt build` only
# need these keys to be *present* (module init throws on missing ones) — the
# build never opens a DB connection or calls a provider, which is why CI gets
# away with mock values. Real values are injected at runtime by Dokploy.
# See MIGRATION.md §1.7 for the NUXT_-prefix caveat this depends on.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    DIRECT_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    AUTH_SECRET="build-time-placeholder-not-used-at-runtime" \
    STRIPE_SK="sk_test_build_placeholder" \
    STRIPE_WEBHOOK_SECRET="whsec_build_placeholder" \
    XAI_API_KEY="build-placeholder" \
    OPENMODERATOR_API_KEY="build-placeholder" \
    EMAIL_FROM="build@example.com" \
    NUXT_MAIL_USER="build@example.com" \
    AWS_ACCESS_KEY_ID="build-placeholder" \
    AWS_SECRET_ACCESS_KEY="build-placeholder" \
    AWS_REGION="eu-central-1" \
    AWS_S3_BUCKET_NAME="build-placeholder"

COPY package.json bun.lock ./
# postinstall runs `nuxt prepare`, which boots the modules — hence the env above
# must already be set at install time, not just at build time.
RUN bun install --frozen-lockfile

COPY . .

# SENTRY_AUTH_TOKEN is the one genuinely sensitive build-time value (sourcemap
# upload). Mounted as a build secret so it never lands in a layer or in the
# image history — Dokploy exposes these under "Build Secrets", not "Build Args".
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    if [ -f /run/secrets/SENTRY_AUTH_TOKEN ]; then \
      export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; \
    fi; \
    bun run build:docker

# ---- runtime --------------------------------------------------------------
FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app

# openssl: Prisma query engine. ca-certificates: outbound TLS (AWS, Stripe, AI
# providers). curl: Dokploy's Swarm health-check field shells out to it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    APP_ENV=production \
    NUXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000 \
    RUN_MIGRATIONS=false

# node_modules ships whole so `prisma migrate deploy` (a devDependency) and the
# native addons (argon2, @takumi-rs/core-linux-x64-gnu) are available at release
# time. Costs image size; see MIGRATION.md §4 for the slimming follow-up.
COPY --from=build --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/.output ./.output
COPY --from=build --chown=bun:bun /app/prisma ./prisma
COPY --from=build --chown=bun:bun /app/package.json ./package.json
COPY --chown=bun:bun docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", ".output/server/index.mjs"]
