<h1 align="center">
  <a href="https://topiqu.com" target="_blank">
    <img align="center" src="https://skillicons.dev/icons?i=nuxt,vue,vite,ts,unocss,prisma,postgres,docker,aws,stripe" /><br/><br/>
    <span>Topiqu AI Blog</span>
  </a>
</h1>

### **Welcome** to <a href="https://topiqu.com" target="_blank">**Topiqu AI Blog**</a>! 👋

A modern full-stack TypeScript blogging platform. Topiqu pairs a rich Tiptap-based editor with xAI-powered content generation, real-time SSE notifications, multi-tenant client sites with custom domains, Stripe billing, and a robust permission layer authored in ZenStack.

## ✨ Features

- 📝 **Rich Editor** — Tiptap 3 with custom extensions (`Poll`, `slashCommand`, `indent`), autosave, drafts, and quick release flow
- 🤖 **AI (xAI / Grok)** — article generation, content enhancement, sentiment analysis, auto-image suggestions and LinkedIn post generator via `@ai-sdk/xai`; token consumption metered per `ClientSite` plan
- 🔔 **Realtime** — Server-Sent Events notification system with an event publisher
- 🏢 **Multi-tenant client sites** — per-tenant subdomains, custom apex domains with DNS (CNAME) verification, plan-gated white-labeling
- 💳 **Billing** — Stripe subscriptions (`PRO` / `PREMIUM`) + ad-hoc token top-ups, webhook-driven plan changes, monthly / annual cycles
- 🔐 **Auth & Security** — `@sidebase/nuxt-auth`, argon2 hashing, OTP / 2FA (`otplib`), `nuxt-security`, DOMPurify, zxcvbn password strength, FingerprintJS, content-checker profanity filter
- 🛡️ **Row-level access control** — ZenStack policies in `schema.zmodel` enforced server-side via `getEnhancedPrisma(user)`
- 🌐 **i18n** — Full Czech / English localization (`@nuxtjs/i18n`); Czech-language route slugs
- 🎨 **Theming** — UnoCSS utility-first, SCSS partials, persisted theme store, custom emojis & branding (plan-gated)
- 🔎 **SEO** — `@nuxtjs/seo`, dynamic OG images via Takumi, sitemap, schema.org metadata, priority indexing & sourcing per plan
- 📊 **Analytics & Charts** — Chart.js + vue-chartjs, `nuxt-gtag` (GA4), GAM ad integration, `allowAds` plan gate
- 📄 **PDF / OG rendering** — Playwright + `@sparticuz/chromium`, Takumi, pdfkit, jspdf, `nuxt-og-image`
- 📧 **Transactional Email** — MJML templates rendered and sent via AWS SES
- ☁️ **AWS** — S3 storage (uploads), Rekognition (image moderation), SES (mail)
- ⏱️ **Scheduled tasks** — Nitro `tasks/` for community insights, cron-driven jobs (`enableCron` gate)
- 📱 **PWA** — Installable, offline-capable via `@vite-pwa/nuxt`
- 🧩 **Headless UI** — `@headlessui/vue` + `@floating-ui/dom` + Tippy.js for accessible overlays, dropdowns, dialogs
- ... and more

## 🧱 Tech Stack

