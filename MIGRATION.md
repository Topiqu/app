# MIGRATION.md — Serverless (Vercel) → Self-hosted (VPS/container)

Execution plan for moving **topiqu-blog** off Vercel serverless onto a containerized,
self-hosted long-running runtime. Companion to `MAP.md` (architecture SoT); this file is
the migration playbook and is deleted once the migration is complete.

## 0. Decision & Drivers

Confirmed drivers (all three): **capability limits**, **vendor lock-in**, **cost**.
Because all three point the same way, the target is **fully off Vercel** (not a Vercel +
worker hybrid, which leaves the lock-in unsolved). The migration is **phased** so every
phase ships to production green and is independently revertible.

**Target runtime:** containerized Nitro `node-server` (bun runtime) on a VPS, orchestrated
by **Dokploy** (Docker Swarm + Traefik) behind Cloudflare, self-hosted Redis on the box,
**managed Postgres kept** (Neon/RDS — self-hosting the DB adds ops risk and is unrelated to
the Vercel lock-in).

Dokploy absorbs several steps this playbook originally specified by hand: the reverse proxy
(**Traefik**, so no Caddy), zero-downtime deploys + rollback (Swarm `start-first` /
`FailureAction: rollback`), preview deployments on a wildcard domain, S3 database backups,
and a cron runner (Schedule Jobs). What it does **not** solve is wildcard TLS for tenant
subdomains and cron-vs-replicas — see §5.

**Non-goals (initially):** Kubernetes, multi-region, DB self-hosting, full SQS. These are
Phase 3+ and only if scale demands them.

## 1. Current serverless-coupling inventory (grounded in code)

| Coupling point | Where | Migration impact |
| --- | --- | --- |
| Nitro preset `vercel` (prod) | `nuxt.config.ts:43` (`$production`) | Switch to `node-server`; `bun` preset already the default |
| Vercel cron (single) | `vercel.json` `crons` — only `publish-check` **daily** | **Broken today**: `nuxt.config.ts:63` declares 5 `scheduledTasks` (`publish-check` 10m, `generate-article`, `sentiment-analysis` 30m, `community-insights`, `translate-pending` 5m) that Vercel never runs; `community-insights` cron `'0 3 * * * *'` has **6 fields** (invalid). Native scheduler fixes all of it. |
| Upstash Redis over HTTP/REST | `server/utils/cache.ts` (`@upstash/redis`) | Swap for TCP Redis (`ioredis`) behind the same `cached`/`bumpGen`/`getGen` interface; injected creds (`UPSTASH_REDIS_REST_*`) become a self-hosted `REDIS_URL` |
| Notifications = polling (no push) | `MAP.md §4`; `Notification/Bar.vue` polls `/api/notifications/poll` every 10s | Long-running process re-enables SSE/WebSocket push (removed SSE layer can return) |
| Disconnect-safe billing complexity | `server/utils/ai/article.ts` + `POST /api/articles/generate` (commit `3fb6139`) | Persistent process lets us simplify abort/billing once streams aren't fighting serverless connection teardown |
| No long-running worker | `todo` "queue (SQS migration)" epic | `server/worker.ts` (poller) finally has a home; unblocks fan-out generation + push |
| Vercel edge cache / previews / rollbacks | Vercel platform | Cloudflare CDN + Dokploy preview deployments + Swarm rollback — closer to parity than a hand-rolled box would be |
| `vercel.json` response headers | `/_nuxt/*` cache-control, `manifest.webmanifest` + `sitemap.xml` content-type | Nitro `node-server` already sets immutable cache headers on `/_nuxt/*`; the content-type overrides must be re-expressed as Nitro `routeRules` before cutover |

**No browser runtime needed.** Both PDF routes (`server/api/articles/export-pdf.post.ts`,
`server/api/users/pdf.get.ts`) are pure `pdfkit` — no Playwright, no Chromium. OG images use
`@takumi-rs/*` (Rust/WASM), also not a browser. The `playwright-core` dependency was dead
weight and has been **removed** (it was never imported anywhere). This keeps the runtime
image small and drops a whole class of Lambda-shim/image-bloat work.

AWS SDK (S3/Rekognition/SES) is already in use, so AWS familiarity and creds handling carry
over unchanged.

## 2. Phased roadmap

