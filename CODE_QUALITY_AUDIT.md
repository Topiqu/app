# Code quality and optimization backlog

Audit started: 2026-10-22. Baseline: `dev`, `5cfbf374`.

This is an implementation backlog, not a claim that the application is production ready.
The audit uses repository-wide static discovery and selected manual data-flow reviews;
it does not imply individual review of every source line. The user has now authorized
implementation of the complete acceptance plan. The original 40 findings describe the
audited baseline; CQ-41 through CQ-47 were reproduced during implementation verification.
CQ-01–CQ-47 are implemented and the agreed local/ARM64 verification is complete.
That plan's execution record preserves checkpoint-specific proof and unrun checks;
production deployment and universal leak-free behavior are not claimed.

## User decisions and scope

- Preserve advertising and ALL related implementation, reporting, ledger, schema, and tests.
  Advertising remains halted; retention does not authorize activation. Do not classify this
  subsystem as disposable dead code or remove its dependencies merely because it is inactive.
- Optimize repeated image uploads to avoid unnecessary expensive processing/provider work,
  while preserving authorization, tenant isolation, moderation, provenance, and rights checks.
- The user authorized execution of the optimization recommendations and acceptance plan.
  Production operations and publishing remain subject to the repository's explicit-action rules.
- On 2026-10-23 the user narrowed verification to proportionate local/ARM64 evidence.
  AMD64, extra matched-baseline/performance builds, the 75-minute server stress
  protocol and extra four-locale/tablet/browser-matrix coverage are deferred, not
  current completion requirements and not claimed passed. Production rollout, real
  production-backup recovery, WebKit/TLS, two custom-domain TLS-fixture cases and paid-provider checks remain
  outside this local goal and unverified. Historical suggestions below do not
  restart that deferred work.
- Prefer simple domain-specific reuse. Do not apply DRY across intentionally different API,
  security, rendering, or financial contracts just because code looks similar.
- Never remove migrations or historical financial records as cleanup.
- The durable memory of these decisions is this versioned document; future agents should
  read it before implementing this backlog.
- Additional user requirements for compatible dependency upgrades, Vue/Nuxt optimization,
  race/leak/failure testing and release evidence are recorded in
  [Optimization and production readiness acceptance plan](./docs/plans/2026-10-22-optimization-and-production-readiness.md).
  Local implementation is now authorized under that plan. Its execution record distinguishes
  current verification from the historical audit passes below; neither establishes a deployment.

## Existing evidence

Read alongside `PRODUCTION_AUDIT.md`, `CORE_WEB_VITALS_AUDIT.md`, `MAP.md`, and
`docs/operations/production-workflows.md`. Historical repaired findings must not be
reported as current defects without rechecking the implementation. Existing runtime
and infrastructure verification does not certify a future refactor.

## Findings from the initial pass

### CQ-01 — P0: Draft listing bypasses request authorization

- Evidence: `server/api/drafts/index.get.ts` imports the raw system database client,
  calls `draftPost.findMany`, has no session/tenant guard, accepts an unchecked status,
  includes `task.company`, and has no result bound.
- Model policy exists in `prisma/models/linkedin.zmodel`, but the raw client in
  `server/utils/prisma.ts` only adds the mutation plugin, not request-user policies.
- Remediation: explicit actor/capability and tenant scope, enhanced request client,
  validated filter, safe DTO, bounded pagination compatible with the drafts UI.
- Required regression checks: anonymous rejection, foreign-tenant isolation,
  authorized reader/admin behavior, invalid status, pagination and DTO fields.
- Do not claim token exposure without testing generated `@omit` serialization;
  cross-tenant draft access is independently evident in the handler.

### CQ-02 — P1: Draft decisions and audit are not atomic

- Evidence: `server/api/drafts/[id]/approve.post.ts` and `reject.post.ts` first update
  DraftPost, then create Approval outside a transaction. A failed second operation
  leaves a changed status without the corresponding decision record.
- Both handlers convert all update failures to a null/403, hiding database failures.
- Remediation: transactional domain operation, validated rejection input, explicit
  failure classification/reporting; preserve role/capability and policy checks.
- Tests: second-write rollback, authorized decisions, forbidden decisions and failures.

### CQ-03 — P1: Media-rights results may arrive out of order

- Evidence: `app/composables/useMediaRights.ts` starts fetches on mount and debounced
  input changes; every completion unconditionally replaces result and state.
- Remediation: request generation/snapshot protection and appropriate cancellation;
  stale success AND stale failure must not overwrite the latest result/state.
- Tests: deferred promises resolved in reverse order and input change during a run.

### CQ-04 — P1: Article metrics have inconsistent competing implementations

- Evidence: `server/utils/prisma.ts::calculateBasicMetrics` and
  `server/utils/metrics.ts::calculateArticleMetrics` count differently. The mutation
  plugin always replaces count/reading time on create, even if supplied by a caller.
  Neither counter reliably strips HTML; the latter also removes Markdown links
  together with their anchor text.
- Remediation: one tested text/word/reading-time contract consumed by both paths.
  Keep savings calculations distinct. Confirm HTML/Markdown inputs and existing
  metrics consumers before changing behavior.
- No automatic historical backfill. Any backfill is a separate dry-run-first operation.

### CQ-05 — P2: Unreferenced Search Console OAuth state implementation

- Evidence: `server/utils/searchConsole/oauthState.ts` exports
  `signSearchConsoleState` / `verifySearchConsoleState`; tracked-source search found
  no callers or tests. Current connect/callback use integration tickets instead.
- Candidate for removal after checking generated auto-import references and dynamic
  resolution. Do not change the active integration-ticket security contract.

### CQ-06 — P2: Unreferenced LinkedIn organization lookup

- Evidence: `server/utils/linkedin/api.ts::getPagesUrn` has no tracked-source caller.
- Candidate for removing the individual unused function. Do not remove personal
  publishing or extrapolate this finding into deletion of retained integrations.
- `getPostMetrics` is explicitly retained/deprecated; do not silently delete it.

### CQ-07 — P2: Duplicate external article projection

- Evidence: `server/utils/externalApi.ts::externalArticleSelect` and
  `externalApiV1.ts::externalArticleV1Select` repeat the same base projection.
- Share only the explicit safe field selection where contracts match. Keep v1 date
  serialization, summary omissions, legacy response and authorization separate.
- Existing target: `tests/server/externalApi.test.ts` plus response contract coverage.

### CQ-08 — P2: Upload limits duplicated across client/server

- Avatar: `app/composables/useAvatarCropper.ts`, `server/utils/avatar.ts` (10 MiB).
- Emoji: `app/components/Emoji/Create.vue`, `server/utils/emojiImage.ts` (5 MiB).
- Fonts: `app/components/Form/Client/BrandFontSlot.vue`,
  `server/api/clients/[id]/fonts.post.ts` (2 MiB).
