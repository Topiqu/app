# MIGRATION.md — Serverless (Vercel) → Self-hosted (VPS/container)

Execution plan for moving **topiqu-blog** off Vercel serverless onto a containerized,
self-hosted long-running runtime. Companion to `MAP.md` (architecture SoT); this file is
the migration playbook and is deleted once the migration is complete.

## 0. Decision & Drivers

Confirmed drivers (all three): **capability limits**, **vendor lock-in**, **cost**.
Because all three point the same way, the target is **fully off Vercel** (not a Vercel +
worker hybrid, which leaves the lock-in unsolved). The migration is **phased** so every
phase ships to production green and is independently revertible.

**Target runtime:** containerized Nitro `node-server` (bun runtime) behind Cloudflare,
self-hosted Redis on the box, **managed Postgres kept** (Neon/RDS — self-hosting the DB
adds ops risk and is unrelated to the Vercel lock-in).

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
| Chromium-in-Lambda for PDF | `playwright-core` in `server/api/articles/export-pdf.post.ts`, `server/api/users/pdf.get.ts` | On a box, install a full headless Chromium in the image; drop Lambda-specific launch shims |
| No long-running worker | `todo` "queue (SQS migration)" epic | `server/worker.ts` (poller) finally has a home; unblocks fan-out generation + push |
| Vercel edge cache / previews / rollbacks | Vercel platform | Replaced by Cloudflare CDN + Docker image tags + blue/green (accept the DX loss) |

**Stays as-is (no chromium):** OG images use `@takumi-rs/*` (Rust/WASM), not a browser —
no change needed. AWS SDK (S3/Rekognition/SES) is already in use, so AWS familiarity and
creds handling carry over.

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
- **0.4 Cron consolidation.** Fix `community-insights` to a valid 5-field cron. Decide the
  scheduler: keep `nitro.scheduledTasks` (runs natively once we're on a persistent process)
  and delete the `vercel.json` `crons` entry **in Phase 1**, not now. Document the intended
  schedule table in `MAP.md §4`.
- **0.5 Health endpoint.** Ensure `GET /api/health` returns `{"status":"ok"}` (needed by
  Cloudflare/load-balancer health checks and the Better Stack uptime monitor from `todo`).

Exit criteria: all tests green on Vercel; no behavioral change in prod.

### Phase 1 — Containerize + single box (cutover)

- **1.1 Preset switch.** `node-server` preset for the self-hosted build (keep `vercel`
  reachable behind an env flag until cutover is proven).
- **1.2 Dockerfile.** Multi-stage bun build (see §4). Bundle headless Chromium for the PDF
  routes. Output a single runnable image; `worker.ts` runs from the **same image** with a
  different entry command.
- **1.3 docker-compose (local + staging parity).** Services: `web`, `worker`, `redis`,
  plus **LocalStack** (already in the `todo` epic) for future SQS. Postgres points at the
  managed instance (or a local PG for dev).
- **1.4 Reverse proxy.** **Caddy** with **on-demand TLS** in front — required for the
  wildcard `*.topiqu.com` tenant subdomains + apex + `app.topiqu.com` without pre-minting a
  cert per tenant. (Alt: Nginx + a wildcard cert via DNS-01, but on-demand is less ops.)
- **1.5 Process supervision.** systemd units (or docker-compose `restart: always`) for
  `web` + `worker` as separate services.
- **1.6 CDN / edge.** Cloudflare in front of the box: CDN for `_nuxt/*` immutable assets
  (headers already set in `vercel.json` — re-express as Nitro `routeRules`/Caddy headers),
  and aggressive edge caching for anonymous traffic (this is where the lost Vercel
  auto-scale is compensated — see §5 risk).
- **1.7 Secrets.** Move env from Vercel dashboard to the box (systemd `EnvironmentFile` or a
  secrets manager). Re-provision Redis creds as `REDIS_URL`; the Upstash marketplace
  integration is dropped. Rotate anything that was Vercel-injected.
- **1.8 DNS cutover.** Point `app.topiqu.com` + `*.topiqu.com` at Cloudflare → box.
  **Keep the apex `topiqu.com` landing project on Vercel** (it's a separate project, see
  `MAP.md §4` host topology — out of scope for this migration). Verify OAuth still lands on
  `app.topiqu.com` (authorized redirect URIs unchanged).
- **1.9 Delete `vercel.json` crons**; native `scheduledTasks` now drive everything.

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
| Compute | Pro seat + per-invocation + wall-clock (streaming + chromium are the expensive paths) | 1 VPS, e.g. Hetzner CCX23 (4 dedicated vCPU / 16 GB) ≈ €30, or CPX41 shared ≈ €25 |
| Redis | Upstash pay-per-request | Self-hosted on the box (€0 incremental) |
| CDN / edge | Included | Cloudflare Free, or Pro ≈ $20 |
| Postgres | (already managed) | unchanged |
| Bandwidth | Vercel egress pricing | Cloudflare-fronted (cheaper egress) |

**Assumptions to verify:** pull the actual Vercel usage breakdown (functions GB-hours,
edge requests, bandwidth) — the win is largest if chromium/AI-streaming wall-clock is a
big line item. Flat VPS cost is predictable; the trade is you now pay for peak capacity
even when idle (no scale-to-zero).

## 4. Skeletons

### Dockerfile (multi-stage, bun)

```dockerfile
# ---- build ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun zenstack:generate \
 && NITRO_PRESET=node-server bun run build   # prisma migrate deploy runs at release, not build

# ---- runtime ----
FROM oven/bun:1-slim AS runtime
WORKDIR /app
# headless chromium for PDF export routes (playwright-core)
RUN apt-get update && apt-get install -y --no-install-recommends chromium \
 && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
# web:    bun run .output/server/index.mjs
# worker: bun run .output/server/worker.mjs   (same image, different CMD)
CMD ["bun", "run", ".output/server/index.mjs"]
```

Notes: run `prisma migrate deploy` as a **release step** (compose `depends_on` or a
one-shot job), not in the image build, so migrations don't run at image-build time.

### Caddyfile (wildcard tenant TLS)

```caddyfile
{
	on_demand_tls {
		ask http://localhost:3000/api/tls-check   # gate cert issuance to known tenants
	}
}

app.topiqu.com, *.topiqu.com {
	tls {
		on_demand
	}
	encode gzip zstd
	@static path /_nuxt/*
	header @static Cache-Control "public, max-age=31536000, immutable"
	reverse_proxy localhost:3000
}
```

`/api/tls-check` must 200 only for hostnames that resolve to a real `ClientSite` (or the
app/apex hosts) — otherwise on-demand TLS is an open cert-minting vector.

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
| On-demand TLS abused to mint certs for arbitrary hosts | High | `/api/tls-check` allowlist bound to real `ClientSite` rows + app/apex hosts |
| Losing preview deploys + instant rollback (DX) | Medium | Image tags + blue/green (two compose stacks) or keep dormant Vercel project one cycle as rollback |
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

## 7. First actionable commit

Phase 0.1 + 0.2: `server/utils/redis.ts` (provider interface + Upstash & ioredis impls,
`cache.ts` refactored onto it, TEMPORARY logs removed) and `server/utils/queue.ts`
(interface + in-memory provider) with Vitest coverage for both. Ships on Vercel, zero
behavioral change, valuable regardless of final destination.
