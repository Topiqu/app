# Topiqu Agent Rules

This file is the operating contract for coding agents working in this repository. It complements
`README.md`, `CLAUDE.md`, and `MAP.md`; when they disagree, follow the most specific current source of
truth and flag the conflict instead of silently choosing one.

## 1. Authority and scope

- Do only the work the user requested. Do not redesign, modernize, migrate, or refactor adjacent code
  without a concrete need for the task.
- Read before writing. Inspect the relevant page, components, composables, shared utilities, server
  routes, schemas, tests, translations, and existing patterns before proposing or implementing a
  solution.
- Treat the working tree as shared. Existing tracked or untracked changes belong to the user unless
  proven otherwise. Never discard, overwrite, reformat, or include unrelated changes by accident.
- State material assumptions. Prefer a safe, local assumption when it does not alter product scope;
  ask only when a choice would materially change behavior or data.
- Do not add dependencies, services, migrations, feature flags, or new abstractions unless the task
  genuinely requires them.
- Use Bun only. Keep `package.json`, `bun.lock`, CI, and Docker on the pinned Bun version; do not
  introduce npm, Yarn, or pnpm artifacts. Dependency changes must update the lockfile intentionally
  and pass a frozen install.
- Diagnose requests authorize inspection and explanation, not an implementation. Change requests
  authorize the smallest complete implementation and proportionate verification.
- Never expose secrets, credentials, private customer data, environment contents, or full sensitive
  records in commands, logs, tests, screenshots, commits, or responses.

## 2. Start every task with reconnaissance

1. Run `git status --short --branch` and note the active branch and pre-existing changes.
2. Find repository-local instructions and read the relevant sections of `README.md`, `CLAUDE.md`, and
   `MAP.md`.
3. Locate the current implementation with `rg`/`rg --files`; do not guess file names or architecture.
4. Trace the complete data flow before editing:
   - Vue page/component state and Nuxt composables;
   - API route and request validation;
   - ZenStack model, policies, and generated types;
   - cache invalidation and background tasks;
   - i18n keys and tests.
5. Search for an existing primitive or utility before creating one. Prefer extending a coherent
   existing abstraction over adding a parallel implementation.
6. Identify the smallest set of files and the risk areas: authorization, tenant isolation, SSR and
   hydration, persistence, caching, billing, AI usage, accessibility, and responsive layout.
7. For bugs, reproduce or establish a failing check where practical, then fix the root cause rather
   than hiding the symptom.

Use `rg`/`rg --files` for discovery and patch-based edits for tracked files. Avoid shell write tricks,
recursive deletion, broad globs, and commands whose resolved target has not been inspected first.

## 3. Implementation principles

- Keep the change cohesive and local. Avoid drive-by cleanup, broad renames, generated churn, and
  speculative extensibility.
- Reuse Nuxt UI, project design tokens, existing components, VueUse composables, API conventions,
  loading/error/empty states, and domain types. Do not create a second design system.
- Keep responsibilities clear without manufacturing micro-abstractions:
  - components render and coordinate interaction;
  - composables own reusable reactive behavior;
  - `app/utils` owns client/app-specific pure logic;
  - `shared` owns code safely consumed by app and server;
  - server utilities own privileged or server-only behavior.
- Keep business logic out of large templates and route handlers when it can be a small tested pure
  function.
- Preserve public API, persisted data, and route behavior unless the requested feature explicitly
  changes them.
- Comments explain non-obvious constraints, hazards, or reasons. Do not narrate the code. Put durable
  architectural context in `MAP.md`.
- Name symbols after the actual domain vocabulary. Avoid ceremony suffixes such as `Manager`,
  `Handler`, `Helper`, or `Wrapper` when they add no meaning.
- Use TypeScript and existing inferred/generated types. Do not duplicate a model or loosen types to
  `any` merely to make a change compile.
- Match the exact on-disk casing in file names and imports. Local macOS filesystems can hide a casing
  mismatch that fails immediately in Linux CI.
- Do not add fake production data, random scores, simulated AI results, client-side secret usage, or
  UI that claims a remote operation ran when it did not.

## 4. Nuxt, Vue, and frontend rules

- The application is Nuxt 4 with Vue 3.5. Use Composition API and `<script setup lang="ts">`.
- Vue SFC order is `<template>`, `<script setup lang="ts">`, then `<style>` only when utilities and
  shared styles cannot express the requirement.