### Phase 0 — Decouple in-place (still deployed on Vercel, zero infra change)

Goal: remove Vercel-specific assumptions from the code while production stays on Vercel.
Every step here is valuable even if the migration stalls.

- **0.1 Redis behind an interface.** Introduce `server/utils/redis.ts` exposing a minimal
  client contract (`get/set/incr/expire`). Refactor `cache.ts` to depend on it. Keep the
  Upstash impl as the default provider; add an `ioredis` provider selected by env
  (`REDIS_URL` present → TCP, else `UPSTASH_REDIS_REST_*` → HTTP). Unit-test both against
  the same contract. Remove the `TEMPORARY` HIT/MISS `console.info` lines in `cache.ts`
  (they were for prod validation and will spam a long-running process).
- **0.2 Queue abstraction.** `server/utils/queue.ts` — `enqueue(job)` / `subscribe(handler)`
  with an **in-memory provider** (works on one process) and a **Redis-stream provider**
  (works across replicas). Interface must be SQS-shaped so a later SQS provider is a drop-in.
  Prisma models `ArticleJob`, `PdfJob` (from the `todo` queue epic). Unit tests with the
  in-memory provider.
- **0.3 Worker skeleton.** `server/worker.ts` — a standalone entrypoint that boots Nitro's
  context and runs N pollers over `queue.ts`. No consumers migrated yet; it starts, logs,
  and idles. Runnable locally via a `worker` script.
- **0.4 Cron consolidation.** ✅ `community-insights` fixed to a valid 5-field cron
  (`0 3 * * *`). Scheduler decision: keep `nitro.scheduledTasks` (runs natively once we're
  on a persistent process) and delete the `vercel.json` `crons` entry **in Phase 1**, not
  now. Still open: document the intended schedule table in `MAP.md §4`, and settle the
  cron-vs-replicas hazard in §5.
- **0.5 Health endpoint.** ✅ `GET /api/health` exists and is wired into the image
  `HEALTHCHECK`. Also used by the Swarm health check and the Better Stack uptime monitor.

Exit criteria: all tests green on Vercel; no behavioral change in prod.

### Phase 1 — Containerize + single box (cutover)

- **1.1 Preset switch.** ✅ `nuxt.config.ts` `$production.nitro.preset` reads
  `process.env.NITRO_PRESET` and falls back to `vercel`, so Vercel stays the default until
  cutover is proven. The Docker build sets `NITRO_PRESET=node-server`. An explicit config
  value would have beaten the env var, hence the indirection.
- **1.2 Dockerfile.** ✅ `Dockerfile` + `.dockerignore` + `docker-entrypoint.sh` at repo
  root — multi-stage bun (`oven/bun:1.3.14` → `-slim`), non-root `bun` user, `HEALTHCHECK`
  on `/api/health`. No Chromium (see §1). Needs BuildKit for the secret mount (Dokploy uses
  buildx). `worker.ts` will run from the **same image** with a different command once it
  exists. Dokploy config: build type **`dockerfile`**.
  - **Migrations run at container start, not at image build.** `bun run build` (Vercel path)
    still runs `prisma migrate deploy`; the image uses `bun run build:docker`, which does
    not. `docker-entrypoint.sh` runs `bun run release` when `RUN_MIGRATIONS=true` — set that
    on the `web` service only, leave it false on `worker`. Keeping it in the entrypoint
    rather than a platform hook means it does not depend on any Dokploy-specific deploy-hook
    feature. Rolling back to an older tag applies nothing (`migrate deploy` only moves
    forward). Once Vercel is decommissioned, collapse `build` into `build:docker`.
  - **Build args vs build secrets.** `postinstall` runs `nuxt prepare`, which boots the
    modules and throws on missing keys — so those keys must exist at install time. The
    Dockerfile handles this in two tiers: **public** values (`STRIPE_PK`,
    `TURNSTILE_SITE_KEY`, `NUXT_PUBLIC_SENTRY_DSN`, `CDN_URL`, …) are plain `ARG`s, supplied
    from Dokploy **Build Args**; runtime credentials get non-functional **placeholders** in
    the build stage only (the build never opens a DB connection or calls a provider, which
    is why CI passes with mocks) and real values arrive at runtime from Dokploy's
    environment. `SENTRY_AUTH_TOKEN` is the one genuinely sensitive build-time value and is
    mounted via `--mount=type=secret` from Dokploy **Build Secrets** — per Dokploy's docs,
    build args are visible in the image and build history, so tokens must not go there.
  - **⚠️ Verify the placeholder assumption before cutover.** Nitro resolves `runtimeConfig`
    defaults at build time and bakes them into `.output`; at runtime only `NUXT_`-prefixed
    vars override them. So a placeholder baked into e.g. `runtimeConfig.xai.apiKey` is
    overridden by `NUXT_XAI_API_KEY` but **not** by a bare `XAI_API_KEY`. Ties directly into
    the prefix audit in 1.7 — walk `runtimeConfig` key by key on staging and confirm each
    one reads its real value, before any production traffic.
  - **Swarm health check.** Dokploy's health-check field shells out to `curl`, so `curl` is
    installed in the runtime stage. Point it at `/api/health` (not `/health`).
  - **Follow-up:** the runtime stage copies the whole `node_modules` (so the `prisma` CLI
    and the native addons `argon2` / `@takumi-rs/core-linux-x64-gnu` are present at release
    time). Slim this later with a dedicated migration stage; not worth blocking cutover.
