# Production workflows

## Rollout

Deploy migration `20261022010000_production_workflows` before serving the new APIs.
The existing container entrypoint does this automatically; building an image never
changes a database. The migration adds `Article.editVersion`, `ArticleRevision`,
`Session.origin` and `SystemTaskStatus`, plus the article revision trigger. It does
not backfill historical versions, session origins or task results.
Its DDL is transactional. Counter-only updates do not invoke the revision trigger,
so reading an article does not repeatedly serialize its body for history.

The new columns/tables are additive. Older backend replicas can still write articles;
the trigger will archive and version their changes. Optimistic conflict protection
requires the new editor and API together. An older open editor receives HTTP428 for
a content save without a version; download its unsaved draft before reloading.
Rollback of application code does not remove the trigger or undo migrations.
Keep the schema when rolling back to a compatible image; review a forward fix before
changing database functions or deleting revision data.

Use the existing reviewed release process: identify image and database, verify a
separate restore, deploy, then check readiness, tenant isolation, publishing and task
health. No new production credentials are required. Provider tests below still need
real configured accounts and an operator-controlled deployment.

Release CI also boots the built Linux image against a separate empty test database.
It checks migration startup, non-root execution, the pinned Bun version, readiness and
liveness before the browser scenarios. This does not replace verifying an upgrade
against a recent production backup in an isolated environment.

## Integration connection smoke checks

Keep `AUTH_ORIGIN` at the central auth origin. LinkedIn's configured redirect URI
(`APP_URL`-derived) and Search Console's configured redirect URI must have that same
origin. An inconsistent configuration fails closed instead of moving provider state
cookies to a customer host.

On a verified custom domain, connect LinkedIn and Search Console from its integration
settings. Confirm the destination domain and account on Topiqu, complete provider
consent, and verify return to the original domain and locale. Repeat with a cold
central session and with the central session selecting a different tenant. The
explicit grant still targets the requesting tenant; the selected tenant is not an
authorization substitute.

Check cancellation, denied consent, expired grants, revoked source sessions, changed
membership and callback replay. Start again from settings after a failed/expired
connection; tickets are single-use. Provider secrets and responses must not appear
in browser payloads, logs or telemetry. No live provider mutation is needed for the
unit/security tests, which use synthetic exchanges.

Check Stripe portal, subscription and article-pack returns in all supported locales,
including a custom domain. Return destinations are same-origin and locale-prefixed;
unsupported supplied locales are rejected.

## Article recovery and sessions

Open the same existing article in two editors. Save in one, then attempt to save the
other: it must show a conflict while preserving the draft and offer download/reload.
View counters must not cause conflicts. Poll reconciliation, content and editor tag
replacement share one transaction. Translation edits compare the observed update
timestamp, and publishing translations requires the publishing capability.
Standalone tag add/remove/replace actions also archive and version their changes,
so a previously opened editor cannot silently overwrite those selections.

History retains the last 50 source-article pre-change snapshots, including automated
changes after deployment. Loading a snapshot changes only the unsaved content draft
and available tags. It leaves the current address, publication state, schedule,
ownership and series unchanged. The normal Save/Publish flow revalidates media and
permissions. Earlier translation versions are not included in source history.

In account settings, inspect session origins and revoke other sessions. Confirm that
the current session continues working and another browser/custom-domain session no
longer authenticates. A normal sign-out ends only that session; Topiqu subdomains
share it, while custom domains have separate sessions. Older origins remain unknown.

## Operations overview

`/master/operations` is available only to superadmins. It exposes bounded task status,
queue counts, Redis connectivity and classified integration failures. Refresh reads
current state; it does not execute scheduled work. Tasks show unknown until observed
after rollout. Partial item failures show degraded even when the task returned.
Status persists in PostgreSQL across restarts; overlapping replicas cannot overwrite
a newer run's current status with an older completion. This monitoring does not
provide scheduler deduplication or authorize increasing replica count.

A failed webhook retry requires acknowledging that the receiver may already have
processed it. It queues the same immutable event/delivery ID, preserves attempts and
uses the existing delivery worker. Receivers should deduplicate that ID. Disabled
endpoints and ineligible tenants cannot be retried. The action is rate-limited and
audited atomically. Review domains in the existing domain console; there is no
generic cron, AI, provider or infrastructure retry button.

## Performance measurement

`bun run perf:check` requires a completed production build. It reads the Nitro client
manifest and checks gzip startup bytes for the common entry, publication, article
and editor shell, plus largest/total JS and total CSS. Shared scripts are counted
once. The CSS budget includes external stylesheets and SSR inline CSS loaded from
the emitted `styles.mjs` manifest, including global Tailwind/UI/font styles. Exact
duplicate CSS bodies are counted once across files and loaders; differing bodies
remain separate. Asset URLs in inline CSS use deterministic `/_nuxt/` and `/`
prefixes. This is an application-wide sum of gzip-compressed unique style bodies,
not a measurement of the CSS transferred in any one HTML response. Missing/changed
manifests, loaders or global entry styles fail rather than silently skipping a
budget. The committed limits derive from the preceding local production artifact
with regression headroom; they are ceilings, not proof of good Core Web Vitals.
The CSS reader bundles only emitted style modules, replacing Nitro asset URL imports
with deterministic resolvers. It never imports the server entrypoint or starts the app.

The existing production Sentry DSN enables a 10% sample of analytics-consenting
documents. LCP and INP report milliseconds; CLS is unitless. Metric names are
`web_vitals.lcp`, `web_vitals.inp` and `web_vitals.cls`. Group p75 distributions by
`page_type` and `device_type`, filtered to production. The other fixed attributes
are `measurement=document` and `sample_rate=0.1`. No URL, article/tenant identifier,
metric ID, user identity or DOM attribution is transmitted in these metrics.

Set the Sentry Metrics dashboard p75 goals to LCP ≤2500ms, INP ≤200ms and CLS ≤0.1.
Observe volume and a representative period before drawing conclusions. Documents
without consent, a DSN, a valid page category or a sample selection do not report.
Consent revocation stops further observations. Sensitive navigation permanently
disables reporting for that document. SPA changes are not separate LCP measurements;
the initial hard-navigation category stays associated with the document metric.

Production proxy compression, network conditions and real users still require field
verification. Local asset-budget checks and browser regressions do not establish
production p75 values or guarantee the absence of future performance regressions.