- Prefer Nuxt auto-imports, Vue macros such as `defineModel` and `useTemplateRef`, shallow reactivity
  for large/non-deep values, and existing VueUse utilities.
- Keep the first SSR render deterministic. Browser APIs, storage, DOM parsing, timers, random values,
  and current-time-dependent markup must be gated behind client lifecycle where necessary.
- Use Nuxt's `useRoute`, `useFetch`, and `useAsyncData` conventions. Page data needed for first render
  should be SSR-safe and payload-reused; `$fetch` is appropriate for user-triggered mutations.
- Give `useAsyncData` stable keys and keep handlers free of side effects. Manual refreshes must not be
  accidentally satisfied by stale payload data.
- Preserve responsive behavior and dark mode. Long content must wrap and must not create horizontal
  overflow.
- Use semantic HTML and existing Nuxt UI accessibility behavior. Interactive elements need keyboard
  access, visible focus, meaningful labels, and non-color status cues.
- Use `NuxtLink`/Nuxt routing for internal navigation. Preserve deliberate smooth-scroll and scroll
  restoration behavior.
- Do not use brittle DOM selectors to coordinate components. Prefer refs, exposed component methods,
  editor APIs, and stable IDs.
- For Tiptap changes, preserve editor and published-render parity, sanitization, media handling,
  heading IDs, polls, tables, translations, autosave, and dirty-state behavior.
- Use `AppMedia` for normal application media unless a specialized renderer already owns the case.
  Preserve aspect ratio, fallback behavior, lazy-load semantics, and the original-source retry path.

## 5. Design and styling

- Use Nuxt UI components and `app/app.config.ts` variants before hand-building controls.
- Use semantic classes and project tokens such as `text-highlighted`, `text-muted`, `border-default`,
  `bg-default`, `bg-elevated`, `primary`, `success`, `warning`, and `error`.
- Do not add arbitrary hex colors, one-off radii, bespoke shadows, or unrelated spacing scales.
- Match the surrounding component's density, typography, collapsible pattern, loading state, and
  button hierarchy. New UI should look native to Topiqu, not like an embedded product.
- Prefer utility classes. Change global CSS only for genuinely global primitives or behavior that
  utilities cannot safely represent.
- Be careful with plain `<button>` elements: this project has no general browser reset. Prefer
  `UButton`; if a plain button is necessary, explicitly neutralize native appearance and verify dark
  mode.
- UnoCSS must scan the file containing static utility tokens. Classes stored in TypeScript require
  the existing scan configuration; dynamic class construction may silently produce no CSS.
- Article typography is a shared contract between editor and public rendering. Reuse the existing
  prose/table constants and do not fight preset typography with fragile selector specificity.
- Avoid unnecessary animation. Respect reduced motion and use movement only to explain state or
  interaction.

## 6. Localization and copy

- Supported locales are Czech and English. Every new user-facing string must be translated in both.
- Do not hardcode user-facing copy in Vue templates, composables, or route handlers when the project
  has an i18n surface for it.
- Follow the existing locale namespace and file structure. Reuse common action/status keys when their
  meaning matches exactly.
- Preserve Czech and Slovak diacritics in content, typography, slug/heading normalization, and tests.
- Run the i18n completeness tests when locale keys change.
- User-facing terminology must follow the current product model. In particular, customer balances
  are articles, not internal provider tokens or credits.

## 7. Server, security, and multi-tenancy

- Broken access control and tenant leakage are the primary risks. Every non-public mutation must
  authenticate and authorize at the server boundary.
- Prefer the existing `requireTenantScope`, `requireTenantMember`, `requireDb`, and article-access
  utilities. Do not invent a client-side security gate.
- Use the ZenStack-enhanced request-scoped database client for user-facing data so model policies
  enforce tenant and role boundaries. Raw database access is reserved for explicit system contexts
  such as scheduled tasks, webhooks, or narrowly reviewed maintenance work.
- Route params, body fields, tenant IDs, media IDs, storage keys, URLs, and filenames are
  attacker-controlled. Validate them with existing Zod/generated schemas and constrain every lookup
  to the active tenant.
- Return explicit safe selections. Never serialize complete account, membership, token, credential,
  billing, or integration rows.
