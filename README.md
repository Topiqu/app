<h1 align="center">Topiqu AI Blog</h1>

<p align="center">
  A multi-tenant publishing platform with an AI-assisted editor and AI visibility monitoring.
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=nuxt,vue,ts,tailwind,pinia,bun,postgres,docker,aws,vitest" alt="Nuxt, Vue, TypeScript, Tailwind CSS, Pinia, Bun, PostgreSQL, Docker, AWS and Vitest" width="480" />
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#stack">Stack</a> ·
  <a href="#verification">Verification</a> ·
  <a href="#production-build">Production</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

## Features

- 📝 **AI-assisted publishing** — Tiptap editor, article generation, drafts, translations and recoverable source-article versions.
- 🌐 **Client sites** — isolated tenants, subdomains, custom domains and configurable site widgets.
- 🧭 **Onboarding website import** — background AI suggestions for branding, editorial settings and knowledge sources, applied after review.
- 🔎 **SEO & AI visibility** — search insights, citation monitoring and content opportunities.
- 💬 **Community** — comments, follows and reader notifications.
- 💳 **Billing** — Stripe subscriptions and article packs.
- 🔐 **Access & localization** — tenant access policies, OTP / 2FA and English, Czech, German and French.

## Quick start

**Requirements:** Bun **1.4.4**, Node **24.21.0** and Docker. Bun is pinned in [package.json](./package.json), Docker and CI; Node is pinned in [.node-version](./.node-version) for Nuxt compilation, Vue type checking and browser tests.

**1. Configure your environment**

Copy [.env.example](./.env.example) to `.env` and configure the services needed for your work.

**2. Install dependencies and generate the ORM**

```sh
bun install --frozen-lockfile
bun run zenstack:generate
```

**3. Start the database, seed it and launch Nuxt**

```sh
bun run db:up
bun run db:migrate:deploy
bun run db:seed
bun --bun run dev
```

`db:up` starts the PostgreSQL service in `docker-compose.yml`; `dev` starts Nuxt only.
Redis/Valkey is optional and must be provisioned separately, with `REDIS_URL` pointing to it.
The application bypasses shared caching when it is absent or unavailable.

<details>
<summary><strong>Database management</strong></summary>

`db:reset` and `db:fresh` **delete the local database volume** defined in `docker-compose.yml`.

```sh
bun run db:down    # stop local services
bun run db:reset   # delete volumes and recreate services
bun run db:fresh   # reset, migrate and seed
```

ZenStack generates ignored schema metadata and TypeScript types in `generated/zenstack/`. The application uses ZenStack ORM directly; Prisma is an internal migration dependency of the ZenStack CLI.

</details>

## Stack

| Area                | Technology                             |
| ------------------- | -------------------------------------- |
| **Application**     | Nuxt 4 · Vue 3.5 · TypeScript          |
| **UI**              | Nuxt UI 4 · Tailwind CSS 4 · Reka UI   |
| **State & queries** | Pinia · Pinia Colada                   |
| **Data**            | ZenStack ORM 3 · PostgreSQL · pgvector |
| **Editor**          | Tiptap 3 with custom extensions        |
| **AI**              | AI SDK 7 · Claude Haiku 5.5 · OpenAI   |
| **Runtime**         | Bun 1.4.4 · Node 24.21.0               |

<details>
<summary><strong>Integrations and tooling</strong></summary>

- **Authentication:** Better Auth, ZenStack adapter, argon2 and OTP / 2FA.
- **Billing:** Stripe subscriptions and article packs.
- **Media & email:** AWS S3 / Rekognition / SES, Sharp, MJML 5, PDFKit and Takumi OG images.
- **Cache:** optional Redis / Valkey over `REDIS_URL`, using `ioredis`; it is not started by `db:up`.
- **AI visibility:** native search adapters for visibility providers; each key in [.env.example](./.env.example) enables one.
- **Testing:** Vitest, Nuxt Test Utils, jsdom and Playwright.
- **Code quality:** ESLint, Prettier and vue-tsc.

</details>

## Verification

Generate the ZenStack artifacts before checking a fresh checkout.

```sh
bun run zenstack:generate
bun run lint
bun run typecheck
bun run openapi:check
bun run test
bun run prettier
```

<details>
<summary><strong>Watch mode and coverage</strong></summary>

