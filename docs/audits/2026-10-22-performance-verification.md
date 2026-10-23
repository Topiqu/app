# Performance verification — 2026-10-22

This records the bounded local/ARM64 verification requested by the user. The
browser lifetime screen, compiled IPX/native image responses and focused browser
checks passed at the checkpoints identified below. Production rollout and field
performance measurements are separate operations.

## Comparable build measurements

The baseline is an isolated read-only Git archive of `a11e5bc4`, including the
user's navigation changes. Its frozen dependency install and build passed using
stable Bun1.4.4, matching the current host build runtime. Both macOS arm64 builds
used `APP_ENV=production`, the browser-test build flag, empty telemetry credentials
and a synthetic database target. No application request was made to production.
The baseline build target was unreachable; the build needed no database access.

The repository's existing performance checker and unchanged budgets measured
gzip bytes from each emitted manifest. The following current host measurement
preceded the final server lifecycle and MediaLibrary retention corrections.
It is retained as historical matched evidence; the final ARM64 artifact has its
own checks below. Additional comparison builds were deferred when the user
narrowed verification to local/ARM64 operation.

| Measurement              | Baseline | Current host | Change |
| ------------------------ | -------: | -----------: | -----: |
| Entry JavaScript         |   374005 |       391881 | +4.78% |
| Publication JavaScript   |   512073 |       512353 | +0.05% |
| Article JavaScript       |   542928 |       558336 | +2.84% |
| Editor shell JavaScript  |   483739 |       483587 | −0.03% |
| Largest JavaScript chunk |   126916 |       126730 | −0.15% |
| Total JavaScript         |  1365481 |      1411696 | +3.38% |
| Total CSS                |    44737 |        45172 | +0.97% |

All seven original budgets passed for both builds. Dependency upgrades and
correctness changes did not produce a universal client-size reduction. Do not
attribute changes to a single optimization without a controlled comparison.
Nitro reported125MB/34.4MB gzip for the baseline server output and95.3MB/28.1MB
gzip for the current host output. These are its aggregate output figures, not
resident memory or a matched Linux-container size comparison.

The final Linux arm64 production image, built without the browser-test flag
or database credentials, passed the same seven unchanged budgets:

| Measurement              | Final image | Original ceiling |
| ------------------------ | ----------: | ---------------: |
| Entry JavaScript         |      388896 |           450560 |
| Publication JavaScript   |      506361 |           655360 |
| Article JavaScript       |      552402 |           696320 |
| Editor shell JavaScript  |      478393 |           634880 |
| Largest JavaScript chunk |      126679 |           163840 |
| Total JavaScript         |     1399914 |          1740800 |
| Total CSS                |       45172 |            81920 |

All values are gzip bytes from the emitted manifest. The exact image is
`sha256:ddb1cb4d7bfea298f278d8ba3e8dc09557510dffca5a5ee8e1ed85bbb6a831ee`.
Its configuration differs from the host browser fixture, so these figures are
not a matched optimization delta. Final inspection passed24 compiled/policy
checks and verified five Linux ARM64 native ELF binaries; it did not run the app.

Build timings are not used as speedup evidence: cache warmth and concurrent
host/container work differed. Field p75 LCP/INP/CLS targets require representative
production measurements after an authorized rollout.

## Final build resource investigation

The former Bun-forced Linux arm64 Docker recipe passed frozen installation and
Vite's client/SSR compilation, then was killed during Nitro bundling with `ENOMEM`.
The VM exposes ten CPUs and about8GiB RAM; no individual build cgroup cap was
set. Another uninstrumented attempt was canceled after about twelve minutes of
severe swapping, without a compiler diagnostic. Cancellation is not acceptance.

A private diagnostic recipe completed compilation and image export, but its
thirty-second JSC heap enumeration eventually took11.309seconds per call,
materially perturbing the build. A later successful observer used only cheap
process/cgroup counters and package/source-byte counts, without heap walks or
forced collection. It recorded1,834parsed modules/15,642,887source bytes; only
932,526bytes of parsed modules were unreachable from the Rollup entry. Nitro's
separate external trace consumed42.817seconds for8,049files, then later rendering
also increased memory. Maximum simultaneous cgroup resident-plus-swap usage was
11,514,109,952bytes. These observations do not establish a single leaking module
or justify disabling dependency analysis, source maps or safety checks.

Private forced-GC and allocator-delay experiments did not reach acceptance and
were not shipped. The accepted change aligns Nuxt compilation with the existing
CI Node24.21.0 path. Docker copies only that binary into the prerelease stage and
sets a command-local4096MiB Node old-space limit. Bun1.4.4 still installs and
prepares dependencies, generates ZenStack, packages migrations and runs the final
Bun-preset server. The released image contains no copied compiler binary, compiler
PATH or NODE_OPTIONS; normal Bun runtime defaults and full maps/tracing remain.

