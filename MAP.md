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
- **Cache / Redis:** Upstash Redis (HTTP/REST, serverless-friendly) — cross-instance cache-aside in `server/utils/cache.ts`. Provisioned via the **Vercel Upstash marketplace integration**, which injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. **Vercel-coupled dependency:** on a hosting migration these creds must be re-provisioned/rotated (and the integration replaced by direct Upstash or another Redis-compatible provider). The cache degrades gracefully — missing creds disable caching, they don't break requests.
- **SEO:** `@nuxtjs/seo`, `nuxt-og-image`, `nuxt-gtag`.
- **Security:** `nuxt-security`, `isomorphic-dompurify`, `content-checker`, `@zxcvbn-ts/core`, fingerprintjs.
- **Email:** `mjml` templates in `emails/`, sent via SES (`server/utils/sendEmail.ts`).
- **Observability:** `@sentry/nuxt` (error tracking + session replay), ingested by **Better Stack**.

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
- `composables/` — 12 hooks (article SEO/tracking/drafts/actions/events, ads/GAM, currency, profile, image retry, client-site events, theme).
- `stores/` — Pinia (`theme.ts`); persistence handled per-store via plugin.
- `layouts/`, `middleware/`, `error.vue`, `app.vue` — standard Nuxt scaffolding.

## 4. Server Layer (`server/`)

- `api/` — 124 route handlers grouped by resource:
  `admin`, `articles` (CRUD, search, drafts, featured, generate, by-clientsite), `auth`, `bans`, `clients`, `comments`, `companies`, `crons`, `currency`, `drafts`, `emojis`, `external`, `features`, `follows`, `gifs`, `linkedin`, `notifications`, `onboarding`, `publish`, `series`, `sessions`, `stats`, `stripe`, `tags`, `users`, plus standalone `upload.ts`, and an `_test/` sandbox.
- `tasks/` — Nitro scheduled tasks.
- `utils/` — Cross-cutting helpers: `prisma.ts`, `zenstack.ts`, `session.ts`, `sendEmail.ts`, `sanitize.ts`, `geo.ts`, `ip.ts`, `metrics.ts`, `paginator.ts`, `log.ts`, `userLog.ts`, `consumeTokens.ts`, `tokenRatio.ts`, `unsplash.ts`, `pdfFont.ts`, `i18n.ts`, `notificationsPoll.ts` (pure cursor/query helpers for the notifications poll endpoint), plus `ai/` and `linkedin/` subdirs.

### Notifications delivery

- Notifications are persisted in the DB (source of truth) and delivered to the client by **polling**, not push. The client (`Notification/Bar.vue`) polls `GET /api/notifications/poll?since=<ISO cursor>` every 10s (paused while the tab is hidden) and merges anything newer.
- This replaced an in-memory SSE channel (`server/utils/realtime.ts` + `/api/notifications/sse` + the `useRealtime` composable), which is unviable on serverless/Vercel: held connections incur per-request/wall-clock billing and isolated function memory means a `publish` in one function never reaches a subscriber in another. That whole layer was removed; reviving push would mean a managed WebSocket provider (Ably/Pusher) or a long-running process off Vercel, not a serverless patch. Cursor semantics live in `server/utils/notificationsPoll.ts` and are unit-tested.

## 5. Shared (`shared/`)

- `zod/` — split into `common/`, `enums/`, `input/`, `models/`, `objects/` with a barrel `index.ts`. Schemas reused by both client forms and server validation.
- `utils/` — pure helpers shared by app + server.

## 6. Data Model

- Authored in `prisma/schema.zmodel` (ZenStack) — generates `schema.prisma` (~694 lines, ~50 models/enums).
- Migrations in `prisma/migrations/`.
- `bun build` pipeline: `zenstack generate` → `prisma migrate deploy` → `nuxt build`.

## 6a. Plan Matrix (`ClientSite.plan` — enum `ClientPlan`)

Marketing names diverge from the DB enum: marketing **FREE** = enum **BASIC**. Enum is the source of truth (`prisma/schema.zmodel:84`), copy lives in `i18n/locales/{cs,en}.json → landing.pricing.plans.*`.

| Capability                       | FREE (BASIC) | PRO                | PREMIUM                | CUSTOM             |
| -------------------------------- | ------------ | ------------------ | ---------------------- | ------------------ |
| Price (per month, CZK)           | 0            | 490                | 990                    | On request (sales) |
| Stripe checkout                  | —            | `STRIPE_PRICE_PRO` | `STRIPE_PRICE_PREMIUM` | Sales-led, no SKU  |
| Revenue share (creator/platform) | 0 / 100      | 70 / 30            | 90 / 10                | 100 / 0            |
| Manual article writing           | ✅           | ✅                 | ✅                     | ✅                 |
| Subdomain                        | ✅ (free)    | ✅                 | ✅                     | ✅ + apex domain   |
| Custom (apex) domain             | ❌           | ❌                 | ❌                     | ✅                 |
| White-label (no Topiqu branding) | ❌           | ❌                 | ❌                     | ✅                 |
| AI article generation            | ❌           | ✅ (token bundle)  | ✅ (token bundle)      | ✅ (unlimited)     |
| AI sentiment + auto images       | ❌           | ❌                 | ✅                     | ✅                 |
| Advanced SEO optimization        | ❌           | ✅                 | ✅                     | ✅                 |
| Article import                   | ❌           | ✅                 | ✅                     | ✅                 |
| Priority indexing + sourcing     | ❌           | ❌                 | ✅                     | ✅                 |
| Custom emojis & branding         | ❌           | ❌                 | ✅                     | ✅                 |
| Custom ad banners                | ❌           | ❌                 | ❌                     | ✅                 |
| Analytics                        | Basic        | Basic + GA4        | Basic + GA4            | Basic + GA4        |
| Support                          | Community    | Standard           | Priority 24/7          | Dedicated          |