- Move matching domain limits into a browser-safe shared module, following the
  existing favicon/knowledge pattern. Keep actual server enforcement and separate
  processing differences (animation, dimensions, moderation, accepted formats).

### CQ-09 — P2: Repeated tag slug normalization

- Evidence: `app/components/Tags/Create.vue`, `Tags/Manager.vue`, `Article/Tag.vue`
  repeat `slugify` with matching lower/strict/trim options.
- Share a small tag-domain normalizer; inspect server normalization too. Article
  slug length/collision rules and subdomain rules must remain distinct.

### CQ-10 — P2: Editor orchestration and repeated panel bindings

- Evidence: `app/components/Article/Editor/Workspace.vue` (1510 lines at baseline)
  repeats a large SettingsPanel props/events contract for desktop and mobile.
  It also coordinates load/save, translations, recovery, publish and navigation.
- Consolidate repeated bindings without adding another visual component hierarchy.
  Extract cohesive save/publish or recovery behavior only with clear typed contracts.
- Preserve editor/public parity, dirty state, conflicts, autosave, translations,
  mobile/desktop refs and media-rights review. Test real browser interactions.

### CQ-11 — P2: Important boundaries are weakened by any

- Evidence: `server/tasks/generate-article.ts` uses `any` for processClient,
  transaction context, generated output and outcomes; Workspace casts loaded data.
- Prioritize generated database selections, validated AI results and mutation payload
  types. Do not spend a whole phase mechanically changing harmless catch annotations.

### CQ-12 — P2: Image deduplication runs after expensive work

- Evidence: `server/api/upload.ts` normalizes/converts and calls `analyzeImage`
  before `hashMedia` / tenant-owned existing-asset lookup.
- Investigate reuse of validated/moderated existing content before repeated provider
  calls and conversion. Existing provenance metadata alone is not proof of a current
  moderation verdict; define what evidence can safely be reused.
- Preserve archived/purged behavior, source and delivery URLs, ownership and rights;
  test cross-tenant same-hash isolation and retries.

## Retained systems and false positives

- Advertising is retained by explicit user decision. Review consistency of the halted
  state across frontend policy, scheduled GAM ingestion and configuration without
  deleting the subsystem or re-enabling it.
- `useCurrency.ts` exports the used `useCurrencyRate`; `useAdSense.ts` exports the
  used `useAdSenseStatus`. Filename-only dead-code searches gave false positives.
- Editor workspace/history/preview and dashboard charts already use lazy components.
  Do not claim they need initial lazy loading or promise chunk savings from file splits.
- Source Serif is imported from CSS; MDI icons and native Takumi dependencies may be
  loaded by modules/platform resolution. Literal TypeScript imports are insufficient
  evidence to remove dependencies.
- Security checks repeated at distinct trust boundaries are not redundant by default.

## Verification recorded for the initial pass

- `bun run lint`: passed.
- `bun run typecheck`: passed.
- Targeted Vitest: 5 files / 43 tests passed (`externalApi`, `adRevenue`,
  `mediaRights`, `faviconUpload`, LinkedIn `oauthState`). These are existing tests,
  not reproductions of every finding above.
- `git diff --check`: passed before audit documentation was added.
- No full test suite, production build, live-provider checks, production operations,
  or browser measurements were performed for the initial pass.

## Implementation order and acceptance criteria

1. Fix access control, transaction integrity and stale async results with regressions.
2. Establish shared metrics/upload/tag contracts; remove confirmed unreferenced code.
3. Optimize expensive upload work and bounded background execution.
4. Refactor editor orchestration and reuse only genuinely shared projections/behavior.
5. Measure production chunks, requests, query counts and resource usage before and
   after performance changes. Splitting source files is not itself bundle splitting.
6. Run proportionate focused tests during changes, then repository release gates:
   generation, lint, formatting, OpenAPI, typecheck, full Vitest with dedicated test
   PostgreSQL, Linux production build and relevant compiled release/browser smoke.
7. Review deployment configuration, restore evidence, task replica assumptions and
   live integration smoke separately with explicit authorization. A code cleanup
   cannot certify external infrastructure as production ready.

## Continuation coverage

The following sections are extended during the second pass. Confirmed code findings,
static risks requiring reproduction, and operational verification gaps must stay
distinguishable. Do not count repeated evidence as separate defects.

### CQ-13 — P1: Public-network guard misses hexadecimal IPv4-mapped IPv6

- Confirmed by a temporary offline Vitest probe against the actual exported
  `assertPublicHttpsUrl` in `server/utils/images/publicFetch.ts`.
- `blockedIpv6` recognizes `::ffff:127.0.0.1` but only extracts dotted IPv4.
  Mocked DNS answers `::ffff:7f00:1` (loopback) and `::ffff:a9fe:a9fe`
  (169.254.169.254) were accepted instead of rejected.
- Probe result: two expected security assertions failed; dotted-form control passed.
  The existing 12 publicFetch tests passed. No DNS/network requests were made.
  The initial probe setup had a mock-export error, corrected before this result.
  The temporary test was removed after recording evidence; production code is unchanged.
- Impact: shared guard is used for media fetches, knowledge extraction/feeds and
  webhook validation/delivery. DNS pinning is already implemented and must stay.
  This demonstrates address-classification bypass, not an end-to-end production exploit.
- Remediation: parse and normalize address representations before classification,
  including mapped IPv4; explicitly cover non-public IPv4/IPv6 ranges. Check whether
  an existing installed primitive suffices before proposing a dependency.
- Regression matrix: mapped private/loopback/link-local in dotted and hex form,
  IPv6 loopback/ULA/link-local/multicast, public IPv4/IPv6, mixed DNS answers,
  redirects, rebinding, and bounded compressed-body streaming.

### CQ-14 — P1: Sentiment processing lacks claims and bounded concurrency

- Evidence: `server/tasks/sentiment-analysis.ts` selects up to 175 PENDING rows and
  immediately starts all `detectSentiment` calls through `Promise.allSettled`.
  No row claim/lease separates selection from paid provider work.
- Two overlapping runs can process/pay for the same comment. Monitoring run IDs
  in `server/utils/monitoring.ts` protect status reporting, not execution exclusion.
- Remediation: bounded provider concurrency, atomic claims with recovery and fenced
  completion, and rechecking deletion/eligibility before committing results.
- `server/utils/ai/sentiment.ts` has no application-level abort deadline. Add an
  appropriate deadline as part of claim/retry design rather than isolated timers.
- Tests: two workers claiming the same row, crash/lease recovery, concurrency peak,
  deleted comments and partial provider failures. Do not remove cost telemetry.

### CQ-15 — P1: Community insights bypass active feature/deletion filters

