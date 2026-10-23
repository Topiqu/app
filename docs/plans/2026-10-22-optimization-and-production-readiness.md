# Optimization and production readiness acceptance plan

Status: **CQ-01–CQ-47 implemented; agreed local/ARM64 verification complete**.
Recorded 2026-10-22; acceptance scope updated 2026-10-23.
Read together with [the code quality backlog](../../CODE_QUALITY_AUDIT.md), its
40 baseline findings, CQ-41 through CQ-47 discovered during implementation verification,
and [per-file inventory](../audits/2026-10-22-codebase-inventory.csv).

## User intent and completion contract

The implementation must improve simplicity, reuse, performance and
security while preserving supported product behavior. Advertising and all related
code/data remain retained and halted. Expensive upload work should be avoided where
validated results can safely be reused. Do not delete historical migrations/data.

The user additionally requests the latest mutually compatible stable dependencies,
reactive destructured props, shallow refs for primitive state, deliberate lazy
loading/data fetching/hydration, computed derivations, smaller payloads and appropriate
auto/dynamic imports. These are candidate techniques with correctness conditions,
not mechanical substitutions or performance improvements that are already proven.

No test suite can prove the absence of every possible leak, race or exception.
Acceptance requires no unresolved release-blocking findings, passing relevant
regressions, bounded-resource evidence, a tested production artifact and explicit
remaining limitations. Never call the result fully production ready from lint,
typecheck, static coverage or historical test results alone. A known reproducible
supported-path failure is not waived because unrelated tests pass.

The user subsequently authorized execution of the complete plan. Local implementation,
compatible upgrades, regression tests and isolated test-database migrations are in scope.
Paid provider calls, commit/push, production database changes and release still require
their explicit authorization. Routine implementation decisions do not need renewed approval.

## Current acceptance scope — updated 2026-10-23

The user subsequently requested proportionate verification and confirmed that local
or ARM64 evidence is sufficient. The supported final verification target is ARM64
image `sha256:ddb1cb4d7bfea298f278d8ba3e8dc09557510dffca5a5ee8e1ed85bbb6a831ee`.
All CQ-01–CQ-47 implementations are complete. Final artifact/native checks, three
production workflows, three private-session lifecycle cases, five release-smoke
cases and the Chromium mobile-wallet case passed. Final shutdown completed in
346 ms with exit 0, OOMKilled=false and zero remaining database connections.
All required checks under this narrowed local gate are complete.

Current acceptance combines the recorded full-suite/static/database evidence with
these final ARM64 checks and the unchanged canonical 100-cycle repeat passed on
the earlier `ac902af1…e4f6` checkpoint. The two subsequent changes only added
accessible labels and a header fallback; no lifecycle behavior changed. The
100-cycle result remains attributed to its actual image, without another repeat.
Image `f5074a4f…5518` and the private 20-cycle snapshot are earlier diagnostic
evidence; another heap dump is not required.

AMD64 validation, extra historical matched-baseline/performance builds, the full
75-minute server stress protocol and extra four-locale/tablet/browser-matrix
coverage are deferred outside this local acceptance scope. The AMD64 build was
intentionally canceled at the user's steering (exit 130); no AMD64 acceptance is
claimed. Deferred checks are not passed checks. Sections 1–7 retain the original
broader plan as reference; they do not override this narrowed current gate or
authorize restarting deferred work. Existing thresholds and verified results
remain unchanged. Production rollout, real production-backup recovery, WebKit
validation over TLS, two custom-domain TLS-fixture cases and paid-provider checks
are outside this goal's scope and remain unverified. No production deployment or publishing is authorized.

## Execution record

Implementation started from the audited `5cfbf374` baseline; the shared branch now also
contains the user's navigation commits through `a11e5bc4`. Those changes are preserved.
The following records distinguish completed implementation, verified local evidence
and the remaining closeout. They do not establish a production release:

