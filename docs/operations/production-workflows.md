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

The Stripe account operator can use [the release checklist](stripe-release-checklist.md).
The [AI allowances and CUSTOM billing policy](ai-economics-proposal.md) describes
the implemented per-blog limits, explicit top-ups and managed seat billing. The
working tree still requires an operator-controlled production rollout.

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

The Stripe webhook endpoint must receive `customer.subscription.updated`,
`customer.subscription.paused`, `customer.subscription.resumed` and
`customer.subscription.deleted`, in addition to its existing Checkout and invoice events.
Pause/resume events reconcile the provider's current subscription, so delayed events cannot
restore an obsolete status. A paused trial loses paid entitlements; a resumed active subscription
restores them. Confirm delivery in Stripe before relying on these transitions in production.

Managed Topiqu subdomains are free on every plan, including during and after a trial. Changing one
does not require a card, contact Stripe or create a Cloudflare Custom Hostname.
Custom-domain connections require payment history on a non-Basic plan, CUSTOM/non-Basic PERMANENT, a non-Basic
plan without trial provenance, or an unexpired card attached to the tenant's Stripe customer.
A former trial manually changed to PRO/PREMIUM still needs payment history or a card.
A free Premium trial alone is not
enough. The existing Pro-or-higher requirement for custom hostnames still applies. Verify a
card-less trial, a paid tenant, a saved card, a billing outage and cancellation/disconnection.
Billing errors must block a new change without hiding cleanup of an existing connection.

When a trial/subscription transition commits BASIC, the same transaction switches a custom
domain to a free managed address and cancels pending custom activation. The next custom-host
request reads current database state; a stale cache cannot keep serving the former blog.
The minute `domain-cleanup` task then retries Cloudflare/Dokploy cleanup using the retained
resource IDs and per-connection lease. This separates immediate application access revocation
from provider availability. Manually adopted resources are never deleted automatically: the
connection retains its IDs and reports `ADOPTION_REQUIRED` for operator cleanup. Card-less
trial expiry is detected by the existing ten-minute `trial-expiry` sweep, while Stripe-owned
subscriptions follow the provider webhook lifecycle. No claim is made that a remote provider
deletes resources synchronously with a plan change.

Blog count is unlimited; the creation rate limit remains. Team seats belong to each blog:
BASIC 1, PRO 2, PREMIUM 3, including its owner. Pending invitations reserve a seat for seven
days; accepting or resending rechecks capacity under the same row lock as billing changes.
After a downgrade, the owner and oldest eligible members retain access. Other memberships
remain visible as paused and resume after an upgrade or an earlier member is removed.
Managed CUSTOM starts with three paid seats; buying capacity requires an explicit
Stripe price preview and confirmation. Invitations never charge. Legacy CUSTOM
contracts keep their individually configured terms. Additional blogs start BASIC
without another trial. See the billing policy for the exact catalog and migration requirements.
Before release, test parallel invitations and acceptance after a downgrade against the isolated
PostgreSQL test database, plus owner access and recovery after upgrading.

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