Feature gates checked in code via `ClientSite.plan` plus per-feature booleans on the same model (`enableAi`, `enableSentiment`, `enableCron`, `allowAds`, `allowGtag`, `allowShapes`). The `BillingPlans` enum (`MONTHLY` / `ANNUAL`) is orthogonal to the plan tier.

### Stripe wiring

- Subscription checkout: `POST /api/stripe/subscribe` (mode `subscription`, Price IDs from env).
- Token top-ups: `POST /api/stripe/checkout` (mode `payment`, ad-hoc `price_data`).
- Webhook (`POST /api/stripe/webhook`) handles `checkout.session.completed` for both modes, `customer.subscription.deleted` (→ downgrade to BASIC), and `invoice.payment_succeeded` (→ bump `lastPaidAt` / `lastInvoicedAt`). Pure helpers (`extractSubscriptionId`, `isSubscribablePlan`) live in `server/utils/stripeWebhook.ts` so they are unit-testable; `extractSubscriptionId` reads `invoice.parent.subscription_details.subscription` (Stripe API `2025-03-31.basil` removed top-level `invoice.subscription`).
- Required env: `STRIPE_SK`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM`.

## 7. Tooling

- ESLint 9 (`@nuxt/eslint` + `eslint-plugin-perfectionist`), Prettier 3.
- Testing: Vitest 4 with `@nuxt/test-utils`, `@vue/test-utils`, `happy-dom`, V8 coverage. Config in `vitest.config.ts` (node env by default, `nuxt` env for `app/**` and `tests/components/**`). Tests live in `tests/**`, co-located `*.test.ts` is also picked up. First suite: `tests/server/stripe/webhook.test.ts`.
- Typecheck via `vue-tsc` (`bun run typecheck`); kept out of `build` for fast deploys, run separately in CI.
- Package manager: **bun** (`bun.lock`).
- Scripts: `dev`, `build`, `typecheck`, `test`, `test:watch`, `test:coverage`, `lint(:fix)`, `prettier(:fix)`, `fmt`, `zenstack:generate`, `prisma:deploy`.

## 8. Notable Gaps / Observations

- **No tests present** despite Vitest being configured and CLAUDE.md mandating coverage. `*.test.ts` / `*.spec.ts` count: 0.
- `todo/` directory carries working notes inside the repo.
- One uncommitted change at snapshot time: `prisma/schema.prisma` (regenerated artifact).
- Mixed-locale routing (Czech slugs in `pages/`) — intentional, paired with `@nuxtjs/i18n`.

---

## 9. Observability — Error Tracking & Session Replay

### Why we adopted this

The app had **zero runtime observability**: when something broke for a real user (Nitro API, Tiptap editor, Stripe flow) we had no stack trace, no breadcrumb, no replay — only Vercel logs after the fact. As we move toward **AWS SQS** for async work, this gap gets worse: unlike an append-log bus (Kafka / Redpanda) you cannot rewind an SQS queue, so the _only_ durable record of what happened to a failed job is whatever we capture at the moment it fails. We need stack traces + distributed traces emitted in-flight, plus front-end session replay to reconstruct user-facing bugs, that weren't captured by unit tests.

### Why Sentry SDK + Better Stack (not Sentry SaaS)

- **No vendor lock-in.** Better Stack's error tracking speaks the **Sentry SDK protocol**, so we instrument with the official `@sentry/nuxt` SDK and only point the DSN at Better Stack. Switching to (or back to) Sentry SaaS is a one-line env change — no code rewrite.
- **Cost at scale.** Pricing diverges sharply at volume (SQS will generate many backend events); Better Stack is ~6× cheaper per unit ingest, while both are free at our current size.
- **Unified data layer.** Better Stack co-locates error tracking, logs, uptime, and incident management — more value per integration than errors-only Sentry, given we had none of these.

### Files / wiring

- `sentry.client.config.ts`, `sentry.server.config.ts` (project root) — SDK init, loaded early by the module. Read DSN + sampling from `runtimeConfig.public.sentry`. Empty DSN disables the SDK (local / CI).
- `nuxt.config.ts` — registers `@sentry/nuxt/module`; `runtimeConfig.public.sentry` (DSN/env/sample rates, overridable via `NUXT_PUBLIC_SENTRY_*`); `sentry.sourceMapsUploadOptions` (build-time, skipped without `SENTRY_AUTH_TOKEN`); `sourcemap.client: 'hidden'`.
- `.env.example` — `NUXT_PUBLIC_SENTRY_DSN`, `SENTRY_URL/ORG/PROJECT/AUTH_TOKEN`.
- Replay masks all text + media (`maskAllText`, `blockAllMedia`) for GDPR.
- CSP: works as-is — `nuxt-security` `connect-src` allows `https:`, replay worker uses existing `blob:` in `script-src`.