- Evidence: `server/tasks/community-insights.ts` selects sites only by PREMIUM/CUSTOM
  plan, without `deletedAt` or the existing active AI/SENTIMENT feature filter.
  Its comments query also lacks a deleted-comment filter. `sites.map` starts every
  tenant's work concurrently, with no per-run tenant bound or daily claim.
- `server/tasks/sentiment-analysis.ts` already demonstrates `activeFeatureFilter`.
- Remediation: agree the insight eligibility policy, use the existing active feature
  primitive, exclude deleted comments/sites, and bound/claim the expensive runs.
- Tests: disabled features, deleted tenant/comment, insufficient data, two replicas,
  tenant fairness, bounded provider calls. Treat the paid-work risk as P1; actual
  production spend was not inspected.

### CQ-16 — P2: Community insight state and reporting can drift

- Same task selects seven days of comments, but tells the model the count is for 24h.
- Trend checks `prevInsight?.avgScore` by truthiness, so a valid zero baseline is lost.
- Error payload embeds `previous: site.communityInsight`; repeated failures nest
  earlier errors and copies of the previous result without a bound.
- The insufficient-comments branch writes `communityInsight: undefined`, which is
  not an explicit JSON clear. Verify the generated ORM contract before assuming
  this removes an old report; test the intended retention/clear behavior.
- `insightSchema` allows a 400-character summary while the prompt mandates 250.
- Remediation: explicit typed last-success/error state, bounded failure metadata,
  one reporting-period/summary contract, and numeric zero-safe trend calculation.

### CQ-17 — P1: PDF export has no explicit work/image bounds

- Evidence: `server/api/articles/export-pdf.post.ts` accepts an unbounded ids array
  and loads matching article content. Its CDN image fetch uses `$fetch`/Blob with no
  explicit deadline or byte bound. Authorization and same-tenant restrictions exist.
- Remediation: validated bounded/deduplicated selection, explicit export workload
  limits/rate limiting, image timeout and maximum bytes, disconnect/error handling.
  Keep the trusted CDN restriction; do not introduce unrestricted URL fetching.
- Resource exhaustion is a static risk, not a measured production incident.
- The server's regex `stripHtml` duplicates a browser DOM conversion in
  `app/composables/useExport.ts`, while shared article text primitives already exist.
  Reuse a defined text contract while preserving paragraph breaks and entity decoding.
- PDF dates are hardcoded to `cs-CZ`; use the request/product locale contract.

### CQ-18 — P2: CSV escaping does not neutralize spreadsheet formulas

- Evidence: `app/composables/useExport.ts::escapeCsv` only quotes delimiters/quotes.
  A user-controlled title such as `=1+1` remains a formula cell when opened by
  spreadsheet software; ordinary CSV quoting is not formula neutralization.
- Remediation: a tested spreadsheet-safe cell policy for user text and leading
  formula/control characters, with a deliberate compatibility decision for exports.
- No payloads were opened or executed in a spreadsheet. This is a static export
  safety finding; no remote exploit or production compromise is asserted.

### CQ-19 — P1 investigation: Knowledge feed writes are not fenced to the claim

- Evidence: `server/utils/knowledge/indexing.ts` claims PROCESSING work. The document
  branch guards completion by id/version/status; feed `syncFeed`, `embedProducts`
  and final success/error updates instead write by source id without claim ownership.
  A heartbeat updates `updatedAt`, but is not an ownership token.
- Source metadata can change during a run; `knowledge/[id].patch.ts` permits title
  edits without reindexing, although document chunks are built using source.title.
- Before implementation, reproduce overlapping/stale feed execution and title-only
  changes against isolated test PostgreSQL. Do not present data corruption as proven.
- Remediation candidate: common lease/version fencing for both document and feed
  paths, product commits and cleanup; define which metadata changes require a new
  embedding version. Keep resumable embedding batches and unchanged-product reuse.
- Related check: two different feeds of one tenant can each read the same remaining
  product quota before upserting. Verify quota enforcement under concurrent syncs.

### CQ-20 — P2: Media garbage collection bypasses task monitoring

- Confirmed mismatch: `shared/utils/operations.ts` lists `media-gc` among monitored
  tasks, but `server/tasks/media-gc.ts` alone uses `defineTask`, not
  `defineMonitoredTask`. It cannot persist the task status through that wrapper.
- Caught purge failures increment neither a failed counter nor the returned result.
- Remediation: existing monitoring wrapper, explicit safe counters and failure
  reporting. Preserve archive-first behavior, grace period and reference rechecks.
- Separate high-risk follow-up: exercise restore/new-reference versus purge races
  and legacy shared storage ownership. Prefix allowlisting alone is not proof of
  tenant-specific ownership. Do not delete or migrate assets during the audit.

### CQ-21 — P2 investigation: Cache misses duplicate loaders

- `server/utils/cache.ts::cached` performs get -> loader -> set independently for
  each request. Simultaneous misses can issue the same expensive DB work repeatedly.
- Confirm impact with a request/query-count benchmark on public feed/author routes.
  A small per-process in-flight map may help; any cross-instance coordination needs
  separate justification and must not share request-user data or rejected promises.
- Also test a public write racing a cache miss; retain generation-based invalidation
  and bounded TTL. Do not cache personalized fields to improve hit rate.

### CQ-22 — P2: LinkedIn create retry can repeat an accepted publication

- Evidence: `server/utils/linkedin/api.ts::createPost` retries every thrown error up
  to three times. That includes an accepted response missing `x-restli-id`, and a
  lost response after provider acceptance. Each attempt sends another POST.
- The same module's native fetch calls have no explicit application deadline.
- `linkedin/publisher.ts` must be considered together with provider-side ambiguity;
  a local publication claim cannot prove a timed-out remote POST was not accepted.
- Remediation: explicit retry classes/deadlines, pending/unknown outcome recovery
  and reconciliation where the provider permits it. Never blindly retry all errors.
- Tests: permanent 4xx, 429/5xx policy, accepted-without-ID, interrupted response and
  one local claim across concurrent publishers. No live publications were made.

### CQ-23 — P2: Documentation has conflicting current-state claims

- `MAP.md` still describes cache as Upstash HTTP/REST, but `server/utils/cache.ts`
  implements ioredis over `REDIS_URL`; another MAP section says cache is unprovisioned.
  Runtime availability must be checked separately, not inferred from either sentence.
- MAP's gaps section says eight crons, while the current scheduler and monitored
  interval registry contain substantially more. Some important tasks already have
  claims/advisory locks; do not report all tasks as unprotected or all as protected.
- Repository agent instructions list Czech/English, while README, CLAUDE, shared
  language types and actual locale files support en/cs/de/fr. Record and resolve this
  authority conflict explicitly; do not remove languages as cleanup.
- `PRODUCTION_AUDIT.md` preserves older release assumptions; current Docker
  entrypoint and production-workflows document apply migrations at startup. Keep
  historical evidence but label historical versus current rollout accurately.