- Sanitize stored/rendered HTML with the existing pipeline. Do not weaken CSP or XSS controls to make
  content render.
- Keep secrets server-side. AI, Stripe, AWS, OAuth, mail, and provider keys must never enter browser
  payloads or public runtime config.
- Rate-limit authentication, verification, expensive AI, and oracle-like endpoints with existing
  infrastructure.
- Report intentionally caught production failures with the established error-reporting utility;
  graceful degradation must not become invisible operational failure.
- After a mutation, call the relevant method from `useCacheInvalidation` or the server feed/cache
  invalidator. Do not add a new event bus.

## 8. Data model and migrations

- `prisma/schema.zmodel` and `prisma/models/*.zmodel` are the authored database/access-policy source.
  `generated/zenstack` is generated output and is not hand-edited.
- Schema changes require a real, complete migration directory and regenerated ZenStack output for
  local verification.
- Prefer additive, backward-compatible migrations. Separate destructive cleanup from rollout and
  document required ordering.
- Never run `db:reset`, `db:fresh`, destructive SQL, data deletion, or an apply-mode backfill without
  explicit authorization and an exact verified target.
- Backfills are dry-run by default, idempotent, bounded, and report what they would change. Apply mode
  requires explicit user approval.
- `bun run release` / `bun run db:migrate:deploy` changes a database. Run it only against an explicitly
  identified environment and only when the user has authorized that release operation.
- Do not treat generated files or a successful typecheck as proof that a migration is safe. Review
  constraints, indexes, defaults, policies, existing rows, rollback/forward-fix strategy, and
  application compatibility.

## 9. AI, media, billing, and background work

- Browser code never calls AI providers with secret keys. Provider calls belong behind server/API
  boundaries.
- Keep deterministic analysis separate from remote/AI analysis. Never present heuristic or fake
  results as fact-checking.
- AI generation must preserve reservation, settlement, cancellation, timeout, partial-result,
  audit, and recovery semantics. A completed customer result must not become a failed run solely
  because internal metering failed.
- Treat model output and retrieved pages as untrusted. Validate structured output, sanitize HTML,
  verify URLs/media, and keep research evidence distinct from generated claims.
- Media operations must preserve tenant ownership, provenance, rights metadata, usage indexing, CDN
  restrictions, and archive-before-delete behavior.
- Stripe prices, article packs, plan features, and ratios come from server-owned catalog/policy
  utilities. Never duplicate authoritative billing values in the UI.
- Scheduled tasks may run once per application replica. Do not scale or redesign scheduling without
  addressing duplicate execution and idempotency.
- Advertising/revenue-share functionality is halted. Do not enable, market, or reinterpret retained
  code as an active entitlement without an explicit product decision.

## 10. Testing and verification

- Add focused tests for significant behavior, bug regressions, pure business rules, authorization,
  state transitions, and edge cases. Use the existing Vitest/Nuxt test stack.
- Test the smallest relevant target during iteration, then broaden verification in proportion to
  risk.
- Standard non-destructive checks are:

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

- Do not automatically run the entire Playwright matrix for a small change. Run targeted E2E only
  when the behavior crosses real browser boundaries, and run release smoke for release-sensitive
  assets, service workers, migrations, auth, or deployment changes.
- CI on `dev` and `main` has three gates:
  - lint, OpenAPI contract, and typecheck;
  - Vitest with PostgreSQL migrations;
  - production build plus release-smoke E2E and the wallet scrolling scenario.
- Never dismiss a failing check as irrelevant without proving it is stale or outside the supported
  behavior. Fix implementation regressions; update/remove stale tests only when the current product
  contract demonstrates that the test is wrong.
- Distinguish failures caused by the current change from pre-existing failures and report both.
- Formatting commands can rewrite unrelated files. Inspect `git diff` before and after any fixer and
  revert only changes created by the agent, never user work.
- For UI work, also inspect responsive breakpoints, keyboard use, dark mode, loading/error/empty
  states, overflow, and Czech text. Do not claim manual behavior was verified if it was not.

## 11. Documentation

- Update `MAP.md` for structural changes, new subsystems, important data flows, deployment behavior,
  or non-obvious invariants. Do not turn it into a changelog for trivial styling edits.
- Update `README.md` when setup, commands, dependencies, supported capabilities, or operator workflow
  changes.