| Layer            | Technology                                                                              |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Framework**    | [Nuxt 4](https://nuxt.com) (Vue 3.5, Composition API)                                   |
| **Language**     | TypeScript (strict)                                                                     |
| **Styling**      | [UnoCSS](https://unocss.dev) + SCSS                                                     |
| **i18n**         | [`@nuxtjs/i18n`](https://i18n.nuxtjs.org) — `en`, `cs`                                  |
| **Auth**         | [`@sidebase/nuxt-auth`](https://auth.sidebase.io) + Prisma adapter                      |
| **ORM / Schema** | [Prisma 6](https://www.prisma.io) + [ZenStack v2](https://zenstack.dev) (access policy) |
| **Database**     | PostgreSQL (via Docker Compose)                                                         |
| **Editor**       | [Tiptap 3](https://tiptap.dev) with custom extensions                                   |
| **AI**           | [Vercel AI SDK](https://sdk.vercel.ai) + [`@ai-sdk/xai`](https://x.ai) (Grok)           |
| **Billing**      | [Stripe](https://stripe.com) via `@unlok-co/nuxt-stripe` (subscriptions + token top-ups)|
| **SEO**          | `@nuxtjs/seo`, `nuxt-og-image`, `nuxt-gtag`                                             |
| **Cloud**        | AWS (S3, Rekognition, SES), Stripe, Vercel                                              |
| **Testing**      | [Vitest](https://vitest.dev) + `@nuxt/test-utils` + `happy-dom`                         |
| **Tooling**      | ESLint, Prettier, vue-tsc                                                               |

## 📂 Project Structure

```
app/         Nuxt app layer (pages, components, composables, stores, layouts)
server/      Nitro server (API routes, scheduled tasks, utils)
shared/      Cross-cutting code (zod schemas, utils) shared by app & server
prisma/      ZenStack source (schema.zmodel), generated Prisma schema, migrations
extensions/  Custom Tiptap editor extensions
emails/      MJML email templates
i18n/        Locale files (en, cs)
types/       Ambient TS types
public/      Static assets
```

See [`MAP.md`](./MAP.md) for the complete architecture reference — it is the single source of truth.

## 🛠️ Installation

**Requirements**

- 📦 [Bun](https://bun.sh) (recommended) — Node-compatible package manager & runtime
- 🐳 [Docker](https://www.docker.com) — used by `predev` to spin up PostgreSQL
- 🔑 A configured `.env` (Auth, AWS, Stripe, AI keys, etc.)

**Install & run in dev mode**

```bash
bun install            # installs deps + runs `nuxt prepare`
bun zenstack:generate  # generates Prisma schema from schema.zmodel
bun prisma:deploy      # applies migrations to the DB
bun dev                # spins up Postgres via docker, starts Nuxt dev server
```

**Database management**

```bash
bun db:up      # start Postgres container
bun db:down    # stop Postgres container
bun db:reset   # wipe volumes & restart fresh
bun db:seed    # seed initial data
```

**Build**

```bash
bun run build  # server build (zenstack generate + prisma deploy + nuxt build)
bun generate   # static site generation
bun preview    # preview production build
```

## 🧪 Testing

```bash
bun test           # run vitest once
bun test:watch     # watch mode
bun test:coverage  # coverage report (v8)
bun typecheck      # vue-tsc strict typecheck
```

## 🧹 Linting & Formatting

ESLint (`@nuxt/eslint`) + Prettier are enforced project-wide.

```bash
bun lint           # check
bun lint:fix       # auto-fix
bun prettier       # check formatting
bun prettier:fix   # apply formatting
bun fmt            # lint:fix + prettier:fix
```

## 🤝 Conventions

- Follow the rules in [`CLAUDE.md`](./CLAUDE.md) — Staff-Level Nuxt 4 / Vue 3.5 standards.
- Every structural change **must** be reflected in [`MAP.md`](./MAP.md).
- All user-facing strings **must** use `$t('key')` — no raw text in templates.
- Prefer Vue 3.5 macros (`defineModel`, `useTemplateRef`, …) and VueUse composables over manual `ref()` / `reactive()`.
- **Vue SFC order:** `<template>` first, then `<script setup lang="ts">`, then `<style>` (avoid `<style>` blocks whenever possible — prefer pure UnoCSS).
- **Server API:** prefer the ZenStack-enhanced client (`getEnhancedPrisma(user)`) over raw `prisma` so access policies from `schema.zmodel` are enforced — fall back to raw `prisma` only when policies must be bypassed intentionally.
- **Error responses:** use `createError({ statusCode, message })` with i18n keys via `useServerI18n` where applicable.
- **Don't "modernize" without reason** — keep changes terse and scoped to the task; refactors require explicit approval.
- Significant changes should be covered by Vitest tests.

---

<p align="center">
    <span>Made with ❤️ by</span>
    <a href="https://github.com/bigjohnn1" target="_blank">@bigjohnn1</a>
    <span>&</span>
    <a href="https://github.com/germondai" target="_blank">@germondai</a>
</p>