- **1.3 docker-compose (local + staging parity).** Services: `web`, `worker`, `redis`,
  plus **LocalStack** (already in the `todo` epic) for future SQS. Postgres points at the
  managed instance (or a local PG for dev). On the server this is a Dokploy Compose stack;
  the repo copy exists for local/staging parity.
- **1.4 Reverse proxy — provided by Dokploy (Traefik).** No Caddy, no systemd units, no
  hand-written proxy config. What still needs deciding is **wildcard TLS for the
  `*.topiqu.com` tenant subdomains**, which Dokploy's default per-domain HTTP-01 flow does
  not cover. Options, in preference order:
  1. **Cloudflare proxied + Origin CA certificate** (SSL mode *Full (Strict)*). One
     long-lived wildcard origin cert that Traefik just serves. Cloudflare is wanted in front
     anyway for edge caching (1.6), so this adds no new moving part. **Recommended.**
  2. **Traefik `certResolver` with a Let's Encrypt DNS-01 challenge** (Cloudflare API
     token), configured in `/etc/dokploy/traefik/traefik.yml`. Works, but it is manual state
     outside the Dokploy UI and can be clobbered by platform upgrades.
  3. **Cloudflare Tunnel** with a wildcard `CNAME` and a `*` published route to Traefik.
     Documented by Dokploy, but adds a hop.

  Whichever is chosen, the old Caddy `on_demand_tls` + `/api/tls-check` design is **dropped**
  — Traefik has no on-demand TLS equivalent, and with a wildcard cert the open cert-minting
  vector it guarded against no longer exists.
- **1.5 Process supervision — provided by Dokploy.** Swarm restarts services; configure the
  update policy for zero-downtime deploys with automatic rollback:
  `{"Parallelism": 1, "Delay": 10000000000, "FailureAction": "rollback", "Order": "start-first"}`.
  `web` and `worker` stay separate services off the same image.
- **1.6 CDN / edge.** Cloudflare in front of the box: CDN for `_nuxt/*` immutable assets and
  aggressive edge caching for anonymous traffic (this is where the lost Vercel auto-scale is
  compensated — see §5 risk). Nitro `node-server` already emits immutable cache headers on
  `/_nuxt/*`; the `manifest.webmanifest` + `sitemap.xml` content-type overrides from
  `vercel.json` must be re-expressed as Nitro `routeRules`.
- **1.7 Secrets.** Move env from the Vercel dashboard into Dokploy's environment (per app,
  injected at build and runtime — never baked into an image layer; `.dockerignore` excludes
  `.env`). Re-provision Redis creds as `REDIS_URL`; the Upstash marketplace integration is
  dropped. Rotate anything that was Vercel-injected.
  - **Verify `NUXT_` prefix mapping when re-entering values.** Runtime config overrides are
    path-derived: `runtimeConfig.public.cdnUrl` is overridden by `NUXT_PUBLIC_CDN_URL`, not
    by the `NUXT_CDN_URL` that `.env.example` lists. Values that currently work only because
    of a hardcoded default will silently keep that default. Walk the list key by key.
  - **`APP_ENV=production` is mandatory.** `nuxt.config.ts` and `server/utils/logger.ts`
    fall back to `VERCEL_ENV`, which does not exist off Vercel. Without `APP_ENV` production
    behaves as `development` (Sentry `tracesSampleRate` 1.0, dev logging).
