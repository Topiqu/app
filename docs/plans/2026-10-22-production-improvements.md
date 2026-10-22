# Production workflow improvements

Approved scope: custom-domain integration OAuth, localized billing returns, article
concurrency protection and revision recovery, account session controls, real-user
performance metrics and budgets, operator visibility, restore verification and
the existing accessibility/E2E backlog.

## Implementation order

1. Keep integration grants separate from login sessions. Confirm the same account
   centrally, bind each single-use grant to its tenant, and recheck permissions on
   provider return. Keep billing destinations same-origin and locale-prefixed.
2. Add backward-compatible article revision/version, session origin and task-status
   storage. Generate the ORM and validate complete migrations on a disposable local DB.
3. Use a database-owned edit version that changes only for editable article fields.
   Reject stale editor saves atomically. Retain the last 50 pre-change snapshots;
   recovering a revision loads a draft and uses the normal validation/save path.
4. Add account-wide revocation of other sessions while retaining the current one,
   origin labels, and clear localized copy for current-domain logout.
5. Emit sampled, consent-gated CWV distributions with only fixed page/device
   categories. Add stable numerical asset budgets and document field p75 targets.
6. Persist bounded task summaries, expose safe queue/service aggregates only to
   superadmins, and provide only reviewed retry operations.
7. Verify backup/restore locally using disposable databases, add an operator runbook,
   and repair genuine accessibility regressions and proven stale browser selectors.

## Verification and rollout

Focused tests first, followed by lint, formatting, OpenAPI, type checking, the full
unit/integration suite and a single production build. Run compiled browser checks
sequentially against a dedicated test database, including release smoke, OAuth
handoffs, session revocation, concurrent editors and restoration. Never run parallel
builds. Production provider configuration and retained production backup restoration
remain human-controlled. Git publication to `dev` and `main` was subsequently authorized;
production provider and database mutations remain outside the local verification.

## Local verification record — 2026-10-22

- Bun 1.4.3 frozen dependency installation passed. ZenStack generation, lint,
  formatting, OpenAPI consistency, type checking and `git diff --check` passed.
- All 120 migrations applied to a newly created, dedicated PostgreSQL 18/pgvector
  test database. The full Vitest run passed 2,635 tests across 352 files; 22 tests
  in six files remained skipped by the configured suite.
- The final Bun production artifact built successfully on macOS ARM64. Its migration
  package contains the exact reviewed SQL. A separate Linux ARM64 Docker image built
  successfully with Bun 1.4.3. Its real entrypoint applied migrations and passed health
  and liveness checks as a non-root user on an isolated Docker network.
- A historical local database clone had 92 distinct applied migrations. A new copy
  was upgraded by that same image to all 120 migrations, with no failed entries.
  The original clone was unchanged. Its age and provenance do not establish that it
  represents current production data. CI also boots the Linux deployment image on a
  separate empty database and checks migrations, Bun version, user and readiness.
- All seven asset budgets passed: entry JS 377,562, publication JS 519,283, article
  JS 550,639, editor-shell JS 490,076, largest JS 126,988, total JS 1,379,456 and
  total CSS 44,722 bytes gzip. CSS includes the emitted SSR inline styles. All seven
  budgets also passed against the Linux image with networking disabled and no database
  credentials. Style evaluation isolates Nitro's CSS graph so it cannot start the server.
- Compiled-server browser checks passed 76 desktop/release scenarios, using English
  and Czech projects. Statistics and the new workflow screens explicitly select
  and assert their requested light/dark mode. The mobile WebKit run passed 27
  scenarios with six deliberate desktop/hover skips. It includes article conflict,
  draft download, reload, history restoration, session revocation, operations and
  wallet scrolling. Browser workers were limited to one; builds ran separately.
- A quiet local dump of the final migrated test database restored into a new,
  retained disposable database. All 13 comparison checks passed, including source
  stability, row counts, migrations, functions, triggers, indexes and extensions.
  No existing database was overwritten or deleted.
- A second dump/restore rehearsal on the upgraded historical copy passed all 13 checks.
  Both verification targets are retained. The full unit suite, lint, formatting,
  OpenAPI and type checks were repeated before publication.

Live LinkedIn/Google consent, Stripe flows, deployed proxy behavior and real-user
p75 values still require operator-controlled production checks. The local restore
does not establish retained/off-site backup recovery or PITR. No production migration,
deployment or provider mutation was performed during local verification. A read-only
provider preflight found a Cloudflare HTTP 401 from this workstation; the VPS-only IP
allowlist needs operator confirmation before interpreting it as a production failure.
