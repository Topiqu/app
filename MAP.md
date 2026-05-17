# MAP.md — Codebase Architecture

Single source of truth for the structure of **topiqu-blog** (rasg-blog).

## 1. Stack

- **Framework:** Nuxt 4 (Vue 3.5, Composition API), TypeScript strict.
- **Styling:** UnoCSS (`uno.config.ts`), SCSS partials.
- **State:** Pinia (`@pinia/nuxt`) + `pinia-plugin-persistedstate`.
- **i18n:** `@nuxtjs/i18n` (`en`, `cs`).
- **Auth:** `@sidebase/nuxt-auth` + `@auth/prisma-adapter`, argon2 hashing, OTP (`otplib`).
- **DB / ORM:** Prisma 6 + ZenStack v2 (`prisma/schema.zmodel` → generated `schema.prisma`, ~50 models).
- **Editor:** Tiptap 3 (custom extensions in `extensions/`: `Poll`, `slashCommand`, `indent`).
- **AI:** Vercel `ai` SDK with `@ai-sdk/xai` + Vue bindings.
- **Cloud / Infra:** AWS S3, Rekognition, SES; Stripe (`@unlok-co/nuxt-stripe`); Vercel deploy (`vercel.json`); PWA (`@vite-pwa/nuxt`); Playwright + `@sparticuz/chromium` for OG / PDF rendering (`@takumi-rs/*`, `pdfkit`, `jspdf`).
- **SEO:** `@nuxtjs/seo`, `nuxt-og-image`, `nuxt-gtag`.
- **Security:** `nuxt-security`, `isomorphic-dompurify`, `content-checker`, `@zxcvbn-ts/core`, fingerprintjs.
- **Email:** `mjml` templates in `emails/`, sent via SES (`server/utils/sendEmail.ts`).

## 2. Top-Level Layout

```
app/            Nuxt app layer (Vue UI)
server/         Nitro server (API + tasks + utils)
shared/         Cross-cut code shared by app & server (zod schemas, utils)
prisma/         ZenStack source, generated Prisma schema, migrations
extensions/     Tiptap editor extensions
emails/         MJML email templates
i18n/           Locale files (en, cs)
types/          Ambient TS types
public/         Static assets
todo/           Working notes (non-code)
```

## 3. App Layer (`app/`)

- `pages/` — 14 route files; Czech-language URLs (`autor`, `autorizace`, `clanky`, `stitky`, `uzivatel`, `master`, `drafts`). Admin section under `admin/`.
- `components/` — 92 SFCs, grouped by domain:
  `Admin/`, `Article/`, `Auth/`, `Button/`, `Charts.vue`, `Client/`, `Comment/`, `Dropdown/`, `Emoji/`, `File/`, `Form/`, `Gif/`, `Landing/`, `Modal/`, `Notification/`, `OgImage/`, `Stats/`, `Status/`, `Tags/`, `Tasks/`, `User/`, plus the shared Tiptap editor `TiptapEditor.vue`.
- `composables/` — 13 hooks (article SEO/tracking/drafts/actions/events, ads/GAM, currency, profile, image retry, client-site events, theme).
- `stores/` — Pinia (`theme.ts`); persistence handled per-store via plugin.
- `layouts/`, `middleware/`, `error.vue`, `app.vue` — standard Nuxt scaffolding.

## 4. Server Layer (`server/`)

- `api/` — 124 route handlers grouped by resource:
  `admin`, `articles` (CRUD, search, drafts, featured, generate, by-clientsite), `auth`, `bans`, `clients`, `comments`, `companies`, `crons`, `currency`, `drafts`, `emojis`, `external`, `features`, `follows`, `gifs`, `linkedin`, `notifications`, `onboarding`, `publish`, `series`, `sessions`, `stats`, `stripe`, `tags`, `users`, plus standalone `og-proxy.ts`, `upload.ts`, and an `_test/` sandbox.
- `tasks/` — Nitro scheduled tasks.
- `utils/` — Cross-cutting helpers: `prisma.ts`, `zenstack.ts`, `session.ts`, `sendEmail.ts`, `sanitize.ts`, `geo.ts`, `ip.ts`, `metrics.ts`, `paginator.ts`, `log.ts`, `userLog.ts`, `consumeTokens.ts`, `tokenRatio.ts`, `unsplash.ts`, `pdfFont.ts`, `i18n.ts`, plus `ai/` and `linkedin/` subdirs.

## 5. Shared (`shared/`)

- `zod/` — split into `common/`, `enums/`, `input/`, `models/`, `objects/` with a barrel `index.ts`. Schemas reused by both client forms and server validation.
- `utils/` — pure helpers shared by app + server.

## 6. Data Model

- Authored in `prisma/schema.zmodel` (ZenStack) — generates `schema.prisma` (~694 lines, ~50 models/enums).
- Migrations in `prisma/migrations/`.
- `bun build` pipeline: `zenstack generate` → `prisma migrate deploy` → `nuxt build`.

## 7. Tooling

- ESLint 9 (`@nuxt/eslint` + `eslint-plugin-perfectionist`), Prettier 3, Vitest (`@nuxt/test-utils`, jsdom, globals).
- Package manager: **bun** (`bun.lock`).
- Scripts: `dev`, `build`, `typecheck`, `lint(:fix)`, `prettier(:fix)`, `fmt`, `zenstack:generate`, `prisma:deploy`.

## 8. Notable Gaps / Observations

- **No tests present** despite Vitest being configured and CLAUDE.md mandating coverage. `*.test.ts` / `*.spec.ts` count: 0.
- `todo/` directory carries working notes inside the repo.
- One uncommitted change at snapshot time: `prisma/schema.prisma` (regenerated artifact).
- Mixed-locale routing (Czech slugs in `pages/`) — intentional, paired with `@nuxtjs/i18n`.

---

## 9. Seniority Judgment

**Overall level: upper-mid / senior in scope, mid in discipline.**

**Senior signals**

- Modern, coherent stack: Nuxt 4 + ZenStack + Pinia + UnoCSS + Vercel AI SDK, no legacy drag.
- Clear separation of concerns: `app` / `server` / `shared` / `prisma` / `extensions` are clean boundaries; zod schemas centralized and segmented; server `utils/` cleanly factored.
- Domain-grouped components and API routes (92 SFCs, 124 endpoints) without obvious dumping grounds.
- Strict TS, ESLint + Prettier + perfectionist plugin, ZenStack-driven model authoring, custom Tiptap extensions, OG image / PDF generation, MJML email pipeline — non-trivial engineering surface area.
- Security-aware: argon2, OTP, DOMPurify, zxcvbn, nuxt-security, content-checker.

**Junior / debt signals**

- **Zero tests** despite Vitest set up and the project's own convention demanding coverage — the biggest single discipline gap.
- `todo/` checked into the repo; uncommitted generated `schema.prisma` in the working tree.
- A `testOg.vue` page and `_test/` server folder shipped alongside production code suggest in-repo scratch surfaces.
- `nuxt-toast`, `sweetalert2`, and custom notification components coexist — minor stack sprawl.
- Heavy dependency footprint (Tiptap, AI, AWS, Stripe, PDF, Playwright, Chromium, jspdf + pdfkit) — pragmatic but increases maintenance load; some duplication (`jspdf` and `pdfkit`; `argon2` and `argon2-browser`).

**Verdict:** the architecture and stack choices read as the work of a competent senior Nuxt developer; the missing test suite and a few in-repo scratch artifacts pull the engineering *practice* down a notch. Solid mid-senior product codebase, not yet staff-grade rigor.