The actual uninstrumented repository Dockerfile then passed compilation, migration
packaging without database access and image export, producing the final image
identified above after applying the Unhead cleanup and accessible-name fixes.
Nuxt reported6m19s for this final shared-host build;
timings are not a controlled speedup claim.
The preceding private Node comparison also exported successfully;30second samples
observed up to5,213,118,464bytes RSS. That sampled value is not an exact peak or a
guarantee for larger future source graphs. The user subsequently confirmed that
local/ARM64 operation is sufficient. The AMD64 build was intentionally canceled
with exit130; no AMD64 build/runtime acceptance is claimed.

The first preload experiment also exposed a Bun run-script argument trap:
space-separated `--preload path` in the combined `BUN_OPTIONS` printed help and
exited zero without building. A private two-stage fixture on verified stable Bun
1.4.4 reproduced that behavior on macOS and Linux. `--preload=path` profiled both
child stages while retaining `--smol`. The invalid image is excluded from evidence;
diagnostic recipes now assert real server/client output before migration packaging.
The former [`--smol` option](https://bun.com/docs/runtime#bun-run-smol) was a
build-only experiment, not a hard memory cap; it is no longer needed by the
accepted compiler path.

## Browser lifetime evidence

The first complete run used10 warm-up cycles, five baseline samples and100
measured editor/media/history/avatar-preview cycles in one SPA document, with
post-cleanup GC checkpoints every ten cycles. It failed the predefined policy:

| Post-cleanup metric        | Warm median | Tail median |
| -------------------------- | ----------: | ----------: |
| JS heap bytes              |    90678368 |   761448700 |
| DOM nodes                  |       28090 |      301302 |
| Event listeners            |        3449 |       36661 |
| Detached nodes             |       38162 |      451961 |
| Destroyed Editor instances |           8 |         100 |

A separate five-cycle probe without per-cycle CDP inspection still retained all
five destroyed Editors. A private synthetic heap snapshot proved a strong root
through `Window.__nuxt_app_ctx__ → nuxtApp._asyncData → media-library:<useId>:… →
_off/context → Vue component tree → editor`. The application retention is real.
The snapshot also found a separate Playwright Clock scheduling-stack root for
five-minute query-cache timers. Thus the first run mixes application retention
with instrumentation retention; the whole heap delta cannot be attributed to the
application alone. A real-clock rerun is required after fixing the application
callback ownership. The original workload and growth thresholds stay unchanged.

After the MediaLibrary callback correction, a real-clock100-cycle run no longer
failed the heap/Editor growth gates, but still failed nodes/listeners/detached-node
growth: warm/tail nodes9098/13059, listeners978/1162 and detached nodes10008/16477.
Private retaining paths then identified History and TagsManager component-owned
cache callbacks. A20-cycle probe also found exactly20 detached file inputs rooted
in DevTools global handles, matching undisposed Playwright file choosers. The
harness now disposes those handles in `finally`; this repairs measurement ownership
without changing the exercised preview flow, checkpoint policy or growth limits.
The subsequent ARM64 `f5074a4f…` checkpoint completed all100measured cycles.
No destroyed/live Editors remained; listeners stayed410, object URLs balanced
110created/110revoked, and page/console/hydration/rejection/mutation counters were
zero. Heap30,131,496B warm median versus33,164,300B tail passed the declared
noise/slope policy. However, DOM nodes3204→6337 and detached nodes662→6918 failed
their unchanged gates: exactly34DOM nodes/68detached-node references per cycle.
This is a failed retention screen, not final acceptance.

A separate20cycle private capture across three articles also retained zero Editors.
Its strong retaining paths identified Unhead3.4.3's completed DOM cleanup callbacks:
`usehead._dom._p → cleanup closure → earlier render context → previous cleanup map`.
The snapshot contained360detached link nodes and317meta nodes. Removing an already
executed callback from that old map breaks the chain. The current stable release
was rechecked as3.4.3; the version-scoped Bun patch deletes each callback only after
it succeeds, preserving error ordering and live callback ownership. A real Unhead
document-switch regression failed before the fix with cleanup called twice, then
23head/SEO/toolchain tests and frozen installation passed. The patched ARM64 image
`ac902af1…` then passed the unchanged100-cycle compiled screen with native time:
warm/tail DOM nodes2935/2935, listeners410/410, detached-node references124/124
and documents105/105. No live or destroyed Editors remained. Heap warm median
29,994,840B and tail32,331,132B passed the declared noise/slope policy. All110
object URLs were revoked;110 reads were canceled. Page, console, hydration,
unhandled-rejection and forbidden-mutation counters were zero. This is evidence
for the exercised workload, not a guarantee against every possible memory leak.

The subsequent17-case desktop check passed11 cases: all eight core-web-vitals
contracts, editor conflict/history, session revocation and wallet scrolling.
The two custom-domain cases use HTTP virtual hosts; the actual production CSP
upgrades their scripts to HTTPS, where this local fixture has no TLS listener.
They require the intended browser-test build or a TLS fixture and are outside
the narrowed local/ARM64 closeout; product CSP remains intact. Three new lifecycle
cases exposed harness synchronization issues, subsequently corrected without
changing the original deadlines. The seeded publication uses localhost;127.0.0.1
is a platform host. Logout now waits for a genuinely new document, while abandoned
pre-network script routes are not assumed to emit a network-abort event. Readiness
checks retain the original browser-error assertions and10second deadline, activate
late visible SPA images, and leave CSS-hidden responsive variants lazy.

All three real lifecycle cases then passed on the final `ddb1cb4d…` artifact in
6.3seconds: account A logout/account B/offline privacy, real media-read cancellation
with SPA unmount, and departure from an unhydrated SSR editor. All three production
workflows passed on that same artifact, including editor conflict/history, session
revocation and operations accessibility. The account trigger uses a decorative
photo/account icon instead of a duplicate initial; the wallet's native accessible
name includes its visible content. All five release-smoke cases passed again in
5.6seconds after the helper correction. These static label and test-harness changes
do not alter the application lifecycle, so the100-cycle screen was not repeated.

The existing wallet pagination/scrolling case also passed at360×800 with touch
emulation in Chromium against the final artifact (one case,2.6seconds). The default
mobile project uses WebKit, which upgraded130 local `/_nuxt/` requests to HTTPS
under the production CSP; the HTTP-only fixture has no TLS listener, so that run
could not hydrate. WebKit/TLS acceptance and the two virtual-host cases are
explicitly deferred. Product CSP and the repository browser matrix are unchanged;
the viewport check used a private Chromium configuration. Additional four-locale,
tablet/dark and broad browser matrices were not run under the reduced local scope.

Only scalar synthetic measurements are suitable as durable evidence. Private
heap snapshots contain synthetic fixture state and must not be committed or
shared as reports. The full JSON reporter's environment configuration was removed;
the retained resource attachment contains counts and protocol metadata only.

## Native shutdown evidence

The upstream Bun entry reproduced exit137 after Docker's ten-second stop grace,
with OOMKilled=false. The authored lifecycle subsequently passed five real
Linux/Bun1.4.4 child-process cases: successful streaming drain, a clean stop after
an earlier reported error, unfinished-stream deadline, stalled closer and rejected
closer. Both signals were observed in every case; successful cases exited0,
failure/deadline cases exited1, and the outer force-kill guard was never needed.

Two actual compiled application containers then stopped in0.325s/0.163s with
exit0, and zero application connections remained in the isolated resource DB.
This proves those observed shutdown paths, not recovery from arbitrary provider
failures or abrupt termination.

The earlier `f5074a4f…` Node-compiled ARM64 checkpoint independently passed normal entrypoint startup,
exact stable Bun revision, UID1000, WebP/CSP/cache headers, conditional304 and denied
remote-host checks. Six compiled HTTP cases verified inclusive2,000,000byte ordinary
and16MiB multipart ceilings, excess-byte rejection and chunked intake. Real Takumi
rendering produced a312,319byte1200×600PNG, then reused byte-identical cached output.
The smoke pins the unchanged signed canonical path to loopback, without contacting
the canonical production host. This same container stopped in0.378seconds with
exit0/OOMKilled=false; a separate single-connection PostgreSQL observer confirmed
zero remaining application connections.

The final `ddb1cb4d…` image independently passed normal migration entrypoint startup,
stable Bun revision38af/UID1000, all six compiled HTTP body cases, all five compiled
release-smoke cases and real Takumi rendering/cache reuse of the same312,319byte
1200×600PNG. Its fresh artifact inspection passed24checks, five native ARM64 ELF
binaries and all seven original size budgets.
After the focused browser checks, it stopped in346ms with exit0/OOMKilled=false.
A separate single-connection PostgreSQL observer found zero remaining application
connections in the isolated browser database. The exact owned test container was
removed; the verified image remains available locally. Local/ARM64 closeout is
complete. Production releases/migrations and remote CI were not run.

## Sustained server protocol

The policy and observability limits are fixed in
[the server resource protocol](2026-10-22-server-resource-protocol.md): ten-minute
warm-up, sixty measured minutes, five-minute cooldown, bounded read-only traffic
and an isolated database observer. It has not completed. The user subsequently
requested proportionate local/ARM64 verification; this75minute stress experiment
and additional comparison builds are deferred outside that reduced acceptance
scope. Prepared code and short smoke checks are not recorded as a duration pass.

An isolated warm-up diagnostic ran on Linux arm64 image
`6bf5ab286e51e7762d9a3c8a52673f94d8eb2f644600a7cb83ee000b5bfa6b68`.
It was stopped before measured load so the final experiment can include newly
confirmed request-limit and public-visibility corrections. It does not satisfy
the duration gate. The application had only an internal Docker network connected
to the dedicated local PostgreSQL fixture; a separate fixed-target GET/HEAD proxy
provided host ingress on Docker Desktop. The proxy is outside the measured app
process, and2ms client aborts still do not guarantee server-side cancellation.
Preflight confirmed131 migrations, two BASIC fixtures, three users/three articles
and zero provider integrations, paid jobs, pending sentiment, webhooks or AI usage.
