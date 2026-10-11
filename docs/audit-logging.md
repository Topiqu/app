# Security activity and audit logging

The account's Security activity panel reads `/api/users/security-events`: the latest 20 `SESSION_CREATE`, `SESSION_REVOKE`, `PASSWORD_CHANGE`, `PASSWORD_SET`, and `ROLE_CHANGE` entries for the current user. It returns the timestamp, IP, device, browser, OS, city and country, with a whitelist of metadata fields. Article operations and tenant configuration do not enter this feed.

The broader audit uses the `Log` model through `logAction`. Entries include the actor (or the system user for background tasks), tenant, action, timestamp, optional IP and structured metadata. An HMAC hash chain protects integrity, and an advisory transaction lock serializes writes. Entries are also forwarded to the operational logger as `audit:<action>`.

Failed sign-ins and login rate limits currently go to the operational logger (`AUTH_LOGIN_FAILED`, `AUTH_LOGIN_RATE_LIMITED`), rather than the account feed. TOTP enable/disable currently has no dedicated audit event. Tenant scope events identify the actor in `userId` and the affected member in `metadata.targetUserId`; they are not account security-feed events.

## Tenant configuration and permissions

- `CLIENT_SITE_UPDATE`: only fields whose persisted values changed, with `updatedFields` and `changes[field] = { before, after }`. Includes scalar settings, social links, AI author identity and LinkedIn mode. An explicit whitelist excludes API keys and generated DNS verification tokens.
- `AI_USER_UPDATE`: changed username/bio values only; arbitrary fields from the AI identity request are excluded.
- `TENANT_MEMBER_SCOPES_CHANGED`: actor, affected member, membership ID, previous/current scopes, `addedScopes`, and `removedScopes`. Reordering or repeating the same scopes does not generate a change event.
- Existing tenant events also cover creation, switching the active tenant, invitations (creation, resending, revocation, acceptance and rejection), member removal, and domain changes/verification.

## Articles and generation

Article creation and updates retain their existing actions. `ARTICLE_UPDATE` includes the previous/current publication status and release date. `ARTICLE_DELETED` records the article ID, title and last status before publication side effects run. Draft text is not copied into these audit events.

Manual and scheduled generation share `ARTICLE_GENERATION_STEP_STARTED`, `ARTICLE_GENERATION_STEP_COMPLETED`, `ARTICLE_GENERATION_STEP_FAILED`, and `ARTICLE_GENERATION_STEP_SKIPPED`. Each event includes `attemptId`, `mode`, tenant, `stage`, and the article ID when known. Completed/failed steps include `durationMs`.

Instrumented stages cover configuration, article-credit reservation, recovery-session creation, topic selection, research, knowledge retrieval, writing, editorial review and revision, media finalization, individual AI image generation, internal linking, series classification, persistence, publication checks/delivery, and credit settlement, as applicable to the generation mode. Review passes and publication operations are distinguished in metadata.

Step summaries include counts, token usage, research status/fallback reason, review approval/issue codes, and media availability. They do not include raw prompts, research briefs, article bodies or provider responses. `ARTICLE_GENERATION_FALLBACK` records degraded review, revision, linking or finalization that still returns useful content; a failed image has its own failed step even when the article succeeds.

Existing `MANUAL_GENERATION_*`, `CRON_GENERATE_ARTICLE`, `CRON_ARTICLE_PUBLISHED`, `CRON_ARTICLE_SAVED_AS_DRAFT`, and token-usage events remain available. Scheduled runs additionally have `CRON_GENERATION_STARTED` and `CRON_GENERATION_COMPLETED`; failures outside the writer, including reservation, persistence, publication and settlement, get a correlated `CRON_GENERATE_ARTICLE_FAILED` event. Manual preflight/reservation/session failures are recorded before the streaming response starts. Manual completion is recorded after the recovery snapshot and successful settlement have been persisted.

New generation-step telemetry is best effort: a logging/reporting outage or a broken summary must not discard an otherwise successful article. Skipped steps are distinguishable from failures; normal cron `not_due` checks and individual streamed text chunks do not create audit entries.

The tenant activity endpoint `/api/clients/:id/log` deliberately keeps its existing compact action whitelist. Detailed steps and configuration/permission changes remain in the broader audit database and operational logs; they do not add dozens of rows to that compact activity feed. No schema migration is needed because `Log.action` and `Log.metadata` are extensible.
