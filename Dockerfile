# syntax=docker/dockerfile:1
# base (https://hub.docker.com/r/oven/bun/tags)
FROM oven/bun:1.4.3-slim AS base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssl

# install
FROM base AS install

ARG TARGETARCH

WORKDIR /temp

COPY package.json bun.lock ./
COPY patches ./patches

RUN --mount=type=cache,id=topiqu-app-bun-${TARGETARCH},target=/root/.bun/install/cache,sharing=locked \
    BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache \
    bun --bun install --shamefully-hoist --frozen-lockfile

# pre-release
FROM base AS prerelease

COPY --from=install /temp/node_modules node_modules
COPY . .

ENV NODE_ENV=production
ENV NITRO_PRESET=bun
ENV NUXT_TELEMETRY_DISABLED=1
RUN bun --bun run build

# release
FROM base AS release

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

RUN chown bun:bun /usr/src/app
COPY --from=prerelease --chown=bun:bun /usr/src/app/.output .
USER bun

HEALTHCHECK --interval=30s --timeout=6s --start-period=30s --retries=3 CMD bun -e "const port = process.env.NITRO_PORT || process.env.PORT || '3000'; const r = await fetch('http://127.0.0.1:' + port + '/api/health', { signal: AbortSignal.timeout(5000) }); if (!r.ok) process.exit(1)"

EXPOSE 3000
ENTRYPOINT [ "bun", "--bun", "server/index.mjs" ]
