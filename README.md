# Topiqu AI Blog

A multi-tenant publishing platform with an AI-assisted Tiptap editor, article translations, community features, client sites, Stripe billing and AI visibility monitoring.

## Stack

| Area              | Technology                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| Application       | Nuxt 4, Vue 3.5, TypeScript                                                     |
| UI                | Nuxt UI 4, Tailwind CSS 4, Reka UI                                              |
| State and queries | Pinia, Pinia Colada                                                             |
| Authentication    | Better Auth, ZenStack adapter, argon2, OTP / 2FA                                |
| Data              | ZenStack ORM 3, PostgreSQL with pgvector, optional Redis / Valkey cache         |
| Editor            | Tiptap 3 and custom extensions                                                  |
| AI                | AI SDK 7, OpenAI Responses API; native search adapters for visibility providers |
| Billing           | Stripe subscriptions and credit top-ups                                         |
| Media and email   | AWS S3 / Rekognition / SES, Sharp, MJML 5, PDFKit, Takumi OG images             |
| Localization      | English, Czech, German and French                                               |
| Checks            | Vitest, Nuxt Test Utils, jsdom, Playwright, ESLint, Prettier, vue-tsc           |
| Runtime           | Bun 1.4.2, pinned in package.json, .prototools, CI and Docker                   |

[MAP.md](./MAP.md) documents the architecture. [CLAUDE.md](./CLAUDE.md) defines project conventions. The [maintenance report](./docs/maintenance-2026-10-08.md) records dependency and model decisions.

## Local setup

Install Bun 1.4.2, Node 24.21.0 and Docker. The runtime versions are pinned in `.prototools` and `.node-version`; Node is needed for Vue type checking and browser tests. Copy [.env.example](./.env.example) to `.env` and configure the services needed for your work. `bun run dev` starts Nuxt; start the local database and cache explicitly.

```sh
bun install --frozen-lockfile
bun run zenstack:generate
bun run db:up
bun run db:migrate:deploy
bun run db:seed
bun --bun run dev
```

ZenStack generates ignored schema metadata and TypeScript types in `generated/zenstack/`. The application uses ZenStack ORM directly; Prisma is an internal migration dependency of the ZenStack CLI.

```sh
bun run db:down    # stop local services
bun run db:reset   # delete local database/cache volumes and recreate them
bun run db:fresh   # reset, migrate and seed
```

## Verification

Generate the ZenStack artifacts before checking a fresh checkout. Use `bun run test` to run Vitest.

```sh
bun run zenstack:generate
bun run lint
bun run typecheck
bun run openapi:check
bun run test
bun run test:watch
bun run test:coverage
bun run prettier
```

PostgreSQL integration and browser tests require a separate disposable database in `TEST_DATABASE_URL`; they can apply migrations and clear test data. Never point this variable at a development or production database you want to keep.

```sh
bun x --no-install playwright install chromium webkit
bun run test:e2e
bun run test:e2e:release
```

Live AI checks call provider APIs and consume credits. Model IDs are centralized in `server/utils/ai/modelRegistry.ts`.

```sh
bun run ai:smoke
bun run eval:ai
bun run knowledge:eval
```

## Production build

```sh
bun --bun run build    # generate ZenStack artifacts, then build Nuxt
bun run build:docker  # alias for the same build
bun --bun run preview
bun run release       # apply database migrations to DATABASE_URL
```

The Dockerfile uses the same pinned Bun version and installs from the frozen lockfile, including the compatibility patch in `patches/`. Its prerelease stage currently runs `bun release` with the supplied `DATABASE_URL` before building. The final image contains only `.output` and starts `server/index.mjs` with Bun. CI applies migrations to its disposable database before the production browser smoke tests.

When invoking Nuxt through Node instead of Bun, use a supported Node version (`^22.21.0`, `^24.11.0` or `>=26.0.0`).

## Source layout

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

Use translated UI strings, Vue Composition API with `script setup` and TypeScript, and template-first SFCs. Prefer Nuxt UI components and Tailwind utilities. Update `MAP.md` when changing the structure or adding functionality.
