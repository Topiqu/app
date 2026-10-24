# UI and publishing repairs — 2026-10-24

Scope: the 26 screenshots and accompanying requests from the owner. This document
records the implemented boundaries and the remaining operational checks; it does
not assert that live production or paid AI output has been verified.

## Changes

- Shared Nuxt UI button padding and nested segmented-control radii; balanced API
  access layout, card headers, visibility prompt actions, chart colours and independent
  chart/table disclosure sizing.
- Compact widget previews and article cards; smaller secondary metadata and simpler
  profile activity. Related cards request two results and use two desktop columns. Profile search, filters,
  sorting and layout controls align together and wrap on narrow content widths.
  Draft selection cards keep media flush with the top and deletion in the footer.
- Dashboard pages share the 90rem page container and responsive horizontal padding.
  Branding uses the landing palette order, horizontal gradient samples and a sticky
  right preview on desktop, with isolated light/dark modes. Footer and domain settings
  stay in the same editing column. Background activity opens from the fixed version
  bar, between the wallet/version and cookie controls. Sidebar groups separate content,
  resources and performance, with website access and settings in its footer.
- Dark article/editor tables override legacy light cell backgrounds while preserving
  the stored HTML and the selected colours in light mode.
- Source and translation editing share the header action area. Empty drafts are
  allowed; publishing an empty body produces an actionable localized error.
- Media acknowledgements are reused only for the same tenant, article, language and
  current rights fingerprint. Removing publication does not require publication
  rights approval. Autosave preserves text when a selected cover is unavailable.
- Comments collect report reasons, use normal-flow actions and explain bans.
  Mutations reconcile canonical server state. Visible pages refresh periodically
  without discarding loaded threads; this is polling, not instantaneous push.
- Public series positions/counts use available published episodes. Administration
  has a series overview with search, sorting and episode statuses.
- Manual translations can run in the background with a persisted translation claim.
  Existing generation recovery and the global activity panel expose ongoing work;
  stopping after a page refresh also reaches the server. These reuse existing rows
  and Nitro background work, without a new queue service. The additive
  `20261024020000_translation_background_state` migration adds a nullable
  `ArticleTranslation.translationStartedAt` lease marker. It preserves the published
  body during replacement and expires abandoned work after 30 minutes. Apply the
  migration before starting this version against an existing database.
- Onboarding passes the original password to the common writer, which hashes it
  once. Previously it hashed before that writer, creating an unusable double hash.
  Existing affected accounts require the normal password-reset flow; the inner
  salted hash cannot be recovered from the stored outer hash.
- Nitro shutdown clears the development database singleton before disconnecting it,
  so a later hot reload cannot borrow an already destroyed driver.
- Opinion instructions preserve the requested stance; illustrative-story framing
  applies only to stories. High controversy allows an explicitly requested forceful
  voice while retaining factual standards. Image queries and vision checks retain
  geographic context instead of treating article language as its location.
- Blog owners have a collapsed danger zone with an exact-domain confirmation for
  deactivation. Deactivation hides the blog and retains data, detaches tenant sessions
  and excludes it from scheduled article generation. Permanent deletion remains a
  platform-admin maintenance operation. Deactivation does not cancel billing or
  remove externally published copies; the confirmation explains this explicitly.

## AI latency — read-only analysis

No latency/model-quality configuration was changed for this request. These are
code-path observations, not measured performance gains:

- Research and knowledge retrieval already run concurrently in `articleConfig.ts`.
  Research has quick/standard/deep deadlines of 50/90/150 seconds; these are ceilings,
  not observed durations.
- Writing is followed by independent verification/copy review and potentially one
  revision. Manual generation already avoids a second live-web verification after
  revision; scheduled unattended publication retains a stricter review path.
- `articleMedia.ts` resolves the cover before starting concurrent body-image work.
  Each library search can perform up to three vision checks, and the provider chain
  can add multiple downloads/searches before a fallback. Link selection follows media.
- Writer effort is tied to the selected quality tier. Reducing it globally would
  change that product contract, so it is not an automatic optimization.

Next useful measurements are per-stage P50/P95 from existing generation audit spans,
separating provider time from local/database time and counting retries/fallbacks.
Then evaluate bounded overlap of independent cover/body work and a per-run cache of
identical image checks (keyed by asset, subject and context). Any shared research
cache must retain tenant boundaries, freshness and source evidence. Expose progress
and early text while optional media finishes; do not silently skip factual or rights
checks to shorten a progress bar. Validate changes against the same prompts and
quality tiers before claiming a speedup.

## Verification boundary

Completed locally:

- ZenStack generation and Nuxt preparation; Vue TypeScript check with zero diagnostics.
- ESLint and Prettier on the changed files, OpenAPI check and `git diff --check`.
- Focused editor/media/translation regressions: 110 tests across 12 files passed.
  Auth/onboarding, deactivation, image checks and locale validation: 59 tests passed.
  Community/series regressions and locale syntax also passed. Initial setup/import
  timeouts were resolved by isolated reruns and separating module loading from the
  operation deadline; no unexplained failing target remains.
- Production Bun build on local macOS ARM64 completed successfully.
- The built server returned health HTTP 200 against the disposable database.
  Chromium verified credential sign-in, Czech dark settings, desktop/mobile overflow,
  the empty-publication explanation, empty draft persistence (HTTP 200), and the
  series overview. No uncaught browser JavaScript errors were recorded.
- Follow-up layout inspection used the running development server with synthetic,
  read-only browser fixtures: Czech dark profile, branding, tags, draft selection
  and related cards at desktop and 390px mobile widths. Toolbar controls shared a
  baseline, tags had equal 6px padding, draft heights matched with deletion inside
  the footer, and the checked mobile surfaces had no horizontal overflow.

Use targeted regression tests, locale completeness, lint, typecheck and browser
checks against the disposable local fixture. Paid providers, external publication,
email delivery and the actual production server are outside this local verification.
No deployment, push, production migration, password reset or blog deactivation is
performed by implementing these controls. The four previously pending upstream
migrations and the new translation-state migration were first applied to
`topiqu_browser_test_20261022` in the local Docker fixture for browser verification.
The later requested local development startup also applied them to the verified
local PostgreSQL database after a backup. The layout follow-up did not change data.