```sh
bun run test:watch
bun run test:coverage
```

</details>

<details>
<summary><strong>Database and browser tests</strong></summary>

PostgreSQL integration and browser tests require a separate disposable database in `TEST_DATABASE_URL`; they can apply migrations and clear test data. **Never point this variable at a development or production database you want to keep.**

```sh
bun x --no-install playwright install chromium webkit
bun run test:e2e
bun run test:e2e:release
```

</details>

<details>
<summary><strong>Bounded poll maintenance</strong></summary>

The poll backfill is dry-run by default. It reads at most 100 article bodies per batch
(maximum 200) and stops after 1000 candidates unless `--limit` changes that budget.
Use `--site` to constrain a verified target tenant:

```sh
bun scripts/backfill-polls.ts --site CLIENT_SITE_ID --limit 1000 --batch-size 100
bun scripts/backfill-polls.ts --site CLIENT_SITE_ID --after LAST_ID --limit 1000
```

The summary reports candidates, missing IDs, completed repairs, conflicts and a resume
cursor. A cursor means the row budget was reached; the next run may be empty. Conflicts
require a fresh scan from the beginning. After separately authorizing writes against
the exact database target, `APPLY=1` enables repair. Each repair locks and compares the
original article before creating polls, commits IDs and content together, and can be
rerun safely. No historical backfill runs during builds or releases.

</details>

<details>
<summary><strong>Bounded media maintenance</strong></summary>

The media-library backfill enriches existing assets and rebuilds references from articles,
translations and drafts. It is dry-run by default; constrain every invocation to the same
verified tenant and resume with the emitted `nextCursor`:

```sh
bun scripts/backfill-media-library.ts --site CLIENT_SITE_ID --limit 1000 --batch-size 100
bun scripts/backfill-media-library.ts --site CLIENT_SITE_ID --after 'PHASE:LAST_ID' --limit 1000 --batch-size 100
```

Phases run in order: `assets`, `articles`, `translations`, `drafts`. A bare phase cursor
starts that phase; `nextCursor: null` means the scan is complete. The phases share the
row budget, with batches capped at 200. Each document is limited to 1 MiB, 500 media
occurrences and 1000 matching assets; each invocation permits at most 20,000 new asset
identities. Oversized, ambiguous, deleted or concurrently changed rows are preserved and
counted. A `limit` or `asset-budget` stop requires continuation from the emitted cursor.
Dry-run proposals are deduplicated within one invocation and may repeat after resuming.

Only after reviewing the dry-run and separately authorizing writes against the exact
database target, `APPLY=1` enables changes. Each document's asset registration and usage
replacement commit atomically; existing rights, provenance and archive metadata remain
intact. The script never runs during builds, startup or releases.

</details>

<details>
<summary><strong>Live AI checks</strong></summary>

These checks call provider APIs and **incur usage charges**. Model IDs are centralized in [modelRegistry.ts](./server/utils/ai/modelRegistry.ts).

```sh
bun run ai:smoke
bun run eval:ai
bun run knowledge:eval
```

</details>

## Production build

```sh
bun --bun run build    # generate ZenStack artifacts, then build Nuxt
bun --bun run preview
```

Docker deployments apply pending database migrations automatically before starting the server. Outside Docker, `bun run release` applies migrations explicitly (targets `DATABASE_URL`). `bun run build:docker` is an alias for the same build.

<details>
<summary><strong>Docker and runtime details</strong></summary>

The Dockerfile uses the same pinned Bun version and installs from the frozen lockfile. Building an image never connects to or migrates a database and takes no database credentials. `BUN_OPTIONS=--smol` applies only to the Nuxt build command to reduce build memory; the runtime image retains Bun's normal defaults. The final image contains `.output`, including an isolated migration CLI traced from the existing locked Prisma dependency, the schema generated from ZModel and committed SQL history. It runs as the unprivileged `bun` user. Its entrypoint runs `prisma migrate deploy` with Bun, then replaces itself with `server/index.mjs` only after success. No packages are installed at startup. CI applies migrations to its disposable database before the production browser smoke tests.

Nuxt UI detects used components to limit generated theme CSS. Global CSS is inlined in SSR HTML; do not strip remaining stylesheet links indiscriminately, because lazy components can own additional styles. Nitro precompresses static assets with gzip so the origin can serve them without runtime compression; CDN Brotli is independent. Related articles retain SSR markup and hydrate when visible. Release smoke checks cover SSR styles, gzip negotiation and immutable hashed assets.