- Remediation: reconcile documentation after behavior fixes, with one authoritative
  workflow and clearly identified dated audit evidence.

## Second-pass coverage and remaining verification

This table records the gaps at audit time. Current results and remaining acceptance
work are in the plan's execution record; this is not a current list of unexecuted tests.

| Area                         | Evidence reviewed                                                                                                           | Remaining before claiming readiness                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Auth and tenant boundaries   | request auth/tenant helpers, enhanced vs raw clients, integration tickets, draft routes                                     | anonymous/tenant regression probes, independent security review                      |
| Billing and article balances | Stripe checkout/subscription/webhook paths, credit wallet locks/idempotency, historical audit                               | concurrent DB tests and authorized provider sandbox smoke                            |
| Background work              | monitoring wrapper, scheduler, sentiment/community, visibility claims, knowledge indexing/refresh, webhook claims, media GC | overlapping-worker and recovery tests on isolated PostgreSQL                         |
| Network/content              | pinned DNS fetch, streaming bounds, sanitizer entry points, knowledge/webhook consumers                                     | expanded address classification regression matrix; no live attack testing            |
| Client state                 | auth signout, optimistic reactions, tracking consent, media-rights async state, editor bindings                             | controlled stale-response tests and targeted compiled browser scenarios              |
| Exports/media                | CSV/PDF conversion, upload ordering/limits, media lookup/reference/purge paths                                              | safe CSV cases, export budgets, purge concurrency and rights-preserving upload reuse |
| Cache/performance            | cache wrapper, rate-limit fallback, client invalidator, existing lazy components and prior CWV audit                        | reproducible before/after bundle, query and memory measurements                      |
| Delivery/docs                | Dockerfile/entrypoint, operation docs, prior audit evidence, language/config declarations                                   | current Linux image/release smoke and operator-controlled infrastructure checks      |

This coverage is selective manual review plus broad static discovery, not a statement
that every route, query, UI state or line has been certified. Remaining tests are
explicit implementation/release acceptance work, not hidden successful checks.

## Coordinated implementation batches

- **A — trust boundaries:** CQ-01 and CQ-13, with offline/isolated security regressions.
- **B — state integrity:** CQ-02, CQ-03, CQ-19 investigation and CQ-22 publication
  ambiguity; establish transaction/claim/version rules before moving code around.
- **C — paid/background efficiency:** CQ-12, CQ-14, CQ-15, CQ-16 and CQ-20. Reuse
  existing claim/concurrency/monitoring patterns, not a new generic job framework.
- **D — shared contracts and cleanup:** CQ-04 through CQ-09, then CQ-11 and export
  contracts CQ-17/CQ-18. Keep migrations, ad systems and security boundaries intact.
- **E — UI and measured performance:** CQ-10, measured CQ-21, selective media-picker
  lazy loading only after confirming chunk impact. Preserve responsive/SSR behavior.
- **F — readiness evidence:** CQ-23 docs reconciliation, complete release gates,
  restore/upgrade rehearsal and explicitly authorized integration/production smoke.

These batches originally recorded the dependency order for a later implementation
task. The user has since authorized local execution under the acceptance plan, with
individually reviewable changes and verification between them. Publishing and production
operations still require the repository's explicit authorization.

## Second-pass verification log (historical)

- Existing targeted Vitest: **8 files / 68 tests passed**. Targets: publicFetch,
  webhooks, cache, articleTracking, articleOptimizationReactive, visibilityMonitoring,
  Stripe webhookSignature and operations. These results do not invalidate the gaps
  in cases that the current tests do not exercise.
- Temporary offline address-classification probe: **2 expected regression failures,
  1 passing control**; the existing publicFetch suite passed alongside it. The probe
  was removed, and no failing temporary tests remain in the repository.
- Documentation formatting was checked and the new audit document was formatted.
- That audit pass did not rerun generation, lint/typecheck, the full database suite,
  production build or browser matrix: its changes were documentation only, and
  implementation was deferred at that time. Later implementation and verification
  are recorded in the authorized plan's execution record.
- No provider calls, emails, publications, database migrations, data deletions,
  infrastructure changes, commits or pushes were performed.

## Whole-repository pass (2026-10-22)

The user requested coverage of the entire codebase, not only the initially selected
subsystems. A per-file inventory is available in
[`docs/audits/2026-10-22-codebase-inventory.csv`](./docs/audits/2026-10-22-codebase-inventory.csv).
It covers **all 1,675 Git-tracked paths** at this pass; existing uncommitted changes
to tracked files were read as they stood. New untracked audit documents are additional
deliverables, not included in that fixed denominator.

| Inspection performed                                                                                         |     Files |
| ------------------------------------------------------------------------------------------------------------ | --------: |
| TypeScript/JavaScript AST syntax parsing and pattern scan                                                    |     1,067 |
| Vue SFC/template parsing, script AST and pattern scan                                                        |       274 |
| JSON parsing and pattern scan                                                                                |        89 |
| TypeScript JSONC configuration parsing                                                                       |         1 |
| SQL migration content/pattern scan, without execution                                                        |       120 |
| Other text content/pattern scan (schemas, PHP, email templates, docs, scripts, configuration)                |        67 |
| Metadata only (binary assets/fonts, hidden local-tool metadata, lock/env example and other excluded formats) |        57 |
| **Total**                                                                                                    | **1,675** |

The inventory records the inspection method, text line/byte counts, a SHA-256 prefix
for inspected content and counts of selected review indicators. Indicator counts
are **not findings**. The machine scan reported no TS/Vue/JSON syntax diagnostics;
the initial strict-JSON false positive for commented tsconfig was corrected by using
the TypeScript JSONC parser. All eight tracked PHP files also passed native syntax
checks. Binary assets and secrets/environment contents were not decoded or printed.

This establishes whole-repository **static coverage**, not manual certification of
every line. Manual reviews trace selected data flows and verify scan candidates;
they do not turn filename matching, passing syntax or passing tests into security
proof. No trustworthy percentage of removable code can be derived from these counts.

Root inventory: app 358; server 498; tests 378; prisma 147 (including 120 SQL files);
shared 78; i18n 81; scripts 13; WordPress 11; extensions 8; emails 12; public 36;
types 4; other root/documentation/tool files 51. The CSV is authoritative for paths.

### CQ-24 — P1: Nullable identity columns do not provide the intended uniqueness

- Evidence: `prisma/models/article.zmodel` declares compound uniqueness for
  ArticleReaction/ArticleFeedback `(articleId,userId,sessionId)` and ArticleShare
  `(articleId,platform,userId,sessionId)`. Both identity columns are nullable, and
  handlers intentionally fill only one identity. Historical migrations create
  ordinary unique indexes; no later partial or NULLS NOT DISTINCT fix was found.
