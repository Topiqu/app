# Dependency compatibility, 2026-11-05

The app and landing use Bun 1.4.4, the latest stable Bun release checked for this
upgrade. Node 26.13.0 is the latest LTS compiler checked against the official Node
release index; `.node-version`, app Docker compilation and CI agree on it. The
landing Docker build and both released servers continue to run with Bun.

The main coupled updates are Nuxt 4.6.4, Better Auth 1.7.17 with its matching core,
the complete ZenStack 3.10.0 group, AI SDK 7.0.163 with matching providers, and
Tiptap 3.32.2. `@tiptap/pm` is now an explicit dependency because authored figure
and toolbar extensions import it; this also prevents conflicting ProseMirror peer
identities. The landing migrates its password checks to ZxcvbnFactory and its SEO
stack to Unhead 3 / Nuxt SEO 5. It retains static social images.

The landing explicitly declares VueUse Core 15 to match its Nuxt module's generated
imports; Nuxt UI keeps its supported Core 14 copy. Its locale definitions now use
`language` instead of the obsolete `iso` field so i18n and SEO generate the correct
HTML language in both locales.

The landing uses Nuxt 4's generated TypeScript project references instead of the
legacy combined config. This keeps generated application aliases out of Bun's
resolution of build dependencies: the old global H3 alias incorrectly replaced
a build tool's separate H3 version. See the
[Nuxt TypeScript configuration](https://nuxt.com/docs/4.x/directory-structure/tsconfig).

The existing Unhead 3.4.3 cleanup patch is retained and applied to the landing as
well. Both Docker dependency stages copy their declared patches before the frozen
install. Takumi 2.19.0 is supported by the resolved Nuxt OG Image 6.10.4 peer range;
the native renderer chooses its optional platform binding, including Linux ARM64.
The app no longer declares an unrelated x64-only binding as a direct dependency.

## Compatibility holds

| Package                   | Selected | Newer candidate | Constraint                                                                                                                                          |
| ------------------------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, both projects | 6.0.3    | 7.0.2           | Vue/Volar requires the JavaScript compiler API absent from TypeScript 7.                                                                            |
| H3, app                   | 1.15.11  | 2.0.8           | Nitro 2.13.6 requires H3 1; a Nitro 3 migration is separate.                                                                                        |
| Nuxt SEO, both projects   | 5.3.16   | 6.0.1           | The OG Image 7 setup calls `node:module.findPackageJSON`, unavailable in the verified official Bun 1.4.4 runtime. This fails Bun-based preparation. |
| vue-tsc, app              | 3.3.13   | 3.3.14          | 3.3.14 reports nonexistent `form.value` accesses in the unchanged reactive knowledge-source form. With the same upgraded graph, 3.3.13 passes.      |

The SEO hold preserves the current production ENV contract. No new
`NUXT_APP_SECRET` is required by this selected dependency set. Revisit the hold
when a stable Bun release supports the required module API, and then follow the
[Nuxt SEO migration guide](https://nuxtseo.com/docs/nuxt-seo/migration-guide/v5-to-v6).
The [TypeScript 7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
explain the Vue tooling constraint.

## Remaining package advisories

Native Bun audit checks were run after refreshing transitive dependencies. Their
result is not clean. Applying unsupported major overrides would violate the
compatibility requirement. Track these upstream constraints:

| Dependency                  | Constraint and consumer                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@hono/node-server` 1.19.18 | ZenStack CLI 3.10.0 requires `^1.13.8`; the affected static-serving path is fixed in major 2. Earlier 1.19.9 also has other advisories. |
| `deepmerge` 4.3.1           | Rollup's node-resolve plugin requires `^4.2.2`, excluding the downgrade suggested by audit.                                             |
| `deepmerge-ts` 7.1.5        | The migration CLI's Prisma config pins 7.1.5; the reported recursive-merge issue is fixed in major 8.                                   |
| `glob` 11 / 13              | Workbox, Sentry bundling, NFT and MJML tooling require these majors; the reported fix is in major 14.                                   |
| `minimatch` 10              | ESLint, TypeScript lint tooling and glob consumers require major 10; the reported fix is in major 11.                                   |
| `zod` 3.25.76, landing      | Nuxt Content 3.16.2 requires `^3.25.76`; its reported fix is in Zod 4. Application-owned validation uses Zod 4.6.7.                     |

The vulnerable esbuild 0.27.7 copy was replaced with 0.27.2 inside its parent's
allowed range; other consumers retain their supported esbuild versions. Frozen
installs preserve this resolution. Recheck audit after future updates.

These are package advisories, not a proof that every path is reachable from a
public endpoint. This upgrade does not establish that the deployed application
has no vulnerabilities. Keep development tooling private and review upstream
fixes before changing the parent constraints.

## Release validation

Run the existing frozen install, generation, lint, formatting, OpenAPI, typecheck,
test, production build and release smoke checks with these exact toolchains.
Exercise a runtime OG image after a renderer upgrade, and verify both landing
locales, their HTML language and JSON-LD. Heavy checks run sequentially.

The release smoke suite now checks a signed runtime article OG image through HTTP
and attaches the rendered image for inspection. The existing browser/service-worker
checks remain required in CI.

Local results with the selected versions:

- App: frozen install, ZenStack generation, local test-database migrations, lint,
  OpenAPI, typecheck and production build passed. Vitest passed 4,157 tests with
  45 skipped; all seven bundle budgets passed. After the final AI SDK patch refresh,
  all 426 focused AI tests and typecheck passed again.
- App HTTP release smoke: four tests passed, covering SSR/compression, IPX,
  signed runtime OG rendering and SSR authentication.
- Landing: frozen install, lint, formatting, OpenAPI, typecheck and Bun production build passed. Its production
  smoke passed both locales, onboarding, documentation, language attributes,
  structured data and responsive image variants. Its unit suite passed 66 tests.
- Browser release checks could not start Chromium because macOS rejected its Mach
  bootstrap registration. No browser assertions ran; service-worker and wallet
  browser scenarios still need the existing CI gates.
- Linux Docker builds were blocked before compilation by the local Docker
  credential helper (`osxkeychain`, error -50). Native macOS builds and HTTP checks
  do not replace the final Linux image check.
- Bun audit remains nonzero for the upstream advisories listed above.

The authored database schema and SQL migration history have no changes in this
upgrade. Production deployment remains a separate operator action.