- **1.8 DNS cutover.** Point `app.topiqu.com` + `*.topiqu.com` at Cloudflare → box.
  **Keep the apex `topiqu.com` landing project on Vercel** (it's a separate project, see
  `MAP.md §4` host topology — out of scope for this migration). Verify OAuth still lands on
  `app.topiqu.com` (authorized redirect URIs unchanged).
- **1.9 Delete `vercel.json`** — crons (native `scheduledTasks` now drive everything) and
  headers (moved to `routeRules`, see 1.6).

Exit criteria: full user-facing flow (auth/OAuth, article CRUD, AI streaming, PDF export,
notifications poll, Stripe webhook) verified on the box; Vercel app project can be
decommissioned (keep it dormant one billing cycle as instant rollback).

### Phase 2 — Reclaim what serverless forbade

- **2.1 Push notifications.** Re-introduce an SSE (or WebSocket) channel now that a process
  persists; migrate `Notification/Bar.vue` off 10s polling. Single-replica: in-memory
  pub/sub. Multi-replica: fan-out via Redis pub/sub. (`MAP.md §4` documents the removed SSE
  layer as the reference design.)
- **2.2 Fan-out generation.** `cron generate-article` enqueues N jobs; `worker.ts` consumes.
  `POST /api/articles/generate` can move to `202 + jobId` + a `useJobStream` composable
  (from the `todo` queue epic) — or stay synchronous-streaming, now without the
  serverless-driven disconnect fragility.
- **2.3 PDF worker.** `GET /users/pdf` → enqueue → `pdf-worker` (S3 upload + signed URL),
  removing chromium from the request path.
- **2.4 Simplify AI billing.** Revisit the disconnect-safe billing branches in
  `article.ts` now that the process doesn't tear down mid-stream.
- **2.5 View counter batching.** Enqueue view events, batch-UPDATE every 5 min in the worker
  (reduces write amplification that also drove the `STALE` translation churn note in `MAP.md §6`).

### Phase 3 — Scale-out (only when a single box is the bottleneck)

- Horizontal replicas → load balancer (Caddy/Cloudflare) → **the "1 vs N replicas"
  decision** (top of the `todo` queue epic). N replicas forces cross-replica pub/sub
  (Redis or a real broker) for push, and either the Redis-stream queue or **SQS + DLQ +
  IAM** for jobs. CloudWatch/Better Stack alarms on queue depth + DLQ.
- This is the natural moment to adopt SQS if managed durability/DLQ is wanted; the
  `queue.ts` abstraction from Phase 0 makes it a provider swap, not a rewrite.

## 3. Cost model (estimate — validate against real Vercel invoice before committing)

Ballpark monthly, assuming current low-to-moderate traffic:

| Item | Vercel serverless (now) | Self-hosted target |
| --- | --- | --- |
| Compute | Pro seat + per-invocation + wall-clock (AI streaming is the expensive path) | 1 VPS, e.g. Hetzner CCX23 (4 dedicated vCPU / 16 GB) ≈ €30, or CPX41 shared ≈ €25. Dokploy itself is free/self-hosted |
| Redis | Upstash pay-per-request | Self-hosted on the box (€0 incremental) |
| CDN / edge | Included | Cloudflare Free, or Pro ≈ $20 |
| Postgres | (already managed) | unchanged |
| Bandwidth | Vercel egress pricing | Cloudflare-fronted (cheaper egress) |

**Assumptions to verify:** pull the actual Vercel usage breakdown (functions GB-hours,
edge requests, bandwidth) — the win is largest if AI-streaming wall-clock is a big line
item. Flat VPS cost is predictable; the trade is you now pay for peak capacity even when
idle (no scale-to-zero).

## 4. Skeletons

### Dockerfile

**Lives at the repo root** (`Dockerfile`, `.dockerignore`, `docker-entrypoint.sh`) — no
longer a skeleton. See Phase 1.2 for the design decisions encoded in it (entrypoint
migrations, build args vs build secrets, the `node_modules` size trade-off).