| Work                               | Current state and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CQ-01/02                           | Tenant-authorized bounded drafts, pagination and transactional decisions/audit CAS implemented; focused17 tests passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CQ-03/09/10/18/37, Vue             | Request ownership, SSR payload reuse, tag slug reuse, editor recovery/autosave bindings, CSV safety, props/shallow refs, lazy follow reads and idle/hidden timer disposal implemented. Framework/editor177-test group passed; follow/clock/Tiptap39 and analytics/password/WebVitals69 passed. The ac902 ARM64 checkpoint passed the unchanged canonical 100-cycle resource screen; the final ddb1 artifact passed all seven emitted-asset budgets.                                                                                                                                                                                                                                                                                   |
| CQ-04                              | Shared stored-HTML/plain-text metrics feed both generation and ORM writes, preserving explicit values. Real PostgreSQL create/update/explicit-value cases passed; historical rows untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CQ-05/06/07                        | Removed unused OAuth-state and LinkedIn lookup, shared external DTO selection. Existing54 tests passed. Active integrations and halted ads retained.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CQ-08/12/35                        | Shared upload limits, cheap rejection and same-tenant/content/policy-bound moderation reuse implemented; focused118 tests passed. Existing unavailable-provider fail-open behavior stays explicit and cannot create a reusable clear proof.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| CQ-11                              | Scheduled generation now has inferred/validated query, transaction, generation and outcome boundaries; four files36 tests passed, including validated legacy community insights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CQ-13/17/39/40                     | Public DNS/address pinning, operation deadlines, bounded PDF/media work and tenant-scoped generated UUID images implemented. Focused remote/PDF182 and updated parser/PDF58 tests passed. Actual provider/CDN behavior unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CQ-14/15/16/19/20/24               | Bounded claims/leases/retries, indexing eligibility/ownership and atomic product staging/swap implemented. Latest combined PostgreSQL/auth/catalog/GC/community group passed9 files93 tests on migration131; reader identity/policy/migration cases also ran in the full suite. GC retains conservative quarantine; no automatic physical purge.                                                                                                                                                                                                                                                                                                                                                                                      |
| CQ-21/30/31, cache and translation | Initial Redis readiness, bounded commands, shutdown cleanup and explicit invalidation outcomes implemented. Real isolated Redis8.2/ioredis6 group passed5 cases. Tags/translations invalidate public feeds; translation source/version locks, monotonic CAS and postcommit media/metering/report handling passed four real PostgreSQL concurrency cases. Prolonged Redis outage can leave other replicas stale until TTL; no durable outbox.                                                                                                                                                                                                                                                                                          |
| CQ-22                              | Single LinkedIn POST, durable ambiguous outcomes and audited local-only known-ID reconciliation implemented. Seven actual PostgreSQL cases passed; latest WP/external/LinkedIn63-test batch passed. Drain old workers before rollout; no cross-system exactly-once claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CQ-23                              | Current docs reconciled with ioredis, scheduling, four locales, container startup migrations, actual observability and retained ads. Historical audit labeled;22 local Markdown links and formatting checks passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CQ-25/26/27/28/29                  | Server article visibility, tenant-bound social references/toggles/report budgets and ancillary failure isolation implemented. Bounded iterative comment pages/context passed PostgreSQL ranking/cursor/visibility cases and frontend regressions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CQ-32/33/34                        | WordPress durable owner fencing/admin recovery, verified source namespaces and bounded linear reconciliation implemented. 63 related tests, 87 standalone PHP assertions and 16 syntax checks passed. 5,000-row SQLite import 404ms/unchanged 126ms/reconcile 113ms. Actual isolated WordPress 7.1.3 / WP-CLI 2.12.0 / PHP 8.3.36 / MySQL 8.4.13 passed 32 native assertions plus aggregate (33 PASS), all 3 suites, exit 0, including real SIGKILL recovery; exact owned containers/volumes/internal network cleaned up. See [native runtime record](../audits/2026-10-22-wordpress-mysql-verification.md).                                                                                                                          |
| CQ-36                              | HMAC-stored, account/email-bound one-time verification, atomic issuance/consume, shared cooldown/budgets and abortable mail/UI implemented. Latest13 PostgreSQL cases plus77 offline/UI/MJML/i18n tests passed. No auth DDL; coordinated auth server/UI rollout and old-worker drain required.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CQ-38                              | Poll and media-library maintenance are dry-run-first, bounded/resumable and revalidate committed work. Auth/poll/metrics20 real PostgreSQL cases and media maintenance3/3 passed. No maintenance applied to production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Dependencies                       | 115 baseline direct packages reviewed/refreshed;114 retained. Latest compatible Bun1.4.4, Node24, framework/editor/AI/auth/ORM/tooling/utilities/Stripe/Sentry families selected. SEO6/Takumi2 blocked by missing Bun findPackageJSON; TS7 native API, H3v2 runtime, Node26 types and unpublished MJML types have concrete holds. Unused Nuxt Stripe module, four global overrides, three obsolete patches and obsolete Router Volar bridge removed. Fresh frozen install passed. A targeted Unhead 3.4.3 Bun patch was subsequently added for CQ-47 and passed frozen installation plus 23 focused tests. Five all-dependency/four production-manifest advisories are tracked with reachability/hold evidence; no clean-audit claim. |
| CQ-41/42/44/45/46                  | Authored IPX Fetch bridge and graceful Bun lifecycle passed native image/header/304/host-denial checks, release5 and five real signal/stream/deadline cases. Public visibility passed11 related,28 collection/detail and6 tag-ID PostgreSQL cases. Bounded body intake passed48 focused plus8 actual Linux HTTP cases. OG byte-limit adapter passed65 focused cases including actual module registration and SSRF transport behavior. Patched ARM64 compiled/native runtime checks passed; AMD64 validation is deferred under the user’s narrowed scope.                                                                                                                                                                              |
| CQ-43                              | Component-owned AsyncData/Colada callbacks now have module-owned callbacks or explicit disposal; defaults, feed, follow, tag/history and currency lifecycle regressions pass. Playwright clock/file-handle retention was independently identified and removed from instrumentation, preserving the workload and growth bounds. The ac902 ARM64 canonical100-cycle screen passed unchanged. The earlier20-cycle diagnostic is preserved; no additional heap dump is required.                                                                                                                                                                                                                                                          |
| Combined verification              | Full-suite checkpoint before CQ-47:444files3470tests passed,6 paid-eval files/22tests skipped, real isolated PostgreSQL and Redis enabled. Vitest5 virtual-ID collection failures were fixed with fsModuleCache:false; public test boundaries/expectations now match current behavior. Four-worker shared-host deadline failures reproduced under11+GiB swap; unchanged focused10cases and full two-worker run passed in396.47seconds. maxWorkers2 is now the default; assertions/deadlines and resource/bundle gates unchanged. Full lint, OpenAPI, final typecheck and repository formatting passed.                                                                                                                                |
| CQ-47                              | Unhead cleanup retention reproduced at +34 DOM/+68 detached nodes per cycle; private20-cycle retaining path and public-API red confirmed the cause. Minimal locked Bun patch, frozen install and normal Nuxt head/SEO/toolchain23 tests passed. Patched ARM64 full canonical100-cycle repeat50712 exited0/screen-passed: DOM2935/2935, listeners410/410, detached124/124, Editors0, heap noise/slope passed, URLs110/110, errors/rejections/hydration/mutations0.                                                                                                                                                                                                                                                                     |
| Upgrade/restore                    | Isolated synthetic 120→131 upgrade and fresh dump/restore passed: 75 historical tables/33 fixture rows and 995 historical index/constraint definitions preserved, six reader indexes valid, repeat deploy unchanged, all 13 restore checks passed. See [upgrade/restore audit](../audits/2026-10-22-upgrade-restore-verification.md). Production backup recovery remains unverified.                                                                                                                                                                                                                                                                                                                                                  |
| ARM64 checkpoint before CQ-47      | Uninstrumented repository Docker build passed (16602, exit 0). Bun 1.4.4/UID 1000 and normal migration startup verified; WebP/304/host denial, six compiled body cases, native Takumi PNG/cache and clean shutdown/pool closure passed. Exact-artifact inspection passed 24 compiled/policy checks, five ARM64 native ELF checks and all seven original asset budgets. Compiler-only Node 24.21.0 matches existing CI; Bun prepare/generation/migration packaging/runtime retained. Release toolchain regression: ten tests passed.                                                                                                                                                                                                   |
| Current local acceptance           | All CQ-01–CQ-47 implemented; agreed local/ARM64 verification complete. Final ddb1 artifact/native checks, production workflows3, private-session3, release-smoke5 and touch Chromium mobile-wallet1 passed. Final shutdown346ms/exit0/OOMfalse and independent pool observer0 passed. WebKit/TLS, two custom-domain TLS-fixture cases, paid checks, real production-backup recovery and rollout remain outside scope; extra locale/tablet/matrix, AMD64, baseline/performance,75-minute stress and heap dumps are deferred. No commit, push or production change.                                                                                                                                                                     |
| ARM64/CQ-47 checkpoint             | Actual repository Docker rebuild62992 passed (exit 0), image ac902af1…e4f6. Fresh native Bun revision/UID1000/migration startup, six compiled body cases and Takumi1200×600/312319B/cache passed. Exact-artifact 24 compiled/policy checks, five ARM64 ELF checks, seven original budgets and emitted cleanup JS passed. Normal Nuxt head/SEO/toolchain23 tests passed; frozen install exited0.                                                                                                                                                                                                                                                                                                                                       |
| Final ARM64 artifact and browser   | Docker build56198 exited0, image ddb1cb4d…31ee. Exact-artifact24 compiled/policy checks,5 native ARM64 ELF checks,7 original budgets and emitted Unhead cleanup passed. Bun1.4.4/revision38af/UID1000,131 migrations,body6 and Takumi1200×600 PNG312319B/cache passed. Final production workflows3 and private-session3 passed; release-smoke5 passed in5.6s; touch Chromium360×800 wallet1 passed in2.6s. Final stop346ms/exit0/OOMfalse/pool0 passed. Canonical100 remains ac902-specific.                                                                                                                                                                                                                                          |