- Ordinary PostgreSQL uniqueness treats null values as distinct. Concurrent requests
  can pass a findFirst-before-create gate and both insert the same logical identity;
  the share handler's unique-violation recovery does not supply the missing invariant.
- Remediation: choose separate partial unique indexes or a compatible normalized
  identity design, audit existing duplicates with dry-run-first tooling, and keep
  authored model/migration/generated contracts aligned. Never delete rows blindly.
- Tests: actual isolated PostgreSQL concurrency for signed-in and anonymous reaction,
  feedback and per-platform share; assert one logical row and one counted share.
- This is schema/handler evidence, not a production duplicate-count measurement.

### CQ-25 — P1: Comment creation does not check article publication/deletion

- Evidence: `server/api/comments/index.post.ts` uses the raw client to find an article
  by id, checks comment switches and bans, then creates the comment. It does not
  enforce article visibility, article deletion or tenant deletion before writing.
- Temporary offline probes against the real handler with mocked persistence returned
  success for a reader on both a draft and a soft-deleted published article. Two
  expected rejection assertions failed; all five existing createReply tests passed.
  No real DB or mail provider was used; the probe was removed after recording results.
- Remediation: one reader-visible article predicate/access boundary before creation,
  preserving intentional author/admin preview behavior only where authorized; check
  parent visibility/deletion too. Do not equate a known article id with read access.
- Permanent regressions should cover draft/archived/future/deleted article, deleted
  tenant, accessible published article, disabled comments, bans and parent isolation.

### CQ-26 — P1: Emoji reaction creation does not bind references to one publication

- Evidence: `server/api/emojis/reaction.post.ts` accepts commentId/emojiId, checks
  only session presence, and creates through the enhanced client without loading
  the target comment or emoji. `EmojiReaction` create policy in
  `prisma/models/comment.zmodel` checks only authenticated presence, not tenant
  equality, comment deletion or parent article visibility.
- Remediation: validate a reader-visible target and same-tenant emoji; explicitly
  define behavior for banned readers and disabled comments. Reuse domain access
  checks, not a new broad reaction service. Keep the actor id server-owned.
- Tests: foreign-tenant emoji, deleted/hidden comment, nonexistent ids, normal toggle
  and concurrent create. This has static policy/handler evidence, not a live exploit.

### CQ-27 — P2: Comment reporting has no duplicate/abuse budget

- Evidence: `server/api/notifications/index.post.ts` accepts an authenticated user's
  commentId, reads the raw comment, then fans out moderator notifications. Repeating
  the request creates another set; no report-specific identity/tenant budget or
  duplicate suppression is present. Target visibility/deletion is not checked.
- Remediation: validate readable target and rate-limit/deduplicate reports with the
  existing infrastructure. Keep genuine repeated abuse reportable by other readers.
- Tests: repeat report, independent reporter, inaccessible comment and large audience.

### CQ-28 — P1: Ancillary failures can turn committed social mutations into errors

- Evidence: comment creation awaits audience lookup/notification creation after the
  comment is saved. Follow creation awaits notification creation after the follow
  exists. Article reaction creation also awaits notification creation after saving
  the reaction. A failure in the latter operation fails the request after persistence.
- Client retry can produce duplicate comments, misleading follow conflicts or a
  reaction toggle that reverses the action the user was trying to repeat.
- Remediation: classify required atomic records versus ancillary notification work.
  Use an existing transaction/outbox pattern where required, or report bounded
  best-effort failures without returning a false failure for the committed result.
  Apply retry/idempotency deliberately; do not blanket-swallow all database errors.
- Related account/moderation routes that send email after writes need the same review.
- Tests: injected post-write failure and retry, with persisted result and notification
  behavior asserted independently.

### CQ-29 — P2: Comment thread work is unbounded despite root pagination

- Evidence: `server/api/comments/[id]/index.get.ts` caps root count at five but fetches
  all descendant levels without a total reply budget. DTO recursion repeatedly calls
  `replies.filter` over the entire reply list for every node. Like sorting loads all
  root ids/counts into memory before selecting the page.
- Remediation: parent->children indexing for linear shaping, defined deep/large-thread
  behavior and bounded retrieval; preserve direct permalink and deleted-parent context.
  Move ranking to the DB if a measured workload warrants it, preserving stable order.
- Tests/measurement: broad and deeply nested synthetic threads, permalink consistency,
  query counts, response-size/time budget and stack depth. No production latency
  regression is claimed from source shape alone.

### CQ-30 — P2: Related metadata/translation writes omit public feed invalidation

- Evidence: tag PATCH/DELETE routes have no invalidateFeed call; cached article feeds
  contain tag data. Manual translation PATCH/DELETE and translation POST paths also
  omit it, while localizeArticles overlays published translation data into cached feeds.
  `announceArticle` only handles IndexNow, not feed invalidation.
- The scheduled translation task already invalidates on publication; series mutations
  already invalidate. Use those existing conventions rather than a second cache layer.
- Remediation: invalidate the tenant's affected public views after successful relevant
  writes, including removal/unpublishing and replacement of a previously published
  translation. Include author-summary invalidation only where its data really changes.
- Tests: warm cache -> rename/delete tag or publish/unpublish/delete translation ->
  next read reflects the write with cache enabled, without waiting ten-minute TTL.

### CQ-31 — P1: Alternative translation writes bypass optimistic conflict protection

- Evidence: `translations/[id]/index.patch.ts` correctly requires expectedUpdatedAt
  and performs a compare-and-swap update. But `articles/[id]/translations.post.ts`
  upserts the existing language without a version, and `translate.post.ts` performs
  a long model call followed by an unconditional upsert of that same language.
- Either path can overwrite a newer human translation; both reset status to READY,
  even when replacing a previously PUBLISHED row. Model-call latency widens the race.
- Remediation: distinguish create from replacement; require an observed version and
  explicit regeneration intent, recheck after remote work, and enforce publication
  capability for transitions that remove live content. Preserve the author's draft.
- Tests: POST against an existing row, concurrent human edit during AI generation,
  published-row replacement, insufficient publish scope and unchanged successful path.

### CQ-32 — P2: WordPress sync has no hard-crash lock recovery

- Evidence: `wordpress/topiqu-sync/includes/class-topiqu-sync.php` creates a persistent
  option lock. Finally/shutdown cleanup covers normal PHP termination, but a killed
  process/container cannot run it. The lock has no lease/owner-liveness recovery and
  the next run only refuses it; deactivation does not clear it either.
- Remediation: recoverable ownership/heartbeat or an operator-visible guarded unlock.
  A naive short TTL would reintroduce overlapping active workers and is not enough.
- Tests: preexisting abandoned lock, live long sync, ownership-safe cleanup and recovery.
  Existing standalone tests cover refusal and normal cleanup, not process death.

