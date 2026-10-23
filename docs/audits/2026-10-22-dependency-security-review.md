# Dependency security and compatibility review — 2026-10-22

This review covers the installed Bun 1.4.4 graph after restoring SEO 5.3.16 / Takumi
1.8.7 and removing all four `estree-walker`, `simple-git`, `deepmerge-ts`, and
`esbuild` overrides. The lock contains 2,219 package locators. No manifest,
lockfile, installed package, advisory suppression, or production environment was
changed by this review.

## Advisory results

Both `bun --no-env-file audit --json` and
`bun --no-env-file audit --production --json` completed through the registry from
the root agent's network-enabled context after final resolution and exited **1**.
The complete graph has **five findings: three high, one moderate, one low**. The
production graph has **four: two high, one moderate, one low**; deepmerge-ts is
a development-graph dependency excluded from that report, but its executable code
is packaged in the startup migration CLI (see artifact inspection below). The
child sandbox's DNS failures
were not treated as successful audits. Registry latest releases still do not fix
the first three findings; the other two have fixes outside the consumers' declared
ranges and require the reachability review below.

| Package / advisory                                                                                    | Locked path and actual use                                                                                                                                                                                                                                                                             | Disposition                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `braces@3.0.3`, high [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)         | `micromatch@4.0.8` through Nitro `globby` and i18n `fast-glob`. Deeply nested **patterns** can exhaust the stack. Application server/scripts do not import these glob libraries or accept customer glob patterns. Current paths are build/configuration scanning.                                      | Hold and track upstream; registry latest remains 3.0.3 and micromatch latest remains 4.0.8. Do not pass untrusted patterns into these tools. Inspected HTTP artifact contains metadata only; see the Linux artifact inspection below.                  |
| `node-forge@1.4.0`, high [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)     | Only `listhen@1.10.1`, through Nuxt/Nitro. Advisory concerns RSA signature verification. Installed listhen uses forge for local TLS certificate/key generation, signing, and PKCS12 parsing; its source does not call signature verification. No direct application forge import was found.            | Hold and track upstream; both forge and listhen are already registry latest. No demonstrated application signature-verification attack path. Inspected HTTP artifact contains metadata only; see the Linux artifact inspection below.                  |
| `sprintf-js@1.0.3`, moderate [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Only `mammoth@1.13.0 → argparse@1.0.10`. Advisory requires attacker-controlled format strings. Mammoth imports argparse in `bin/mammoth`; `lib/` does not import argparse/sprintf. Topiqu's knowledge extraction imports Mammoth's `lib/index.js` and calls `convertToHtml`, without invoking the CLI. | Hold and track upstream. Latest sprintf 1.1.3 is also affected; latest Mammoth still requires argparse `~1.0.3`. Forcing argparse 3.0.3 would cross Mammoth's contract and requires an upstream CLI migration, so it is not a compatible security fix. |

| Package / advisory                                                                                  | Locked path and actual use                                                                                                                                                                                                                                                                                                                               | Disposition                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deepmerge-ts@7.1.5`, high [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | Prisma config 6.19.3, reached by the deployed startup migration CLI, requires exactly 7.1.5 and passes `deepmerge` as c12's merger for local `prisma.config.*` files. The advisory requires matching recursive object references in multiple inputs; plain JSON cannot create the condition. No Prisma config file or HTTP application import was found. | Fix exists in 8.0.0, with breaking Map/input mutation semantics. Hold the upstream exact version: no attacker-controlled graph reaches this local startup configuration path. Prisma's loader disables rc, remote/extended config, package.json and dotenv loading. Do not force 8 merely to clear the report; reevaluate a scoped security override with config compatibility coverage if that input surface changes. |
| `esbuild@0.27.7`, low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)      | Fontless requests `^0.27.0`; its nested 0.27.7 is affected by Windows development-server traversal. Installed fontless only imports `transform`, not the server API; the production target is Bun/Linux.                                                                                                                                                 | Fixed in 0.28.1, outside fontless's range. Keep the range-correct resolution and track upstream rather than force an unrelated minor. No demonstrated vulnerable operation on the supported production target; do not use this copy to serve files on Windows.                                                                                                                                                         |

`--production` means dependency-graph reachability from declared production
dependencies; Nuxt and Mammoth include development/CLI dependencies in that graph.
It does **not** prove these vulnerable operations run in the final Nitro server.
The Linux artifact inspection below distinguishes HTTP code, retained package
metadata and the separate startup migration CLI. The audit remains visibly
nonzero; no ignore list was added. Future packaging changes require another trace
and runtime check.

Primary registry metadata checked:
[braces](https://registry.npmjs.org/braces/latest),
[micromatch](https://registry.npmjs.org/micromatch/latest),
[node-forge](https://registry.npmjs.org/node-forge/latest),
[listhen](https://registry.npmjs.org/listhen/latest),
[sprintf-js](https://registry.npmjs.org/sprintf-js/latest),
[Mammoth](https://registry.npmjs.org/mammoth/latest), and
[argparse](https://registry.npmjs.org/argparse/latest).

## Linux artifact inspection

Read-only inspection of the extracted Linux ARM64 production image on 2026-10-22
found only `package.json` metadata for `braces@3.0.3`, `node-forge@1.4.0`,
`sprintf-js@1.0.3`, `argparse@1.0.10`, and `deepmerge-ts@7.1.5` under
`server/node_modules`: none of their executable package files was included. The
only esbuild metadata there was 0.28.2, with no executable files; the affected
fontless copy 0.27.7 was absent. Compiled server entry/chunks contained no references
to those package names. HTTP imports Mammoth's `lib/index.js`; its CLI was absent.
The HTTP copies of `prisma`, `@prisma/config` and `@zenstackhq/sdk` likewise retained
metadata only. HTTP data access uses `@zenstackhq/orm`.

The separate `migrate/node_modules` tree **does include executable
`deepmerge-ts@7.1.5`**. Its literal import chain is
`prisma/build/index.js → @prisma/config/dist/index.js → deepmerge-ts/dist/index.mjs`.
`scripts/docker-entrypoint.sh` runs this migration CLI before starting Nitro, so
development-graph classification does not imply exclusion from the deployed
container. This is startup configuration code; no HTTP input path was found. The
inspected loader disables dotenv, rc, remote/extended config and package.json
config loading, and no `prisma.config.*` file was present in the artifact. Keep the
advisory visible and reevaluate if deployment accepts untrusted local config.

Native files for Argon2 (`argon2.armv8.glibc.node`), Sharp
(`sharp-linux-arm64-0.35.5.node`), Takumi (`core.linux-arm64-gnu.node`), and Prisma
(`schema-engine-linux-arm64-openssl-3.0.x` and the corresponding query library)
were verified as ELF 64-bit ARM aarch64. Argon2 and Sharp are direct HTTP server
imports; Takumi is reached lazily through the OG image route and renderer chunks.
Prisma engines belong to the startup migration tree. File presence/architecture
does not prove dynamic linking or native execution; actual Linux runtime smoke is
a separate gate.

The private parser traced literal static/dynamic imports, re-exports and require
calls without executing artifact code: 6,395 HTTP files and 704 migration files.
It used pinned Bun on macOS with separate import/require conditions and
conservatively visited conditional branches. The 99 unresolved HTTP references
were predominantly other-platform native variants/fallbacks, optional pg-native,
canvas/dev-libvips and a bundled noble crypto condition. The migration trace had
one package self-reference in node-fetch-native. These are static analysis limits,
not assertions of runtime failure. Computed loaders, platform branches and bundled
code still require Linux runtime checks. No unresolved advisory-package import was
found; physical package-file absence was checked independently.

Evidence from the first, pre-IPX/shutdown-fix artifact is recorded in
`/private/tmp/topiqu-linux-artifact-review-20261022.md` and
`/private/tmp/topiqu-artifact-reachability-20261022.json`.

A second read-only inspection checked the default Linux ARM64 image
`sha256:6bf5ab286e51e7762d9a3c8a52673f94d8eb2f644600a7cb83ee000b5bfa6b68`.
A fresh, uniquely labeled container was never started, had no network, and was
removed after exact ownership checks. Only selected artifact paths were copied;
the application and migration CLI were not executed by this inspection. The nine
HTTP package directories above still contained metadata only, with the same
versions; migration `deepmerge-ts@7.1.5` remained executable through the local
Prisma configuration loader. The five native binaries were still ARM aarch64.
Compiled HTTP chunks selected `createIPXFetchHandler`, without `srvx/node` or
`createIPXNodeHandler` references, and the native entry contained both signal
handlers. The parent validation run passed actual image smoke checks for IPX
WebP/MIME, response headers, conditional 304 responses and host denial. Native
shutdown checks of the same authored lifecycle exited 0 and left no application
database connections. Runtime
was Bun 1.4.4 as UID 1000, without `BUN_OPTIONS`; that historical image used
`--smol` only for its build command.

This second check validates selected files rather than repeating the complete
import graph. Its private extraction is
`/private/tmp/topiqu-final-linux-artifact-20261022-fcIe0u`. Later body-intake and
security fixes required a replacement image; the final ARM64 checks below apply
to that replacement. These historical observations do not certify a production
deployment. Neither inspection is a clean-audit claim or an advisory suppression.

The later OG source review found a separate response-memory boundary: the installed
module checked DNS/addresses/redirects and a three-second deadline, but consumed
successful remote image bodies with unbounded `arrayBuffer()`. A tenant-selected
external media asset can become a published cover and reach this reader. Topiqu
now wraps the selected Node binding with `server/runtime/ogFetch.ts`, retaining
the original transport while bounding declared and actual bytes to the shared
15 MiB image limit. The upstream null/omitted-image failure behavior is preserved.
Actual installed-module registration and reader regressions passed with synthetic
streams, including missing/false lengths, exact-limit input, redirect/private-host
checks, abort and cancellation cleanup; no external request or package patch was
needed. The earlier ARM64 native OG smoke below exercised the replacement
renderer. The current artifact inspection follows the subsequent Unhead and
accessible-name fixes; local/ARM64 is the selected validation target, with no
AMD64 acceptance claim.

### Final ARM64 image verification — 2026-10-23

After the Unhead cleanup and accessible-name fixes, the actual, uninstrumented
Dockerfile build completed with replacement immutable image ID
`sha256:ddb1cb4d7bfea298f278d8ba3e8dc09557510dffca5a5ee8e1ed85bbb6a831ee`.
A fresh, uniquely labeled, network-disabled container was never started and was
removed after exact ownership checks. Selected artifact inspection passed
**24/24 checks**, including the compiled OG reader's DNS/address validation,
per-hop socket pinning, five-redirect bound, abort propagation and declared/actual
15 MiB response limit. The compiled native body boundary, signal handlers and IPX
Fetch bridge were also present. All five native binaries listed above were valid
ELF64 little-endian ARM aarch64 files, totaling **39,974,680 bytes**; their hashes
are retained with the evidence.

The nine selected HTTP package directories still contain **package metadata
only**, including `deepmerge-ts@7.1.5`, Prisma and the SDK. This is a selected-file
check, not a repeat of the first artifact's complete static import trace.
Separately, startup migration `deepmerge-ts@7.1.5` retains two executable JS files
and the literal import from `@prisma/config`; the deployed startup CLI therefore
still includes the advisory-bearing implementation. The trusted-local-config
reachability qualification above remains necessary, and the audit remains nonzero.

The final build uses Node **24.21.0** solely for the Nuxt compiler, with a
**4096 MiB** compiler heap limit. Bun still performs dependency installation,
generation, migration preparation, startup migrations and HTTP runtime work.
The release image contains neither the copied `/opt/topiqu-node/bin/node` binary
nor runtime `NODE_OPTIONS`, `BUN_OPTIONS`, `MIMALLOC_*` settings or the compiler's
PATH entry.

The replacement client's `B8oIb8AU.js.map` contains the exact installed, patched
Unhead module. Its source line **210** maps to emitted `B8oIb8AU.js`, line **3**,
column **5389**, where the completed cleanup callback is followed by deletion:
`for(let e in f)f[e](),delete f[e];`. The emitted JS SHA-256 is
`0c5cefde0820c18c608d811a5b57f55a2b9cb4532f368a2e2d251c46ecc23d28`.
This proves inclusion of the fix. All seven unchanged build-size budgets also
passed for this artifact, including total JS **1,399,914 bytes gzip** and CSS
**45,172 bytes gzip**; all measurements are recorded in the performance audit.

The parent reported a passing **100-cycle compiled-browser resource check** for
the preceding Unhead-fix image
`sha256:ac902af17786be3b5d7ce0e77973921a7cb13b54b2a92c3f2fa8271dc445e4f6`.
That result remains tied to that checkpoint. The final image follows static
accessible-name and avatar-fallback corrections, with no lifecycle/security logic
change; its selected artifact and emitted cleanup were rechecked as described above. The
100-cycle browser run was not repeated for the final image.

Historical parent runtime validation of the earlier image
`sha256:f5074a4fcb32f47b74e3a5d3909aadab1d2b3abe51d09134c6b36813e16a5518`
passed startup with Bun **1.4.4**, its full pinned stable revision and UID **1000**,
**six native body-boundary cases**, IPX WebP responses and a native Takumi render
producing a **1200 × 600 PNG of 312,319 bytes**, followed by a successful cached
repeat. The unchanged signed OG path used pinned loopback transport; no external
provider request was needed. Shutdown exited **0** in **0.378 seconds**, with
`OOMKilled=false`; a separate PostgreSQL observer found **zero remaining
application connections**. Those results remain evidence for that preceding
image, not fresh runtime proof for `ddb1cb4…`. Replacement runtime and browser
results must identify the replacement image explicitly. Neither selected-file
inspection nor these targeted smoke checks establish every native operation,
arbitrary workload leak freedom or production acceptance.

Private replacement evidence: `/private/tmp/topiqu-final-og-artifact-20261022-TAnjjN/inspection-evidence.json`
(SHA-256 `2ae134ab700e97b3932400b1d70a4f0317ed37ae3166b59565e6b208c2d94033`),
with source/native hashes, package file counts and container cleanup proof in the
same directory. `unhead-client-emission.json` records the emitted-code mapping and
hashes; `performance-budgets.txt` records the seven passing budgets. The final
uninstrumented build log is
`/tmp/topiqu-final-arm64-avatar-build-20261023.log`. Historical
`f507…` build/runtime/body/OG/pool evidence is recorded in
`/tmp/topiqu-final-arm64-*-20261023.log`. These local files are verification
artifacts, not a durable substitute for the immutable image IDs and recorded
results above.

## Overrides

| Override reviewed     | Evidence and resulting decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `estree-walker@2.0.2` | The old global override violated eight locators requesting `^3.0.3`, including Vitest mocker/coverage, unctx, unimport, ast-kit, magic-regexp and Vue tracer. Vue/Rollup still require 2.x. Root removed the override; the resulting lock resolves 3.0.3 and separate 2.0.2 copies according to their consumers.                                                                                                                                                                                                          |
| `simple-git@4.0.2`    | No installed package or dependency edge remains. Current Nuxt DevTools invokes Git directly. Root removed the unused override. If reintroduced by an upstream dependency, recheck [the command-injection advisory](https://github.com/advisories/GHSA-g4wm-2vf7-vfgr), which is fixed in 4.0.0.                                                                                                                                                                                                                           |
| `deepmerge-ts@8.0.2`  | Prisma config 6.19.3 requires **exactly 7.1.5**. Version 8 changes Map merging and input-mutation semantics ([official breaking changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)). Root removed the forced major; 7.1.5 is restored with the explicitly documented startup-CLI recursive-graph advisory above.                                                                                                                                                                                |
| `esbuild@0.28.2`      | The global pin crossed intlify bundle-utils `^0.25.4` and fontless `^0.27.0`. Both call `transform`; neither uses esbuild serve/Deno APIs. Root removed the override. Nitro keeps 0.28.2, intlify now resolves a nested 0.25.12 and fontless a nested 0.27.7, each within its declared range. The refreshed registry audit flags fontless's Windows-only server case above. The selected graph passed type checking, complete tests and the native Linux build; each subsequent release still needs its own smoke checks. |

The reviewed esbuild advisories concern the historical
[development-server CORS issue](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99),
[Windows development-server traversal](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr),
and [Deno binary integrity issue](https://github.com/evanw/esbuild/security/advisories/GHSA-gv7w-rqvm-qjhr).
The historical CORS issue is fixed in all three newly resolved versions. The two
2026 advisories concern Windows serve and the Deno downloader; these operations
are not called by the inspected intlify/fontless integration, and the production
target is Bun/Linux. The current registry audit is the authoritative package-level
result; the API review does not justify suppressing any advisory.

## Peer dependencies and removed patches

The final lock scan found **no missing or mismatched required peer**, and three
installed optional-peer range mismatches:

- `htmlnano@3.3.1` requests cssnano `^8`, while MJML supplies 7.1.9. Topiqu leaves
  MJML `minify` at its default `false`; do not force a global CSSnano major over
  MJML's dependency. All 36 mail rendering/diagnostic/transport tests pass.
- `unstorage@1.17.6` requests ioredis `^5.4.2`, while the app uses ioredis 6.0.0.
  Topiqu imports ioredis directly in its cache utility and uses `useStorage` only
  for bundled locale/mail assets; no unstorage Redis driver configuration was
  found. Enabling that driver requires its own integration check.
- Prisma's nested `c12@3.1.0` requests optional magicast `^0.3.5`, but resolves
  0.5.5. This is configuration tooling, not a request handler. Current schema
  generation already passed; keep this mismatch visible for future CLI changes.

The failed SEO 6 / OG 7 candidate added optional fontless/unifont peer mismatches;
they disappeared after the separately documented Bun compatibility hold restored
SEO 5.3.16 / OG 6.10.4 / Takumi 1.8.7. Do not force those transitive majors to make
the rejected candidate install.

The three historical DevTools/Image/UI patches remain removed. The manifest and
lock now contain one separate, narrow patch:
`unhead@3.4.3 → patches/unhead@3.4.3.patch`. It deletes completed entries from the
DOM renderer's previous cleanup map immediately after invoking each callback;
the preceding image's repeated-navigation check exposed retained DOM through
those callbacks. Targeted regressions and a frozen installation passed, and the
replacement artifact's source map and emitted code confirm inclusion. The parent
100-cycle check passed on the Unhead-fix checkpoint; the final-image qualification
is recorded above. Installed DevTools 3.4.4 no longer
imports simple-git, and UI 4.12.0 uses named Reka imports for
dropdown/popover components. Image 2.2.0 still registers its legacy Node handler
under Nitro 2; upgrading alone does not replace the removed Bun compatibility
patch. Topiqu's narrow `nitro.build:before` hook recognizes the actual module's
extensionless handler path as well as its `.js` form and selects the authored
`server/runtime/ipx.ts` Fetch bridge. Module-generated storage, TTL, aliases and
host restrictions remain authoritative. A regression loads the installed Nuxt
Image module instead of assuming its registered path; compiled native image smoke
then verifies MIME/cache/conditional responses and denied hosts. No package patch
or special `srvx/node` trace is required by this selected bridge. Locale switching,
popovers and author cards remain part of the compiled browser release contract;
source equivalence alone does not prove those behaviors.

## Evidence and remaining checks

- Registry audit files: `/tmp/topiqu-dependency-audit-all-20261022.json` and
  `/tmp/topiqu-dependency-audit-prod-20261022.json`; metadata snapshot:
  `/tmp/topiqu-advisory-package-metadata-20261022.json`.
- Reviewed `package.json`, `bun.lock`, the baseline/selected dependency matrix,
  installed consumer metadata/source, and all three deleted patches. The baseline
  matrix retains original versions; current manifest/lock are the current graph.
- This audit ran no installation, automatic fix, production operation, or paid
  provider call. Frozen installation, complete tests/typecheck, Linux build and
  artifact/release smoke are owned by the parent validation run.
- Separate guard regression repaired during this review: the static tenant guard
  scanner now recognizes `requirePublicationDraft`, whose actual shared function
  requires `INTEGRATION_CONTROL`, admin/superadmin role and an undeleted,
  membership-tenant-scoped enhanced draft lookup. No exemption was added. Focused
  guard + publication authorization tests passed **2 files / 14 tests**.

Audit semantics and non-mutating behavior follow the [official Bun audit
documentation](https://bun.com/docs/pm/cli/audit).
