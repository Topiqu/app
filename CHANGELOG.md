# Changelog

User-visible changes are recorded here from this point forward. Earlier history is available in
the [commit log](https://github.com/Topiqu/app/commits/main).

## Unreleased

### Added

- GNU AGPL v3 license, contributor and security policies, code ownership and contribution templates.
- Payment or saved-card checks for custom domains; Topiqu subdomain changes stay free on all plans.
- Per-blog team limits of 1 / 2 / 3 for Basic / Pro / Premium, including the owner, with reserved invitation seats and recoverable access after plan changes. Blog count is unlimited. Managed CUSTOM starts at $199/month for three members; existing individually contracted plans retain their terms.

### Fixed

- Settings changes invalidate dependent topic plan, content action, statistics and domain caches.
- Publication metadata follows saved settings without a full page reload.
- Branding preview stops at the end of typography settings.
- AI visibility actions align with their prompt header, including expanded rows.
- Disposable inbox checks cover registration, OAuth and subdomains of known disposable providers.
- Paused Stripe subscriptions lose paid entitlements and can recover when resumed.
- Plan revocation restores a free Topiqu address in the same transaction, cancels pending custom activation and queues provider cleanup for minute retries. Retired host mappings cannot survive through a shared cache entry.
- Adopted provider resources keep their identifiers and request administrator review rather than reporting a completed cleanup.