Upstream Nuxt DevTools and Nuxt UI now contain the behavior previously supplied by their local compatibility patches. Nuxt Image uses a local Fetch bridge in `server/runtime/ipx.ts` because its Nitro 2 Node bridge loses response headers under Bun; module-generated storage and host restrictions remain authoritative. No dependency patch is needed. Verify IPX MIME types/cache/conditional responses, locale switching, click popovers and author hover cards after upgrades.

OG generation retains Nuxt OG Image's DNS/IP and redirect protections. Its Node fetch binding is wrapped only to enforce the shared 15 MiB image byte ceiling; oversized or failed remote sources follow the module's existing omitted-image fallback. Native release smoke should render the seeded article's signed OG URL with its local fixture cover and bundled fonts, avoiding external CDN/provider requests.

Docker dependency caching is scoped to the app and target architecture. Package manifests are copied before application source; local test reports, caches and host-generated ORM files stay outside the build context. BuildKit mounts keep APT indexes out of image layers. The runtime defaults to `NODE_ENV=production`, `HOST=0.0.0.0` and `PORT=3000`, with a writable app working directory owned by `bun`; the healthcheck follows `NITRO_PORT` or `PORT` when overridden. The image still exposes port 3000 by default; publish the configured runtime port if changing it.

Production requires runtime `DATABASE_URL` and an `AUTH_SECRET` of at least 32 characters. Inject these through the deployment environment; do not pass them as Docker build arguments. `CRON_SECRET` is required to call the external cron endpoints; an unset secret always denies access. `PGPOOL_MAX` defaults to 10 connections per process (allowed range 1–100); budget the total across all replicas and workers. Connections wait at most 3 seconds and statements at most 30 seconds. `/api/live` is liveness; `/api/health` is database readiness with a 4-second deadline. Configure the platform probes accordingly. External log delivery is bounded and best-effort; console logs and the database audit remain authoritative.

The native Bun entry counts incoming body bytes before Nitro dispatch for every HTTP method, including chunked requests and missing or false `Content-Length`. Non-multipart bodies allow up to 2,000,000 bytes; multipart bodies allow up to 16 MiB including fields and boundaries. Bun also enforces the 16 MiB transport ceiling. Individual upload routes retain their smaller format/file limits, including 15 MiB images and 10 MiB avatars/knowledge files. Proxies must allow those supported multipart uploads while retaining their own connection and timeout controls.

The Bun server handles `SIGTERM` and `SIGINT`: it stops accepting requests and scheduling work, drains existing HTTP responses and tracked tasks/`waitUntil` work, then awaits all Nitro close hooks, including Redis and the database pool. One shared deadline defaults to 8 seconds; `NITRO_SHUTDOWN_TIMEOUT` accepts 1–300000 milliseconds. Keep the container/platform stop grace longer than that deadline. Repeated signals share the same shutdown. A drain/cleanup failure or elapsed deadline exits with status 1; a deadline forces remaining connections closed. Abrupt kills and unfinished external operations still depend on the task's persisted claim/recovery contract.

Verified custom domains support host-only sign-in sessions. Continue with Topiqu and Google/GitHub use an explicitly confirmed, single-use handoff from the central auth origin; cookies are not copied across domains. `AUTH_ORIGIN`, when pinned, must remain the central auth origin (include the actual port locally). See [custom-domain authentication](docs/custom-domain-auth.md) for isolation, recovery and provider smoke checks.

LinkedIn and Search Console connections also use explicit confirmation on the central auth origin. Their provider callback URLs must resolve to that origin; no per-customer OAuth callback registration is needed. Stripe returns preserve a validated interface locale. Account settings can revoke all other sessions, including sessions on custom domains, while retaining the current session.

Source article saves use database-owned content versions and reject stale writes without discarding the editor draft. The last 50 source-article changes are retained; loading history creates an unsaved editor draft and preserves publication status, URL and schedule. Translation saves compare their last-observed update timestamp. These changes require migration `20261022010000_production_workflows`, which also adds session-origin and durable task-status storage. Reload editors opened before this release before saving; download unsaved work first.