The ARM64 checkpoint before the CQ-47 patch is
`sha256:f5074a4fcb32f47b74e3a5d3909aadab1d2b3abe51d09134c6b36813e16a5518`.
Its Bun 1.4.4 revision is `38afee6c84fcf48c0edb2466aa4b27d287a59c30`.
Native Takumi rendered a 1200×600 PNG of 312,319 bytes and reused identical cached
output. The container stopped in 0.378 seconds with exit 0, OOMKilled=false and
zero remaining application database connections. The uninstrumented build and
native runtime results are recorded in the
[performance verification](../audits/2026-10-22-performance-verification.md);
they do not establish a controlled compilation speedup or sustained-resource result.

The actual patched ARM64 rebuild (62992) exited 0 and produced
`sha256:ac902af17786be3b5d7ce0e77973921a7cb13b54b2a92c3f2fa8271dc445e4f6`.
Fresh native startup, Bun revision/UID 1000, six compiled body cases and native
Takumi 1200×600 PNG rendering (312,319 bytes) with cached reuse passed. Exact-artifact
inspection passed 24 compiled/policy checks, five native ARM64 ELF checks and all
seven original asset budgets, with the cleanup-entry consumption present in emitted
JS. The 23 head/SEO/toolchain tests also passed under the normal Nuxt config (44820).