### CQ-33 — P1 investigation: WordPress imports are not namespaced by source

- Evidence: post lookup and reconcile_missing use only `_topiqu_article_id`; no
  source/tenant identifier is stored or filtered. Admin settings can change API URL
  and key, but reconciliation still ranges across all previously imported posts.
- After switching to another publication, a complete scan can move old-source posts
  to draft under the default missing_action even though the new scan says nothing
  about their original source. The current API site metadata is not pinned by sync.
- Remediation: source-scoped identity/reconciliation plus an explicit source-switch
  workflow. Decide legacy source association without destructive guessing.
- Reproduce in isolated WordPress with two synthetic publications before designing
  migration/cleanup; no real WordPress posts were changed during this audit.

### CQ-34 — P2: WordPress complete scans use quadratic membership work

- Evidence: the same sync repeatedly uses `in_array` over a growing remote_ids list
  for duplicate detection and again for every imported post during reconciliation.
  `get_posts(numberposts => -1)` loads all imported ids, and a run scans every page.
- Remediation: associative-set membership and bounded/batched local reconciliation.
  Keep the complete/error-free snapshot condition that prevents accidental drafting.
  Incremental cursors require an actual API contract, not inferred timestamps.
- Benchmark large synthetic imports; preserve updates, safe-mode conflicts and missing
  article behavior. Do not remove the plugin or replace native WordPress posts.

### CQ-35 — P2: Emoji upload calls moderation before local size/format rejection

- Evidence: `server/api/emojis/index.post.ts` calls analyzeImage(file.data) before
  prepareEmojiImage enforces the 5 MiB limit and decodes supported image formats.
  A client-supplied image MIME prefix alone passes the earlier local check.
- Remediation: cheap bounded validation/decoding first, then moderation with an
  appropriate normalized representation. Combine with CQ-08/CQ-12 without weakening
  animated emoji behavior, actual moderation or rollback cleanup.
- Tests: oversize/spoofed MIME invokes no provider, valid animation and moderation deny.

### CQ-36 — P2: Email verification issuance has duplicate paths and races

- Evidence: `users/send-verification.post.ts` rotates code and sends email without
  the `shouldIssueVerificationCode` cooldown used by auth/resend-verification.
  Both paths perform separate deleteMany/create writes on the user-unique row.
- Concurrent requests can invalidate each other's freshly emailed code, conflict
  on the unique row or send unnecessary email. The generic/global HTTP budget is
  not the same as an atomic per-account issuance/cooldown contract.
- Remediation: share issuance policy with transactional/guarded rotation and an
  account/IP budget. Keep the anti-enumeration response contract of the public route.
- Tests: cooldown on both entry points, parallel resend, mail failure, expiry and
  one-time use. Do not silently redesign the entire auth flow as a DRY exercise.

### CQ-37 — P2: Media library fetch is not reused across SSR hydration

- Evidence: `app/components/Media/Library.vue` runs `await fetchFirst()` in setup
  using useRequestFetch. `app/pages/admin/media.vue` renders it during SSR. This
  path does not use useAsyncData/useFetch payload reuse or a query-cache load.
- Remediation: stable tenant/filter-keyed SSR data loading that reuses the initial
  payload, while preserving explicit fresh reload after mutation and existing
  requestVersion protection. Do not put privileged library data in a public cache.
- Verify with SSR/hydration request counts and filter/page changes before claiming
  bandwidth/latency savings. This is source evidence, not a measured browser trace.

### CQ-38 — P2: Poll backfill is dry-run-first but not bounded

- Evidence: `scripts/backfill-polls.ts` loads all matching articles with their full
  content in one query and filters them in memory. Other backfill scripts already
  demonstrate cursor batching (`backfill-generation-word-counts.ts`, 200 rows).
- Remediation: reuse bounded cursor/batch iteration and clear progress/target summary;
  preserve dry-run default and explicit apply authorization. Validate rerun/idempotence.
- No backfill or production data read was executed during this audit.

### CQ-39 — P2: Remaining remote reads lack explicit application deadlines

- Evidence: Search Console token/API reads, CNB rate loading, Giphy proxy, geo lookup
  and Turnstile verification use fetch/$fetch without a local explicit timeout.
  This complements CQ-22's higher-risk publication retry semantics; these reads do
  not all need the same retry policy or error behavior.
- Remediation: explicit per-operation deadlines and bounded retries with existing
  fetch options, safe reporting and documented fallbacks. Preserve fail-closed
  verification and configured optional-service semantics.
- Tests: stalled upstream, timeout, fallback/cache behavior and cancellation. No new
  network client framework, provider service or dependency is justified by this alone.

### CQ-40 — P1: Generated image keys can collide between concurrent articles

- Evidence: `server/utils/ai/image.ts` uses prefix + Date.now() + optional slot suffix
  for a shared article-images storage key. `finalizeArticle` uses the same prefix
  across tenants; cover generation has no distinguishing suffix. putToCdn sends a
  normal PutObject without create-only preconditions and sets an immutable cache TTL.
- Two completions in the same millisecond/slot can address the same object, replacing
  bytes behind an existing immutable URL. No production collision was measured.
- Remediation: server-generated collision-resistant identity and appropriate ownership
  namespace, preserving media registration/provenance and immutable URL semantics.
  Existing avatar/upload UUID patterns are a precedent. Do not rename historical keys.
- Tests: fixed clock with concurrent generated results yields distinct keys, tenant
  ownership survives registration and no result overwrites another's stored object.

## Whole-repository verification and shared-tree limitations

- `bun run zenstack:generate`: passed; no database operation. Generated output remains
  ignored; authored schemas were not changed.
- `bun run lint`, `bun run typecheck`, `bun run openapi:check`: passed on the shared
  working tree during this pass. Typecheck ran before regeneration; no authored schema
  changed, but these are separate observations, not a post-refactor release certificate.
- Complete Vitest run with **TEST_DATABASE_URL, AI_EVAL and DATAFORSEO_EVAL explicitly
  empty**: **340 files passed, 18 skipped; 2,570 tests passed, 92 skipped**. Database
  integrations and live paid evals were intentionally disabled, not claimed as passed.
- Separate focused locale/WordPress/toolchain run: **5 files / 36 tests passed**.
- PHP syntax: **8/8 passed**. Standalone `php tests/server/wordpress-safety.php`:
  **20 assertions passed**, using in-memory stubs and synthetic responses only.
  `sh -n scripts/docker-entrypoint.sh`: passed; the entrypoint was not executed.
- Temporary comment-visibility probe: **two expected regression failures**; five
  existing reply tests passed alongside it. Probe removed; no failing audit tests
  are left behind. Permanent regressions belong with the later implementation.
- No Docker build, live browser matrix, database migration, provider call, image upload,
  real WordPress mutation, production scan, commit, push or deployment was performed.
