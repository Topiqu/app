# Topiqu Agent Rules — Compact

Compact alternative to `AGENTS.md`. Use this when context efficiency matters. `README.md` explains
setup, `MAP.md` is the architecture source of truth, and `CLAUDE.md` contains the extended engineering
role and security guidance. If instructions conflict, follow the strictest applicable rule and report
the conflict.

## Hard rules

- Work only within the user's requested scope. Do not redesign, modernize, migrate, or refactor
  adjacent code without a concrete task requirement.
- Read before writing. Inspect the existing implementation, related types, API routes, schemas,
  translations, tests, and repository docs before choosing an approach.
- Preserve the shared worktree. Existing changes belong to the user; never discard, overwrite,
  reformat, stage, or commit unrelated work.
- Never expose secrets, credentials, environment contents, or private customer data.
- Never run destructive Git, database, filesystem, migration, backfill, or production commands
  without explicit authorization and a verified exact target.
- Never commit unless the user explicitly asks for a commit in the current conversation.
- Never push unless the user explicitly asks to push and names the branch. This is a necessary, not
  sufficient, condition: if another active instruction is stricter, follow it.
- Treat `main` as production. Do not push or merge to `main` unless the user explicitly names `main`,
  required verification passes, and branch-only changes have been reviewed.
- A request to commit, push, or merge does not authorize deployment, production migrations, DNS/TLS
  changes, secret rotation, scaling, or backfills. Each requires separate explicit approval.
- Never force-push, rewrite published history, reset, delete branches, or use `git reset --hard`
  without explicit authorization and a recoverable safety reference.

## Before changing code

1. Run `git status --short --branch`; record the branch and pre-existing changes.
2. Read relevant sections of `README.md`, `CLAUDE.md`, and `MAP.md`.
3. Find code with `rg`/`rg --files`; do not guess paths or architecture.
4. Trace the full flow: UI state → composable/store → API → validation → ZenStack policy/model →
   cache/background effects → tests and i18n.
5. Search for an existing Nuxt UI primitive, component, utility, type, and test pattern before adding
   anything new.
6. Identify risks: authorization, tenant isolation, SSR/hydration, persistence, caching, billing, AI,
   media, accessibility, responsive layout, and dark mode.
7. For bugs, establish the failure where practical and fix its cause, not its visible symptom.

Use patch-based tracked-file edits. Avoid broad globs, recursive deletion, shell write tricks, and
commands whose target has not been resolved first.

## Architecture and implementation

- Stack: Nuxt 4, Vue 3.5, TypeScript strict, Nuxt UI, VueUse, Tiptap 3, ZenStack 3/PostgreSQL, Bun
  1.4.3, Vitest, and Playwright.
- Use Bun only. Do not create npm, Yarn, or pnpm artifacts. Dependency changes must intentionally
  update `bun.lock` and pass a frozen install.
- Keep changes small and cohesive. Avoid drive-by cleanup, dependency churn, speculative abstractions,
  and generated-file edits.
- Components render and coordinate; composables own reusable reactive behavior; `app/utils` owns app
  logic; `shared` owns app/server-safe logic; server utilities own privileged behavior.
- Keep business logic out of large Vue templates and route handlers. Prefer small tested pure
  functions, but do not create dozens of microcomponents or wrappers.
- Reuse existing models and generated types. Do not duplicate domain types or hide problems with
  `any`.
- Match file/import casing exactly; macOS may hide casing errors that fail Linux CI.
- Document structural changes and durable invariants in `MAP.md`. Update `README.md` when setup,
  commands, dependencies, or operator workflow changes.

## Frontend, design, and i18n

- Use `<script setup lang="ts">`; SFC order is template, script, then style only when utilities cannot
  express the requirement.
- Keep SSR deterministic. Gate browser APIs, storage, DOM parsing, timers, randomness, and
  time-dependent markup behind client lifecycle when necessary.
- Use Nuxt's routing/data conventions and stable async-data keys. Prefer SSR-safe `useFetch` or
  `useAsyncData` for initial data and `$fetch` for user-triggered writes.
- Reuse Nuxt UI and `app/app.config.ts`; use project semantic tokens, spacing, typography, radii,
  loading/error/empty states, icons, and interaction patterns. Do not create a parallel design system
  or hardcode arbitrary colors.
- Prefer `UButton` over a bare button. This project has no general browser reset, so native button
  chrome otherwise leaks through, especially in dark mode.
- Preserve responsive behavior, dark mode, wrapping, keyboard access, focus visibility, reduced
  motion, semantic HTML, and non-color status cues.