The full canonical 100-cycle repeat on that image (50712) exited 0 with
`screen-passed`, using the unchanged gates:

| Signal                                                                | Reported warm/tail or total                              |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| DOM nodes                                                             | 2,935 / 2,935                                            |
| Listeners                                                             | 410 / 410                                                |
| Detached nodes                                                        | 124 / 124                                                |
| Editors                                                               | Zero at every checkpoint                                 |
| Heap                                                                  | 29,994,840 → 32,331,132 bytes; noise/slope policy passed |
| Object URLs created/revoked                                           | 110 / 110                                                |
| Canceled reads                                                        | 110                                                      |
| Errors, unhandled rejections, hydration warnings, forbidden mutations | Zero                                                     |

The final production ARM64 artifact is
`sha256:ddb1cb4d7bfea298f278d8ba3e8dc09557510dffca5a5ee8e1ed85bbb6a831ee`
(Docker build 56198, exit 0). Its 24 compiled/policy checks, five ARM64 native ELF
checks, seven original asset budgets and emitted Unhead cleanup verification passed.
Native startup verified Bun 1.4.4 revision
`38afee6c84fcf48c0edb2466aa4b27d287a59c30`, UID 1000 and all 131 migrations.
Six compiled body-intake cases and native Takumi 1200×600 PNG rendering
(312,319 bytes) with cached reuse passed. The final container stopped in 346 ms
with exit 0 and OOMKilled=false. An independent `pg.Client` observer confirmed
zero remaining application connections in the isolated browser database. Evidence:
`/tmp/topiqu-final-local-shutdown-20261023.json` and
`/tmp/topiqu-final-local-pool-closure-20261023.json`. The exact owned stopped
container was removed; the verified image remains available.

All three final production-workflow cases passed, including the two accessible-label
repairs in User/Account and Client/Version. All three private-session cases passed
in 6.3 seconds: real account A → logout → account B with offline privacy, cancellation
of a real media read on modal/editor SPA unmount, and leaving a real SSR editor
before hydration without corrupting the next authenticated page. Their harness
corrections use the seeded localhost tenant, cross-document waits and actual
network reads instead of pre-network navigation aborts. The media helper checks
CSS-visible cards and triggers a late visible lazy load within the original
ten-second bound; application behavior, deadlines and error gates were unchanged.
See `/tmp/topiqu-final-local-private-green-20261023.log`.

All five final release-smoke cases passed in 5.6 seconds: SSR styles/compressed
hashed assets, IPX headers/304/host restrictions, private service-worker cache
cleanup/offline denial, assets across activation and signed-in SSR.
See `/tmp/topiqu-final-local-release-green-20261023.log`.

Local closeout under the user's narrowed scope is complete:

- The existing wallet case passed at 360×800 with touch Chromium: one case in
  2.6 seconds, recorded in
  `/tmp/topiqu-final-local-mobile-chromium-wallet-20261023.log`.
- Final shutdown and independent database-pool closure passed as recorded above.
  No required local verification remains pending.