- Keep API contracts, scripts, environment examples, and operational docs synchronized with code.
- Documentation must describe current behavior, not planned behavior presented as shipped.
- Prefer precise repository-relative paths and executable commands over generic prose.

## 12. Git and commit rules

- Never commit unless the user explicitly asks for a commit in the current conversation.
- Never push, open a PR, merge branches, tag, publish a package, deploy, or run a production release
  unless the user explicitly requests that exact external action.
- Before any Git write, inspect `git status`, the relevant diff, branch tracking state, and recent
  history. Stage only intended files.
- Commit messages are simple one-line Conventional Commits, for example:
  - `feat(editor): add article optimization checks`
  - `fix(ci): normalize generated path casing`
  - `test(media): cover asset usage indexing`
- Do not add `Co-authored-by` or other trailers unless explicitly requested.
- A commit must represent one coherent outcome and leave the repository internally consistent. Do
  not split a change so intermediate commits fail typecheck or tests.
- When the user requests a large history split, group files by coherent outcome and avoid putting the
  same file in multiple commits where feasible. Do not fabricate commit dates or rewrite published
  history unless explicitly instructed.
- Do not amend, rebase, squash, cherry-pick, force-push, reset, or delete branches without explicit
  authorization. Before an authorized history rewrite or reset, resolve exact refs and create a
  recoverable safety branch/tag when appropriate.
- Never use destructive workspace commands such as `git reset --hard` or `git checkout -- <path>` to
  clean up shared work.

## 13. Branch integration

- Treat `dev` as the integration branch and `main` as the production branch unless the repository or
  user explicitly establishes a different workflow.
- Fetch before comparing branches. Inspect both commit divergence and content differences:

  ```bash
  git fetch origin
  git rev-list --left-right --count main...dev
  git log --left-right --cherry-pick --oneline main...dev
  git diff --stat main...dev
  ```

- Never assume `main`-only commits are irrelevant merely because a merge is conflict-free. Review
  their behavior and how they interact with `dev` changes.
- Prefer a fast-forward when one branch is a strict ancestor. Otherwise perform an ordinary merge so
  both histories are preserved; resolve conflicts by behavior, not by blindly choosing one side.
- Do not reset local `main` to remote or discard ahead commits without explicit instruction. If such
  recovery is authorized, create a safety ref first and verify the final tree against it.
- After integration, verify local and remote refs explicitly and report the exact short hashes and
  divergence counts. A clean merge message is not proof that branches are synchronized.
- If asked to make both branches identical, ensure both point to the same tested commit; do not merely
  make their file trees happen to match.

## 14. Publish and release rules

- Pushing is publishing repository state and can trigger CI or deployment. It always requires an
  explicit user request naming the intended branch.
- Before a requested push:
  - confirm the active branch and upstream;
  - confirm the working tree and commits being sent;
  - run the agreed verification;
  - use a normal push, never force, unless separately and explicitly authorized.
- Both `dev` and `main` trigger CI. Do not promote to `main` while required CI is failing or while
  unexplained branch-only changes remain.
- A production release consists of more than a Git merge: migrations, the Docker/Nitro build,
  runtime configuration, scheduled tasks, service-worker compatibility, health checks, and rollback
  or forward-fix readiness must all be considered.
- The production container is built with Bun 1.4.4 and `bun run build`; runtime starts
  `.output/server/index.mjs`. Keep package manager, lockfile, Docker, and CI versions aligned.
- Apply production migrations only through the established release command and authorized deployment
  process. Never point local destructive tooling at an ambiguous database URL.
- Deployments are human-controlled. Do not trigger Dokploy, change platform state, rotate secrets,
  alter DNS/TLS, scale replicas, or run production backfills without explicit approval.
- After an authorized release, verify CI/deployment status and the smallest meaningful production
  smoke checks. Do not claim success from a successful push alone.

## 15. Handoff

Every completed change should report, concisely:

- the user-visible or operational outcome;
- files/subsystems changed;
- key architectural decisions or limitations;
- checks run and their exact result;
- checks not run and why;
- migrations, configuration, rollout, or follow-up work still required;
- current Git state, and commit/push hashes only if those actions were explicitly requested.

Do not hide uncertainty. A precise limitation or unverified step is more useful than an unsupported
claim that the work is finished.