- Existing navigation/style/layout/locale/sidebar-test changes were present at turn
  start and belong to other work. They were not edited or reverted for this audit.
  Audit deliverables are this report and the inventory; README's audit link came from
  the preceding pass. Snapshot hashes make scanned tracked content identifiable.

The remediation batches above now also include CQ-24/25/26/31/40 in trust/state
integrity work, CQ-27/28/29/30/35/36/37/39 in related domain behavior and measured
efficiency work, and CQ-32/33/34/38 in integration/maintenance hardening. Database
invariants require real reviewed migrations; runtime and external readiness still
require the explicitly listed integration, upgrade, restore and deployment checks.

## Findings discovered during implementation verification

These findings concern the updated dependency/runtime combination; the original
40 findings above remain the historical baseline.

### CQ-41 — P1: IPX's legacy Node bridge loses headers under Nitro/Bun

- Compiled release smoke reproduced a missing dynamically required `srvx/node`
  adapter, then a 200 image response with `application/octet-stream` instead of
  WebP after explicitly tracing that adapter. The legacy Node response bridge
  loses MIME/cache/ETag semantics in Nitro's simulated Node response.
- An authored public-IPX Fetch/H3 boundary passes real Sharp/header/304/HEAD and
  host/path restrictions. The build hook now recognizes Nuxt Image's extensionless
  legacy handler as well as its `.js` form; an installed-module integration test
  verifies the selected production route.
- Actual Linux/Bun image transforms, MIME/cache/CSP/ETag/304 and remote-host denial
  passed, together with all five unchanged compiled release-smoke cases.

### CQ-42 — P1: Nitro's Bun entry does not handle container shutdown

- The actual native Linux container required Docker's forced kill after its
  default ten-second stop grace: exit137, OOMKilled=false. The installed upstream
  Bun entry has no signal lifecycle and does not call Nitro close hooks.
- The authored Bun-only entry drains HTTP/tracked tasks/`waitUntil`, stops future
  cron ticks, and awaits all close hooks under one default eight-second deadline.
  It closes the shared ORM pool and Redis, with nonzero failure/deadline exits.
- Five real Linux/Bun signal/stream/deadline cases passed. Two compiled containers
  subsequently stopped with exit0 in0.325s/0.163s; the isolated resource database
  had zero remaining application connections. Direct platform `waitUntil` tracking
  also has a real H3 transport regression for earlier response-hook rejection.

### CQ-43 — P1: Unique MediaLibrary AsyncData keys retain destroyed editors

- The unchanged100-cycle browser policy found one destroyed Editor retained per
  mount: warm median8 to tail median100, liveEditors0. Post-GC heap grew about
  91MB to761MB, together with DOM nodes, listeners and detached nodes.
- A separate five-cycle probe without per-cycle CDP sampling still retained all
  five destroyed Editors. A private synthetic heap snapshot traced a strong root
  through Nuxt's global `_asyncData` entry, the per-instance media-library key,
  its `_off` closure/context and the Vue component tree. This is independently
  reproducible retention, not a threshold adjustment or only test instrumentation.
- Local request/cache ownership now releases component callbacks on scope disposal.
  Independent picker filters, cancellation, SSR/client behavior and tenant isolation
  have focused regressions. Acceptance needs
  new retainer evidence and the same100-cycle bounds; clearing only the editor ref
  does not establish that the retained component tree was released.
  Those unchanged compiled 100-cycle bounds subsequently passed on the patched
  ac902 ARM64 checkpoint recorded under CQ-47.
- Additional real-clock retaining paths identified component-owned callbacks in
  revision AsyncData, default factories, follow requests and Colada tag options.
  Their cache callbacks now live outside component setup scopes; feed callbacks
  have explicit disposal and reactive caller getters stop with the component scope.
- Instrumentation also retained Playwright clock scheduling stacks and file-chooser
  ElementHandles. A20-cycle snapshot found exactly20 detached chooser inputs rooted
  directly in DevTools global handles. The harness now uses native clocks and
  uses File/DataTransfer assignment and disposes each chooser handle, avoiding a
  Playwright1.64.1 internal setFiles handle leak. Workload and limits are preserved.

### CQ-44 — P1: Public article representations bypass publication timing

- PostgreSQL regressions reproduced scheduled/deleted article exposure through the
  related shelf and source/translated-slug lookup:9 failures in11 cases before repair.
- The related route now checks the shared article access rule and filters public
  candidates before ranking/limiting. All11 PostgreSQL cases passed after repair,
  including tenant isolation, owner previews and published translation overlays.
- A follow-up trace found corresponding missing filters in public discovery/export
  representations. The shared public predicate now covers RSS/sitemap/llms, Markdown,
  author/tag lists and legacy/v1 exports; author cache payloads use a new namespace.
  All28 collection/detail PostgreSQL cases passed after22 genuine failures before repair.
- Authenticated tag-ID reads formerly returned complete Article rows. They now preserve
  reader-visible body/card data and administrative previews through an explicit safe
  selection. The combined related/collections/tag-ID run passed44 PostgreSQL cases;
  the additional global-tag regression also passed (six tag-ID cases total).

### CQ-45 — P1: Request intake buffers bodies before enforcing byte limits

- Nitro's inherited Bun adapter reads the entire body before application middleware.
  The native limit was implicit, while the header-based middleware omitted PATCH.
- Its default8,000,000-byte multipart limit also conflicts with supported15MiB images
  and10MiB avatars/knowledge uploads. Specialized route validation remains necessary.
- The production Bun boundary now counts streamed bytes, enforcing an inclusive
  2,000,000-byte ordinary cap and16MiB multipart cap before application dispatch.
  Middleware limits align; the multipart media-type token is normalized without
  altering boundary parameters or signed body bytes.
- All48 focused boundary/lifecycle/config cases passed. Eight additional actual
  Linux/Bun1.4.4 HTTP cases passed: exact limits, supported image plus envelope,
  POST/PATCH/chunked rejection and an aborted upload with zero active readers left.
  The final ARM64 image `ddb1cb4d…31ee` subsequently passed six compiled HTTP
  intake cases.

### CQ-46 — P1: OG resources are read without a response byte limit

- The installed OG module validates DNS/IP addresses, pins the checked socket,
  validates redirects and applies a deadline. Its successful remote asset path
  nevertheless buffers an unbounded response before base64 encoding it; a deadline
  does not bound bytes. Registered tenant media can reach this signed-image path.
- A local stream adapter wraps the installed Node fetch binding, preserving that
  exact transport and its security checks. It rejects declared oversized bodies
  early and counts actual streamed bytes against the inclusive shared15MiB limit,
  including missing or false Content-Length. Cancellation releases the upstream
  reader; the existing module fallback omits the failed image.