- The ac902 CQ-47 canonical 100-cycle repeat is complete and remains checkpoint-specific;
  the later accessible-label/header-fallback changes do not require another
  lifetime run or heap dump under this proportional gate.

This mobile result covers a Chromium touch viewport. The mobile WebKit run could
not hydrate over the HTTP fixture: production CSP upgraded 130 `/_nuxt` requests
to HTTPS on the HTTP-only port, causing TLS failures. WebKit/TLS validation is
deferred; production CSP and transport security were unchanged.

The earlier compiled critical batch on `ac902af1…e4f6` passed 11 of 17 cases:
eight core cases, editor conflict/history recovery, session revocation and wallet
coverage. The final workflow/private-session repeats above supplement that
historical batch; they do not relabel it as a single all-17 passing run. Two
custom-domain cases remain deferred to a TLS-capable fixture because HTTP virtual
hosts conflict with production CSP `upgrade-insecure-requests`; security remains
unchanged. Extra four-locale, tablet and broader browser matrices are outside the
current completion gate.

AMD64 runtime/trace checks, extra matched request/query/payload/timing baselines
and builds, and the complete 75-minute server protocol remain deferred. The
existing matched gzip comparison covers emitted assets; it does not establish
a matched application request/query or speedup result. Production rollout, real
production-backup recovery, WebKit/TLS and paid-provider checks are also outside this local
goal and are not claimed passed. Preserve advisory holds and unmeasured-workload
limitations.

## 1. Establish a reproducible baseline before implementation

- Identify exact HEAD, branch and intended changes; preserve unrelated shared work.
  Record the state against which behavior and measurements are compared.
- Prepare synthetic tenants, roles/scopes, all four supported locales, article and
  translation states, media origins and representative small/large data sets.
  Use a dedicated verified test database and isolated WordPress where required.
- Reproduce CQ-01/CQ-13/CQ-24/CQ-25/CQ-26/CQ-31/CQ-40 and the state/lease findings
  with permanent behavior tests before their fixes. Keep schema-backed risks and
  measured incidents distinguishable; do not weaken assertions to obtain green CI.
- Record public/admin/editor request counts, transferred/serialized bytes, production
  chunks, DB query counts, warm/cold timings, hydration diagnostics and memory/resource
  baselines. Use existing `performance-budgets.json` and `scripts/performance-budgets.ts`.
- For each change group, state behavior preserved, expected benefit, proof method,
  failure recovery and any real migration/rollout dependency. One later task may cover
  all groups, but changes must remain reviewable and verifiable in sequence.

## 2. Upgrade all dependencies to a verified compatible stable set

At implementation time, query the registry and primary release/migration notes for
every direct and development dependency. Build a matrix of current version, latest
stable, selected compatible version, peer/engine constraints, breaking changes,
security findings and verification. Do not freeze guessed future versions in this
plan or interpret a valid semver install as proof of runtime compatibility.

- Target the newest stable combination that supports required behavior and runtime.
  A newer incompatible major needs its documented migration and full validation.
  Record any package temporarily held back and the concrete compatibility blocker.
  Do not solve a peer conflict by ignoring it or introducing a prerelease silently.
- Upgrade related families together: Nuxt/Vue/Nitro/UI/Reka/Unhead/i18n and modules;
  Tiptap/ProseMirror; ZenStack CLI/ORM/schema/policy/Zod/auth adapter and migration
  tooling; Better Auth; AI SDK and its providers; Vitest/coverage/test-utils; Playwright
  and browser binaries. Family members need compatible versions, not necessarily
  identical version numbers across unrelated packages.
- Validate server-native dependencies (`argon2`, `sharp`, Takumi/Prisma engines) on
  the actual deployment architecture. Host macOS success is not Linux validation.
- Reassess `patchedDependencies` for Nuxt UI, image and devtools against upstream
  fixes. Rebase or remove patches only with the relevant regression/build evidence.
  Review every override and security constraint; do not remove all overrides blindly.
- Include transitives and advisories in the review. Do not force unrelated transitive
  majors or suppress reachable vulnerabilities to make an audit report green.
- Use Bun exclusively and intentionally update `bun.lock`. If upgrading Bun or Node,
  synchronize packageManager/engines, `.node-version`, Docker, CI, docs and toolchain
  tests. Verify the supported production Bun runtime, not only Node-based tooling.
- For each family, install and validate a fresh frozen graph with
  `bun install --frozen-lockfile`, generation, relevant tests/typecheck and production
  build. Re-run dependency advisory checks. Do not mix all library migrations and
  application refactors into one unverified rewrite.
