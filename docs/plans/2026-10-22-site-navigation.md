# Site navigation implementation plan

**Goal:** Make Web and Dashboard normal same-tab destinations while preserving the
authorized sidebar on public pages.

**Architecture:** Keep the existing tenant/auth resolution and shell authorization.
Extend `app/utils/publicationUrl.ts` with a navigation destination that reuses the
verified canonical publication URL, returns the localized internal home path only
for the same origin, and otherwise keeps the canonical URL and publication language.
`Header.vue` uses host-resolved tenant branding on both public and admin routes;
the central host uses Topiqu and the appropriate dashboard/login destination.

**Stack:** Nuxt 4, Vue 3, Nuxt UI, Bun 1.4.3, Vitest and existing browser fixtures.

- [x] Add focused URL tests for managed/custom same-origin navigation, central
      cross-origin navigation, unavailable publications and local ports. Run
      `bun run test tests/unit/publicationUrl.test.ts --maxWorkers=2` and establish
      the new behavior fails before implementing it.
- [x] Implement `publicationNavigationUrl(site, homePath, requestUrl)` using
      `publicationUrl`; return `homePath` only when canonical and request origins
      match. Leave existing absolute URL consumers unchanged.
- [x] Move Web from the sidebar footer into the main navigation with `mdi:web`,
      exact route matching and no forced target. Give Dashboard exact matching too.
      Translate Web in the four existing locale catalogs. Preserve server guards,
      authorized public sidebar visibility and editor leave protection.
- [x] Make Header tenant branding independent of page shell. Tenant logos lead to
      index; central Topiqu leads to admin/master for privileged users and auth for
      other visitors. Preserve the current article-header behavior and widget preview.
- [x] Add focused browser coverage for same-tab Web navigation, active state,
      retained sidebar, tenant/central logo destinations and unsaved editor work.
      Retain the existing foreign-tenant and collapsed-sidebar checks.
- [x] Run focused unit/i18n checks, lint, formatting, type checking and targeted
      browser QA one worker at a time. Update MAP with the navigation contract.
- [x] Create a new local demo test database, apply committed migrations and seed
      synthetic fixtures. Start one compiled Bun server on port 3001 with test-only
      configuration and provider credentials disabled. Verify the demo in desktop,
      mobile, Czech/English and dark mode, then provide its URL and demo login.

No dependency or schema changes are required; demo setup stays local.

## Verification

The new URL tests first failed on the missing behavior; all 47 focused URL, shell,
host-resolution and i18n tests then passed. Lint, formatting, type checking and the
single Bun production build passed. The targeted desktop English, desktop Czech
dark and mobile WebKit browser run passed 17 scenarios, with one desktop-only
collapse test deliberately skipped on mobile. It checks actual homepage content,
same-tab SPA navigation, exact active links, central/tenant logo destinations,
editor leave confirmation, foreign-host isolation and collapsed overflow.

The demo uses a new local PostgreSQL database with all 120 committed migrations and
existing synthetic fixtures. It listens on loopback port 3001 with provider
credentials disabled and scheduling disabled by browser-test configuration.
Desktop visual inspection confirmed the public sidebar and dark mode without
horizontal overflow. The header/navigation accessibility audit reported no
violations; automated contrast classification remained incomplete for two
pseudo-element backgrounds, so the changed links were inspected manually. Measured
dark-mode text contrast was 7.35:1 for Web and 6.83:1 for Dashboard.