- Avoid brittle DOM selectors. Use template refs, stable IDs, exposed component methods, and editor
  APIs.
- Tiptap changes must preserve editor/public-render parity, sanitization, heading IDs, tables, polls,
  media, translations, autosave, and dirty-state behavior.
- Use `AppMedia` for normal media and preserve aspect ratio, fallback, lazy loading, and retry behavior.
- Czech and English are mandatory. Put every user-facing string in the existing i18n namespaces for
  both locales and run completeness tests.
- Customer-facing balances are articles, never internal tokens or provider credits.

## Server, data, and security

- Broken access control and tenant leakage are the primary risks. Authenticate and authorize every
  non-public mutation at the server boundary.
- Use existing scope/access utilities and the request-scoped ZenStack-enhanced database client for
  user-facing data. Raw database access is only for explicitly reviewed system contexts.
- Treat route params, IDs, URLs, filenames, storage keys, HTML, and request bodies as hostile. Validate
  with existing schemas, constrain every lookup to the tenant, sanitize HTML, and return safe explicit
  selections.
- Keep AI, Stripe, AWS, OAuth, mail, and provider secrets on the server. Rate-limit auth, verification,
  expensive AI, and oracle-like endpoints.
- Use established cache invalidation after mutations; do not introduce a replacement event bus.
- `prisma/schema.zmodel` and `prisma/models/*.zmodel` are authored sources. Never hand-edit
  `generated/zenstack`.
- Schema changes require complete migrations, generated clients, policy review, compatibility review,
  and tests. Prefer additive forward-compatible rollout.
- Backfills are dry-run, bounded, idempotent, and reported by default. Apply mode requires explicit
  approval.
- Keep deterministic checks separate from remote AI. Never fake AI output or claim fact-checking that
  did not happen. Validate model output and treat retrieved pages as untrusted.
- Preserve AI reservation/settlement/cancellation semantics, media tenant ownership and provenance,
  and server-owned billing/plan catalogs.
- Scheduled tasks may execute once per app replica. Do not scale scheduling without idempotency and
  duplicate-execution analysis. Tenant GAM on paid plans is active; platform ads and revenue share
  remain halted unless product explicitly reactivates them.

## Verification

- Add focused Vitest coverage for significant behavior, regressions, authorization, state transitions,
  and edge cases. Update stale tests only when the current product contract proves they are wrong.
- Iterate with the smallest relevant test, then run checks proportional to risk. Standard checks are:

  ```bash
  bun run zenstack:generate
  bun run lint
  bun run prettier
  bun run openapi:check
  bun run typecheck
  bun run test
  bun run build:docker
  git diff --check
  ```

- Do not run the complete E2E matrix for every small change. Use targeted E2E for browser boundaries
  and release smoke for migrations, auth, service workers, assets, or deployment-sensitive changes.
- Inspect diffs before and after formatters. Never revert user changes while cleaning formatter churn.
- Report exact results, distinguish new from pre-existing failures, and never claim manual UI testing
  that was not performed.

## Git, branches, and releases

- Commits are coherent and use simple one-line Conventional Commits without `Co-authored-by` trailers.
  Intermediate commits should remain internally consistent and testable.
- Stage only intended files. Before every Git write, inspect status, diff, upstream, and recent history.
- `dev` is the integration branch; `main` is production unless the user establishes another workflow.
- Fetch before integration. Inspect commit divergence and content differences; conflict-free does not
  mean behavior-free. Preserve branch-only work.
- Prefer fast-forward only when ancestry proves it is safe; otherwise use a normal merge. Resolve
  conflicts by intended behavior, never by blindly selecting one side.
- Create a safety ref before an explicitly authorized reset or history rewrite. Verify final local and
  remote hashes and `main...dev` divergence after integration.
- Both `dev` and `main` trigger CI: lint/OpenAPI/typecheck, migrated PostgreSQL Vitest, and production
  build/release-smoke gates. A successful push alone is not a successful release.
- Before an explicitly authorized push, confirm the named branch, upstream, exact commits, clean or
  explained worktree, and agreed checks. Use a normal push unless force is separately authorized.
- Production migrations use the established release command only against an explicitly identified
  environment. Dokploy, runtime config, secrets, DNS/TLS, replica count, and production backfills are
  human-controlled operations.

## Handoff

Report the outcome, changed subsystems, key decisions and limitations, tests run and skipped, remaining
migration/config/rollout work, and Git hashes only for explicitly requested Git actions. State
uncertainty plainly rather than presenting unverified work as complete.