- Keep Stripe/Shopify/provider external API versions and webhook/data contracts
  explicit. Updating an SDK does not automatically authorize changing those contracts.

## 3. Vue reactivity and code simplification

### Destructured reactive props

Prefer `const { option = defaultValue } = defineProps<Props>()` in supported Vue 3.5
SFCs in place of `withDefaults(defineProps(...))`. Initially identified sites include
AppLogo, AppConfirmDialog, Auth/Logout, Media/Library and Form/Client/LogoUploader.
Check the complete source again at implementation time.

Preserve defaults, optional/null/Boolean behavior, aliases and function-valued props.
Convert mutable default factories to the correct per-instance destructure default.
Pass `() => prop` to watchers/composables that need a reactive source; passing a
primitive snapshot loses that connection. Do not confuse compiler-supported props
destructuring with ordinary destructuring from a reactive object. Verify parent prop
changes, two simultaneous instances and existing emitted/v-model contracts.
See [Vue reactive props destructure](https://vuejs.org/guide/components/props.html#reactive-props-destructure).

### Shallow refs and external objects

Use `shallowRef` for state that remains primitive and for opaque editor/SDK instances
or large data updated by root replacement. Primitive `ref` already has no nested
object graph to proxy; treat that replacement primarily as consistency, not a claimed
large runtime saving. Validate the variable's entire assignment/type lifecycle:
`ref(null)` may later contain an object. Preserve deep tracking for nested form edits
and in-place array/Set/Map mutations unless the update contract is deliberately
changed. Avoid ad-hoc `triggerRef` calls compensating for an incorrect conversion.
See [Vue shallowRef](https://vuejs.org/api/reactivity-advanced.html#shallowref).

### Computed derivations and effects

Prefer pure `computed` for values derived from existing state. Retain watchers for
network/storage/DOM effects and explicit state transitions. Do not replace editable
draft buffers or history with computed values that overwrite unsaved changes.
Avoid deep-watching whole documents when narrow sources suffice. Register watcher
cleanup synchronously before awaiting work; cancel stale requests and fence their
success, error and finally handlers. Async-created watchers need explicit ownership
and disposal. See [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup).

Use small domain functions/composables where responsibility or reuse warrants them.
Do not replace duplicated trust-boundary validation with a shared client-only check,
or add a universal abstraction to remove a few similar-looking lines.

## 4. Separate routing, fetching, code loading and hydration

These are different mechanisms. Choose them for each page/section, rather than
making every component and request lazy.

| Surface                                                                             | Data/navigation policy                                            | Loading and hydration policy                                                                                   |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Public article/title/canonical/structured data and essential first-viewport content | SSR-safe initial data; reuse payload                              | Stable server HTML; hydrate essential actions promptly; protect LCP media                                      |
| Public related content, secondary comments and nonessential lower sections          | Independent bounded requests where appropriate                    | Consider visible hydration for SSR-rendered secondary trees; stable placeholders if data is pending            |
| Admin dashboard/list/media/knowledge                                                | Render authorized shell promptly; lazy-fetch independent sections | Existing Nuxt UI skeletons; preserve filter/page state, empty/error/retry and accessibility                    |
| Editor workspace and recovery                                                       | Resolve authorization and source identity before editing          | Reuse existing lazy workspace/skeleton; preserve autosave, dirty/conflict state and generation ownership       |
| Charts, picker/history/preview dialogs and rarely opened tools                      | Load data when useful; avoid unnecessary eager work               | Lazy component/import at a real usage boundary; interaction strategy only with keyboard and first-action tests |
| Cookie consent, authentication, navigation and primary save/publish actions         | Required guards still block private/unauthorized behavior         | No artificial delay that strands important controls or loses the first action                                  |

For nonessential client navigation data use `useLazyFetch`/`useLazyAsyncData` or
`lazy: true` with stable tenant/locale/filter keys. Lazy navigation is not equivalent
to `server: false`; initial SSR can still fetch. Preserve payload reuse and explicit
fresh refresh after mutations. Request-independent work may run in parallel, but
paid/heavy fan-out must have concurrency bounds. Avoid duplicate setup `$fetch`
requests and new sequential waterfalls. See [Nuxt lazy async data](https://github.com/nuxt/nuxt/blob/main/docs/4.api/2.composables/use-lazy-async-data.md).

Skeletons should reserve the final layout's approximate geometry and image aspect
ratios, with responsive/dark-mode variants, `aria-busy` and reduced-motion behavior.
Use genuine idle/pending/success/empty/error states; absence before a deferred request
is not an empty result. Fast cached content should not flash a placeholder. Keep
background refresh content when appropriate and avoid shifting existing scroll/focus.

For SSR-rendered noncritical trees, consider Nuxt's `hydrateOnVisible`,
`hydrateOnIdle` or `hydrateOnInteraction` supported by the installed version.
Visible is suitable for lower content; idle for nonurgent enhancements; interaction
for suitable secondary tools. Interaction must work on keyboard focus and touch as
well as click. Test first-event replay, single action execution, async dependencies,
rapid navigation, prop changes and disposal before hydration. Preserve useful SSR
markup and deterministic hydration. See [Vue lazy hydration](https://vuejs.org/guide/components/async.html#lazy-hydration).

Many lazy paths/skeletons already exist in Topiqu, including editor/history/preview,
charts, related content and multiple admin pages. Extend those patterns; do not
claim their initial introduction or add wrappers without a measured benefit.

## 5. Payload, bundle and server-work reductions

- Prefer bounded explicit database selections and separate list/detail DTOs. Avoid
  article HTML, large audit/history blobs and unused relations in list responses.
  Preserve pagination, authorization and the version fields needed for conflict checks.
- Nuxt `pick`/`transform` can reduce serialized payload; they do not by themselves
  reduce data returned over the server API boundary. Fix excessive server selection
  as well. Review deep data options against actual mutations and the installed Nuxt
  defaults; do not layer a second cache just to avoid a request.
  See [Nuxt useFetch](https://github.com/nuxt/nuxt/blob/main/docs/4.api/2.composables/use-fetch.md).
- Use existing Nuxt auto-imports for discoverable app APIs/components. Auto-importing
  is not inherently lazy. Use explicit dynamic imports for heavy rarely used code
  at actual usage boundaries; inspect the emitted production chunks for proof.
- Keep provider/native/server dependencies out of browser graphs. Review broad
  barrels and module side effects; do not split critical code into many tiny chunks
  or defeat SSR with ClientOnly as a blanket optimization.
- Avoid unnecessary preloads/prefetch and duplicate i18n/large datasets in the initial
  public payload. Preserve supported locale fallback and public/editor rendering parity.
- Address CQ-12/CQ-35 provider ordering/reuse, bounded background concurrency, CQ-29
  thread shaping, CQ-34 set lookup, CQ-37 SSR fetch reuse and CQ-38 batch iteration.
- Optimize database queries only with realistic query-count/timing/EXPLAIN evidence.
  Preserve tenant predicates and real uniqueness/claim invariants. Cache values and
  cache misses need bounded memory, correct invalidation and user/tenant isolation.

## 6. Required failure, race and resource tests

### Synchronous and asynchronous correctness

- Resolve requests in reverse order, change tenant/locale/filter/article mid-flight,
  unmount before completion and test stale success, failure and finally callbacks.
- Test a committed mutation followed by notification/cache/metering failure and retry.
  The customer must not receive a false failure for a completed result. Distinguish
  required audit/financial transaction records from recoverable ancillary work.
- Exercise timeout, abort, offline/reconnect, 429/5xx, malformed provider output,
  unavailable Redis/DB and unexpected exception paths. Required checks fail closed;
  optional services degrade visibly and safely with bounded reporting.
- Canceling HTTP is not rollback of a remote side effect. Use idempotency and explicit
  uncertain-result reconciliation for publishing/payments; retain recovery records.

### Real database concurrency and recovery

- Use real dedicated PostgreSQL, not only mocked findFirst/create sequencing, for
  uniqueness, transactions, claim ownership, leases, quotas and wallet invariants.
- Run at least two overlapping workers/requests; kill or expire one claimant and
  ensure an older worker cannot overwrite the new owner after recovery.
- Cover simultaneous human/AI edits and translation writes, duplicate webhooks,
  concurrent voting/sharing, publication, expiry/payment and media restore/reference
  creation versus purge. Define expected transitions and assert persistent invariants.
- Retain bounded retries and deterministic recovery without duplicate paid work,
  double settlement, lost content, cross-tenant writes or unsafe deletions.

### Browser and server memory/resource behavior

- Inventory ownership and cleanup for timers, intervals, animation frames, listeners,
  observers, object URLs, subscriptions, editor instances, workers, streams and
  request controllers. Reuse VueUse disposal where available. A global generation
  store can intentionally outlive a component; do not abort valid customer work just
  because its view unmounted. SSR user data must never live in shared module state.
- Browser protocol: warm up, then repeat representative route/editor/modal cycles
  (initial target 100 cycles), including interrupted load/hydration, logout/tenant
  changes, heavy documents and upload previews. Take comparable heap snapshots and
  inspect retained detached DOM/listeners/instances after cleanup and test GC.
- Server protocol: a representative sustained run (initial target at least 60 minutes)
  under the intended runtime limit, with bounded concurrent requests and background
  work, failures, retries and disconnects. Track heap, RSS/native memory, event-loop
  delay, active/waiting DB connections, file/socket handles, in-flight work and caches.
- Define workload-specific memory/resource thresholds from the baseline before
  optimization. Require a stable bounded envelope after warm-up and explain retained
  caches; investigate sustained growth. Lower instantaneous RSS or one forced GC is
  not proof that a leak is absent. Keep heap snapshots free of real customer data.

The previously approved [local server resource protocol](../audits/2026-10-22-server-resource-protocol.md)
is now deferred outside the narrowed current acceptance scope. Its retained design
uses ten minutes of warm-up, sixty measured minutes and five minutes of cooldown.
It runs bounded fixed-key public reads, validation/404 paths and client aborts with
scheduled execution disabled (`TEST=1`), synthetic data, no provider credentials and
external egress blocked. It does not exercise sustained paid/background-worker load,
authenticated writes, large provider streams or cache-cardinality growth. Focused
PostgreSQL claim/recovery and failure tests provide separate correctness evidence;
they do not establish the resource profile of those excluded workloads. Application
cache cardinality, server-side in-flight counts and pool waiters remain unavailable
to this sampler and must not be presented as measured. Preserve these limits in the
final report alongside the unchanged thresholds and exact tested artifact.

## 7. Original broader release acceptance gates and evidence (reference)

These original gates remain reference for broader release verification. The current
proportionate local gate is defined in **Current acceptance scope** above; its
deferred architecture, baseline and sustained-stress work must not be reported as
passed or treated as a new prerequisite for finishing the authorized local work.

| Gate                 | Required evidence                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Behavior             | All 40 baseline audit items and CQ-41 through CQ-47 fixed, disproved or explicitly dispositioned with evidence; no unresolved release-blocking supported-path regressions     |
| Dependencies         | Current compatibility/advisory matrix, reviewed patches/overrides, frozen Bun installation and aligned toolchain                                                              |
| Static/contracts     | Schema generation, lint, formatting, OpenAPI and typecheck pass for final intended state                                                                                      |
| Automated behavior   | Focused regressions plus full Vitest including dedicated PostgreSQL; every skip classified, live paid evals separately authorized                                             |
| Production artifact  | Actual Linux deployment build and runtime smoke with native modules, intended runtime limits and no build-time production credentials                                         |
| Browser              | Compiled public/admin/editor/recovery/consent/auth/billing flows; locales en/cs/de/fr, mobile/desktop, dark/light, keyboard, slow/failing network, scroll/focus and hydration |
| Performance          | Before/after same-workload bytes/chunks/request/query/time measurements and existing budgets pass without weakening thresholds to hide regressions                            |
| Lifetime/concurrency | Recorded browser/server resource tests and actual overlapping-worker recovery; no unexplained sustained retention or invariant violation                                      |
| Upgrade/data         | Reviewed additive migrations where required; isolated empty-install AND representative upgrade/restore evidence, rollback/forward-fix plan                                    |
| Operations           | Safe error reporting, actionable task/failure monitoring, no secrets/customer content leaked in diagnostics, documented replica/config assumptions                            |
| Authorized rollout   | Exact tested artifact/ref and target environment, required CI green, operator-controlled deploy, small meaningful smoke and monitoring after release                          |

Use the existing verification commands; do not mark omitted database/browser/build
checks as passed. Run small relevant checks during each group, then the full required
gates for the completed broad change. Re-run on changed code or unresolved failures,
not repeatedly without a reason. Real provider sandbox smoke and production actions
still need their explicit environment/authorization.

`performance-budgets.json` already defines build budgets and field targets of LCP
2.5 seconds, INP 200 milliseconds and CLS 0.1. Preserve those configured budgets unless
a deliberate reviewed change is justified. Laboratory runs are comparisons; field
p75 compliance requires real representative field measurements after authorized rollout.

Final handoff must identify the exact verified state and changed subsystems, behavior
proofs, dependency exceptions, migration/config/rollout needs, measurement artifacts,
known limitations and every check run/skipped. Do not promise universal zero bugs,
or report a deployment as verified before it has actually been authorized and tested.

## Planning verification (historical)

At plan creation, framework behavior was checked against the official references linked above and the
installed Nuxt 4.6.0 / Vue 3.5.43 runtime source. Registry-wide latest-version selection
and compatibility testing remain work for implementation time. No dependency files,
application code, toolchain pins, database or runtime configuration changed for this plan.
