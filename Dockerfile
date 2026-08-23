# syntax=docker/dockerfile:1
# base (https://hub.docker.com/r/oven/bun/tags)
FROM oven/bun:1.3.14-slim AS base

WORKDIR /usr/src/app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssl

# install
FROM base AS install

RUN mkdir -p /temp

COPY package.json bun.lock /temp/

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    cd /temp && bun --bun install --shamefully-hoist --frozen-lockfile

# pre-release
FROM base AS prerelease

COPY --from=install /temp/node_modules node_modules
COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

ENV NODE_ENV=production
ENV NITRO_PRESET=bun
RUN bun --bun run build

# release
FROM base AS release

COPY --from=prerelease /usr/src/app/.output .

EXPOSE 3000:3000
ENTRYPOINT [ "bun", "--bun", "server/index.mjs" ]