The worker will reuse the same image with a different command once `server/worker.ts`
exists: `bun run .output/server/worker.mjs`.

### Reverse proxy

Dokploy ships Traefik and manages the routing/TLS config. Nothing to hand-write here — the
only open decision is the wildcard-TLS strategy in Phase 1.4.

### docker-compose (staging parity)

```yaml
services:
  web:
    build: .
    command: bun run .output/server/index.mjs
    env_file: .env
    depends_on: [redis]
  worker:
    build: .
    command: bun run .output/server/worker.mjs
    env_file: .env
    depends_on: [redis]
  redis:
    image: redis:7-alpine
    restart: always
  localstack:            # future SQS provider
    image: localstack/localstack
    environment: { SERVICES: sqs }
```

## 5. Risk register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Loss of auto-scale — one tenant goes viral, single box saturates | High | Cloudflare edge-cache anon traffic hard (ties into the feed-cache/canary epic in `todo` "done"); size the VPS with headroom; Phase 3 horizontal scale ready via `queue.ts` |
| **`scheduledTasks` fire once per replica** — scale `web` to 2 and `generate-article` produces two articles, `gam-sync` double-counts revenue, billing tasks double-charge | **High** | Decide **before** scaling: keep `web` at 1 replica, or move tasks into the single-replica `worker` service (Phase 0.3), or drop `nitro.scheduledTasks` for Dokploy Schedule Jobs hitting a `CRON_SECRET`-guarded endpoint. Dokploy makes scaling a one-click action, which is exactly why this must be settled first |
| Wildcard TLS for `*.topiqu.com` not covered by Dokploy's per-domain HTTP-01 flow | High | Phase 1.4 — Cloudflare Origin CA wildcard cert under Full (Strict) is the recommended path |
| Losing preview deploys + instant rollback (DX) | Low/Med | Dokploy preview deployments on a wildcard domain + Swarm `FailureAction: rollback`; keep the dormant Vercel project one cycle as the outer rollback |
| OAuth/session cookie regression across `*.topiqu.com` | Medium | Cookie domain `.topiqu.com` unchanged; verify redirect-URI host is still `app.topiqu.com` (`MAP.md §4`) before DNS cutover |
| Chromium image bloat / PDF route regressions | Medium | Pin chromium; smoke-test both PDF routes in CI on the built image |
| You now own OS patching / uptime / security surface | Medium | Better Stack uptime + heartbeats (already in `todo`, unblocked by a live box); unattended-upgrades; minimal image |
| Secret sprawl during cutover | Medium | Single `EnvironmentFile`; rotate all Vercel-injected creds; never bake secrets into the image |
| DB connection pool exhaustion (persistent process vs per-invocation) | Low/Med | Prisma pool sizing + PgBouncer if managed PG needs it (serverless used per-invocation connections) |

## 6. Rollback strategy

- Phase 0 is pure code, deployed on Vercel — revert = normal PR revert.
- Phase 1 cutover is a **DNS switch**. Keep the Vercel app project deployed and dormant for
  one billing cycle; rollback = point DNS back. Redis/queue data in Phase 0/1 is
  cache/ephemeral, so no stateful migration to unwind.
- Postgres is unchanged throughout, so there is no data migration to roll back.

## 7. Status & next commit

**Done (ships on Vercel, zero behavioral change):**

- `playwright-core` removed — dead dependency, no Chromium anywhere in the stack (§1).
- `Dockerfile` + `.dockerignore` (Phase 1.2).
- `build:docker` / `release` scripts split so migrations are a release step (Phase 1.2).
- `NITRO_PRESET` indirection, Vercel still the production default (Phase 1.1).
- `community-insights` cron fixed from an invalid 6-field expression (Phase 0.4).

**Next commit — Phase 0.1 + 0.2:** `server/utils/redis.ts` (provider interface + Upstash &
ioredis impls, `cache.ts` refactored onto it, TEMPORARY HIT/MISS logs removed) and
`server/utils/queue.ts` (interface + in-memory provider), with Vitest coverage for both.

**Before any cutover, settle the two §5 High risks:** the wildcard-TLS strategy (Phase 1.4)
and cron-vs-replicas.
