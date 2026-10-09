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

- 📝 **AI-assisted publishing** — Tiptap editor, article generation, drafts and translations.
- 🌐 **Client sites** — isolated tenants, subdomains, custom domains and configurable site widgets.
- 🔎 **SEO & AI visibility** — search insights, citation monitoring and content opportunities.
- 💬 **Community** — comments, follows and reader notifications.
- 💳 **Billing** — Stripe subscriptions and credit top-ups.
- 🔐 **Access & localization** — tenant access policies, OTP / 2FA and English, Czech, German and French.

## Quick start

**Requirements:** Bun **1.4.2**, Node **24.21.0** and Docker. Versions are pinned in [.prototools](./.prototools) and [.node-version](./.node-version); Node is needed for Vue type checking and browser tests.

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

The database and cache start through `db:up`; `dev` starts Nuxt only.

<details>
<summary><strong>Database management</strong></summary>

`db:reset` and `db:fresh` **delete local database and cache volumes**.

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
| **AI**              | AI SDK 7 · OpenAI Responses API        |
| **Runtime**         | Bun 1.4.2 · Node 24.21.0               |

<details>
<summary><strong>Integrations and tooling</strong></summary>

- **Authentication:** Better Auth, ZenStack adapter, argon2 and OTP / 2FA.
- **Billing:** Stripe subscriptions and credit top-ups.
- **Media & email:** AWS S3 / Rekognition / SES, Sharp, MJML 5, PDFKit and Takumi OG images.
- **Cache:** optional Redis / Valkey.
- **AI visibility:** native search adapters for visibility providers; see [provider setup](./docs/ai-visibility-providers.md).
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
<summary><strong>Live AI checks</strong></summary>

These checks call provider APIs and **consume credits**. Model IDs are centralized in [modelRegistry.ts](./server/utils/ai/modelRegistry.ts).

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

Apply database migrations with `bun run release` (targets `DATABASE_URL`). `bun run build:docker` is an alias for the same build.

<details>
<summary><strong>Docker and runtime details</strong></summary>

The Dockerfile uses the same pinned Bun version and installs from the frozen lockfile, including the compatibility patch in `patches/`. Its prerelease stage runs `bun release` with the supplied `DATABASE_URL` before building. The final image contains only `.output` and starts `server/index.mjs` with Bun. CI applies migrations to its disposable database before the production browser smoke tests.

When invoking Nuxt through Node instead of Bun, use a supported Node version (`^22.21.0`, `^24.11.0` or `>=26.0.0`).

</details>

## Documentation

- 🗺️ [Architecture](./MAP.md) — source layout, data flows and implementation details.
- 📐 [Project conventions](./CLAUDE.md) — coding standards and contribution rules.
- 🔎 [AI visibility providers](./docs/ai-visibility-providers.md) — provider configuration.
- 🔧 [Maintenance report](./docs/maintenance-2026-10-08.md) — dependency and model decisions.

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
patches/             Reproducible dependency compatibility patches
```

</details>

Use translated UI strings, Vue Composition API with `script setup` and TypeScript, and template-first SFCs. Prefer Nuxt UI components and Tailwind utilities. Update `MAP.md` when changing the structure or adding functionality.
