# Changelog

User-visible changes are recorded here from this point forward. Earlier history is available in
the [commit log](https://github.com/Topiqu/app/commits/main).

## Unreleased

### Added

- GNU AGPL v3 license, contributor and security policies, code ownership and contribution templates.
- Payment or saved-card checks for custom domains; Topiqu subdomain changes stay free on all plans.
- Per-blog team limits of 1 / 2 / 3 for Basic / Pro / Premium, including the owner, with reserved invitation seats and recoverable access after plan changes. Blog count is unlimited. Managed CUSTOM starts at $199/month for three members; existing individually contracted plans retain their terms.
- Scoped API keys: up to 10 named keys per blog with `READ`, `WRITE`, `PUBLISH` and `GENERATE` scopes, last use and revocation in settings. A key never exceeds the permissions of the member who created it.
- API writes: `POST /api/v1/articles` and `PATCH /api/v1/articles/:id`, drafts through `GET /api/v1/articles/:id` for `WRITE` keys, and `Idempotency-Key` replays for 24 hours.
- API article generation: `POST /api/v1/articles/generate` queues a requested topic as a draft and `GET /api/v1/generations/:id` reports its status.
- `generation.succeeded` and `generation.failed` webhooks.
- Machine-readable account export in the profile: a JSON file with account data, content, activity and, for blog owners, their blogs' articles, media and Knowledge.
- Account deletion in the profile: confirmed with the email, password, two-factor code and the domain of each owned blog, restorable for 30 days and then anonymised. Owned blogs close with the account, and their subscriptions end with the paid period.

### Changed

- API keys are stored only as hashes and shown once. Existing keys keep working with read-only access, and each key is limited to 120 requests per minute.

### Fixed

- Settings changes invalidate dependent topic plan, content action, statistics and domain caches.
- Publication metadata follows saved settings without a full page reload.
- Branding preview stops at the end of typography settings.
- AI visibility actions align with their prompt header, including expanded rows.
- Disposable inbox checks cover registration, OAuth and subdomains of known disposable providers.
- Paused Stripe subscriptions lose paid entitlements and can recover when resumed.
- Plan revocation restores a free Topiqu address in the same transaction, cancels pending custom activation and queues provider cleanup for minute retries. Retired host mappings cannot survive through a shared cache entry.
- Adopted provider resources keep their identifiers and request administrator review rather than reporting a completed cleanup.