Superadmins can inspect `/master/operations` for shared task status, queues, cache availability and integration failures. A failed webhook can be requeued explicitly with its original delivery ID, after acknowledging possible duplicate processing. This view does not trigger AI generation or change domain infrastructure. See [production workflows](docs/operations/production-workflows.md) for rollout and provider smoke checks.

`bun run perf:check` enforces gzip asset ceilings in [performance-budgets.json](performance-budgets.json) after a production build. Consenting production visitors are sampled for LCP, INP and CLS using the existing Sentry DSN. Field p75 results require production samples; asset checks do not establish those results. The [backup/restore runbook](docs/operations/backup-restore.md) includes a dry-run-first local restore rehearsal, available as `bun run backup:verify --container NAME --source-db TEST_DATABASE`.

Release CI starts the deployment image on a separate empty database and verifies migration startup, non-root execution, Bun 1.4.4, readiness and liveness. Compiled browser checks cover recovery, sessions and operator status in addition to the existing release and wallet scenarios. An upgrade rehearsal against a recent production backup remains an operator step.

Release order is operator-controlled: identify the target database and image, take a backup and verify restore on a separate database, configure runtime credentials, then roll out the tested image. Startup applies pending migrations before serving requests; migration failure exits the container without starting the app. `DIRECT_DATABASE_URL`, when set, is used only by migrations; the app keeps `DATABASE_URL`. Database credentials must permit the committed DDL, and deployment startup/readiness timeouts must allow migrations to finish. Prisma's advisory lock serializes migration attempts across replicas; lock timeout fails startup and requires an orchestrator retry. Keep rolling-release schema changes backward compatible with old replicas. Check readiness, login, tenant access, publication and cron heartbeats. Retain the previous image. Roll it back only if it is compatible with the applied schema; otherwise use a reviewed forward fix or restore the verified backup under a maintenance plan. Never assume rolling back an image rolls back migrations. Neither a Git push nor an image build authorizes these production operations.

Password reset codes issued before the reset hardening change must be requested again: reset tokens now use a separate purpose-bound store, expire in 15 minutes and revoke all previous sessions on success. No new database migration is needed for this change. Existing verification codes for account activation remain separate.

Nuxt compilation uses the Node version pinned in `.node-version` in CI and Docker. Docker copies that binary only into its compiler stage and limits its heap to 4096 MiB; the released image contains no copied Node binary or compiler options. Bun remains the package manager and runs Nuxt preparation, ZenStack generation, migration packaging and the production server. When invoking Nuxt directly through Node, use that pinned version or another version supported by `package.json::engines.node`.

</details>

## Documentation

Custom-domain provisioning configuration, migration order and operational limitations are documented in [Custom domains](./docs/custom-domains.md).

Operations, workflow rollout and field-performance measurement are documented in [Production workflows](./docs/operations/production-workflows.md). Database recovery rehearsals are described in [Backup and restore](./docs/operations/backup-restore.md).

- 🗺️ [Architecture](./MAP.md) — source layout, data flows and implementation details.
- 📐 [Project conventions](./CLAUDE.md) — coding standards and contribution rules.
- [Code quality audit](./CODE_QUALITY_AUDIT.md) — recorded findings and retained-system decisions.
- [Optimization acceptance plan](./docs/plans/2026-10-22-optimization-and-production-readiness.md) — ongoing implementation evidence and remaining release checks.
- [Production audit](./PRODUCTION_AUDIT.md) — dated 20–21 October 2026 evidence, including the versions and environments tested then; it does not certify later changes.

<details>
<summary><strong>Source layout</strong></summary>

```text
app/                 Pages, components, composables, stores and styles
server/              Nitro APIs, routes, tasks and server utilities
shared/              Shared schemas, types and utilities
prisma/              ZenStack source schema and SQL migrations
generated/zenstack/  Generated ORM schema and types (ignored)
extensions/          Custom Tiptap extensions
emails/              MJML templates and translations
i18n/                Application translations for en, cs, de and fr
scripts/             Verification, backfill and maintenance commands
tests/               Unit, server, database, evaluation and browser tests
```

</details>

Use translated UI strings, Vue Composition API with `script setup` and TypeScript, and template-first SFCs. Prefer Nuxt UI components and Tailwind utilities. Update `MAP.md` when changing the structure or adding functionality.