- All65 focused cases passed, including installed-module alias registration,
  redirect/private-host behavior, exact bytes, abort and reader/cancel failures.
  No dependency or lockfile patch was added. Full typecheck and lint passed;
  final patched ARM64 binding inspection and native Takumi rendering subsequently
  passed, producing a cached 1200×600 PNG of 312,319 bytes.

### CQ-47 — P1: Unhead retains consumed cleanup closures and removed head tags

- The final ARM64 100-cycle run completed with zero retained Editors, stable 410
  listeners, a passing heap gate, 110 created/revoked object URLs and zero runtime
  errors. It still failed the unchanged DOM gates: approximately 34 DOM nodes and
  68 detached nodes accumulated per cycle. Successful heap/Editor checks did not
  waive that supported-path failure.
- A separate 20-cycle run with one private heap snapshot confirmed an application
  retaining path through `Unhead._dom._p` → cleanup closure/context → previous
  cleanup bags, retaining 360 link and 317 meta elements. Raw synthetic heap content
  remains private.
- The public-API regression in [headCleanup.test.ts](./tests/unit/headCleanup.test.ts)
  reproduced removal callbacks running twice after disposal and a document change
  (expected once). The upstream 3.4.3 version was already the latest registry release
  checked during investigation.
- The narrow [Bun patch](./patches/unhead@3.4.3.patch) deletes each `previous[k]`
  entry after its cleanup callback succeeds. Tests also preserve title/attribute
  replacement and event cleanup. Frozen installation passed with the locked patch;
  head/SEO/release-toolchain regressions passed **3 files / 23 tests**, including a
  second passing run after frozen installation. Docker copies `patches/` before
  installation so the image receives the same fix.
- Private aggregate evidence: `/private/tmp/topiqu-head-cleanup-red-20261023.log`,
  `/private/tmp/topiqu-head-cleanup-green-20261023.log`,
  `/private/tmp/topiqu-head-cleanup-frozen-green-20261023.log` and
  `/private/tmp/topiqu-unhead-frozen-install-20261023.log`.
- The 23 head/SEO/toolchain cases also passed under the normal Nuxt test config
  (44820). Actual ARM64 rebuild 62992 exited 0 and produced
  `sha256:ac902af17786be3b5d7ce0e77973921a7cb13b54b2a92c3f2fa8271dc445e4f6`.
  Fresh native startup verified the Bun revision, UID 1000 and migration entrypoint;
  six compiled body cases and native Takumi rendering/cache passed. Exact-artifact
  inspection passed 24 compiled/policy checks, five ARM64 native ELF checks and all
  seven original asset budgets, including proof that the emitted JS consumes the
  cleanup entries.
- The full repeated canonical 100-cycle run on that image (50712) exited 0 with
  `screen-passed`. Reported warm/tail DOM nodes were 2,935/2,935, listeners 410/410
  and detached nodes 124/124; Editors were zero at every checkpoint. Heap was
  29,994,840 → 32,331,132 bytes and passed the unchanged noise/slope policy.
  Created/revoked object URLs were 110/110, canceled reads 110, and errors,
  unhandled rejections, hydration warnings and forbidden mutations were zero.
- Image `f5074a4f…5518` and the earlier 20-cycle snapshot remain diagnostic evidence
  before the patch; no additional heap dump is required by the narrowed local gate.
  The 100-cycle result remains specific to ac902; the two later changes only added
  accessible labels and a header fallback, without changing lifecycle behavior.
  Final local mobile-wallet/shutdown proof is recorded in the plan. Extra
  locale/tablet/matrix, AMD64, baseline and 75-minute stress work remain deferred.
  These observations do not prove the absence of every possible leak.

## Completed local/ARM64 verification — 2026-10-23

- CQ-01–CQ-47 are implemented. Final ARM64 Docker build 56198 exited 0 and produced
  `sha256:ddb1cb4d7bfea298f278d8ba3e8dc09557510dffca5a5ee8e1ed85bbb6a831ee`.
  All 24 compiled/policy checks, five ARM64 native ELF checks, seven original asset
  budgets and emitted Unhead cleanup checks passed. Native Bun 1.4.4 revision
  `38afee6c84fcf48c0edb2466aa4b27d287a59c30`, UID 1000, 131 migrations,
  six body-intake cases and cached Takumi 1200×600 PNG rendering (312,319 bytes)
  passed. Final shutdown completed in 346 ms, exit 0, OOMKilled=false; an independent
  `pg.Client` observer confirmed zero remaining application database connections.
  Evidence: `/tmp/topiqu-final-local-shutdown-20261023.json` and
  `/tmp/topiqu-final-local-pool-closure-20261023.json`.
- All three final production-workflow cases passed, including the two accessible
  labels repaired in the User/Account avatar and Client/Version wallet.
- All three private-session cases passed in 6.3 seconds: real account A → logout →
  account B/offline isolation, real media-read cancellation on modal/editor SPA
  unmount, and abandoned SSR-editor hydration followed by a valid authenticated page.
  Harness fixes address the seeded localhost tenant, cross-document waits and real
  network aborts. CSS-visible media may trigger its lazy load late within the
  original ten-second bound; no application behavior, deadline or error gate changed.
  Evidence: `/tmp/topiqu-final-local-private-green-20261023.log`.
- All five final release-smoke cases passed in 5.6 seconds, covering SSR/compressed
  assets, IPX headers/304/host restrictions, service-worker private-cache cleanup and
  offline denial, activation asset continuity and signed-in SSR.
  Evidence: `/tmp/topiqu-final-local-release-green-20261023.log`.
- The earlier ac902 critical batch passed 11 of 17 cases: eight core cases, editor
  conflict/history recovery, session revocation and wallet coverage. Final targeted
  repeats supplement this historical result; it is not relabeled as one all-17
  passing run. Two custom-domain cases remain deferred to a TLS-capable fixture
  because HTTP virtual hosts conflict with production CSP
  `upgrade-insecure-requests`; production security is unchanged.
- The existing wallet case passed at 360×800 with touch Chromium: one case in
  2.6 seconds. Evidence:
  `/tmp/topiqu-final-local-mobile-chromium-wallet-20261023.log`. This is a local
  viewport check. Mobile WebKit could not hydrate on the HTTP fixture because
  production CSP upgraded 130 `/_nuxt` requests to HTTPS on the HTTP-only port;
  WebKit/TLS validation is deferred without weakening security.
- All required checks under the agreed local/ARM64 gate are complete. CQ-47's
  passed ac902 100-cycle evidence remains checkpoint-specific. Extra
  four-locale/tablet/browser matrices, AMD64, baseline builds, the 75-minute
  protocol and another heap dump are not required. Production rollout, real
  production-backup recovery, WebKit/TLS, two custom-domain TLS-fixture cases and
  paid-provider checks are outside this goal and not claimed passed.
