# Opt-in server resource protocol — declared before measurement

Status: tooling prepared; the sustained run has **not** been performed. These
thresholds are investigation gates for this workload, not proof that leaks cannot
exist. Keep this policy unchanged after a failed run; investigate the failure and
declare any revised experiment before collecting new measurements.

## Target and isolation

The operator must record the exact tested image digest, Bun version, architecture,
CPU/memory/container limits and compiled `server/index.mjs` hash. Use the built
production artifact on Bun 1.4.4/Linux. Do not rebuild with test-only application
settings or change its handlers. The sampler is an explicitly enabled preload;
the workload driver runs separately.

Use a separately verified, local **dedicated test database** with the existing
`prisma/seed.ts` synthetic BASIC fixtures (`topiqu-dev` and the fixed article).
The workload requires `http://localhost:PORT` so SSR resolves the seeded localhost
tenant. Verify migrations and seed only through the authorized isolated-target
runner; these diagnostics never migrate, seed or delete data.

The production artifact includes compiled scheduled tasks. Setting a runtime
`TEST_DATABASE_URL` does not retroactively disable their build-time schedule.
For this isolated HTTP resource experiment, the operator confirms Nitro's
`startScheduleRunner` / std-env `isTest` behavior and sets **`TEST=1` while keeping
`NODE_ENV=production`** to suppress scheduled execution. The sampler records this
explicit deviation from normal production scheduling; evaluation requires it.
Before starting, the operator must verify that the dedicated database contains no
eligible paid AI jobs, provider integrations, pending mail/webhooks, or other
outbound work. Supply no real provider/mail/Stripe credentials and block external
egress while permitting the dedicated local database. Do not run against a
production database or a port forwarded to a production service. Clear proxy
environment variables for the local driver. No other test suite should use this
database during measurement.

The normal Docker entrypoint first applies migrations. After the operator has
verified and prepared the dedicated target, start the **same compiled server**
directly with the additional diagnostic preload, bypassing that entrypoint:

```text
bun --no-env-file --no-install --preload /diagnostics/server-resource-preload.ts /usr/src/app/server/index.mjs
```

Mount the two diagnostic scripts read-only together under `/diagnostics`. Set
`TOPIQU_RESOURCE_PROTOCOL=1` and
`TOPIQU_RESOURCE_SAMPLE_FILE=/evidence/server.jsonl`, with `NODE_ENV=production`
and `TEST=1`; mount an existing writable
evidence directory owned by the container user. The file is created exclusively
with mode 0600; an existing file is never overwritten. Root supplies the exact
container command, private environment and target. This document is not authority
to start a server or apply migrations elsewhere.

## Workload and collection

Before measurement, save the JSON emitted by:

```bash
bun --no-env-file scripts/server-resource-protocol.ts --plan
```

The default command only prints the plan. Execution requires `--run` and an
explicit confirmation in JSON delivered through a **private stdin runner**.
Never place connection credentials in command arguments, shell history, logs or
tracked files. The private input shape is:

```json
{
  "confirmation": "dedicated-local-server-resource-test",
  "origin": "http://localhost:4183",
  "expectedDatabase": "EXACT_APPROVED_TEST_DATABASE_NAME",
  "databaseUrl": "SUPPLIED_PRIVATELY_BY_OPERATOR"
}
```

`databaseUrl` is optional for a diagnostic probe, but without it the complete
protocol result is **incomplete**. Only explicit loopback PostgreSQL URLs with the
exact supplied test-name segment are accepted. Query parameters that could
override the host or connection are rejected; only `schema=public` is permitted.

The driver checks the expected route statuses before load. It then runs ten
minutes of warm-up, sixty minutes of measured load, and five minutes without HTTP
load. It offers at most two GET requests per second, retains at most four active
promises and creates no waiting request queue. Responses are drained and discarded
with a 2 MiB limit and ten-second deadline. Redirects are never followed.

The deterministic mix includes the public fixture feed, article SSR, liveness,
DB readiness, one local image, invalid comment sort (400 before DB lookup), an
absent publication (404), and an article request interrupted after 2 ms. A fast
response can finish before that cancellation; the report distinguishes completed
requests from observed aborts. This does not guarantee every cancellation reached
the server or exercise a slow upstream/provider stream. No authentication, write,
AI, mail, Stripe or provider endpoint is called by the driver.

The preload samples every ten seconds: process RSS/heap/external/ArrayBuffer
memory; JSC heap size/capacity/external size/object counts; Linux descriptor and
socket counts; thread count; and timer delay in fixed histogram bins. It performs
no forced GC and does not replace server handlers, retain requests, install error
handlers, or intercept shutdown signals. Its own timers are unref'ed, and evidence
is capped at 510 samples (85 minutes). Sampling failures stop diagnostics rather
than crash the application; missing samples fail evidence coverage.

`rssOutsideJsHeapEstimate` is **RSS minus the JSC heap**, not a precise native
allocator measurement. RSS includes native allocations, code, mappings and other
resident pages. Exact allocator bytes, application cache cardinality, server-side
in-flight requests and DB pool waiters are explicitly reported as unavailable.
Only client-side in-flight work is bounded/observable here.

The optional PostgreSQL observer has one connection and a three-second query
deadline. It records only numeric counts for the current dedicated database:
active/idle/idle-in-transaction/lock-waiting/total client connections, excluding
itself. It does not read query text, account identities or customer rows. All
outputs are JSON metric aggregates; HTTP bodies and private input are omitted.

## Gates fixed before the run

| Signal                     | Declared gate                                                                                                                                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duration / coverage        | At least 60 measured minutes; >=95% of ten-second samples, no measured gap over 25 seconds, and >=95% cooldown sample coverage. Short or incomplete evidence cannot pass.                                                                       |
| JSC heap lower envelope    | Five-minute-window p10 endpoint growth <= max(16 MiB, 20% of initial measured window), and fitted lower-envelope growth <=1 MiB/minute.                                                                                                         |
| RSS lower envelope         | Endpoint growth <= max(64 MiB, 25% of initial measured window), and fitted growth <=2 MiB/minute.                                                                                                                                               |
| External memory            | Lower-envelope endpoint growth <=16 MiB.                                                                                                                                                                                                        |
| File descriptors / sockets | Final five-minute median count exceeds the initial five-minute median by no more than eight each. Unavailable Linux observations make the result incomplete.                                                                                    |
| Event-loop timer delay     | Every measured sample has approximate p95 <=50 ms and maximum <=1,000 ms. Sampling overhead is recorded separately.                                                                                                                             |
| HTTP                       | >=95% of the scheduled measured offers occur, no admission drops, <=4 active client requests, all offered requests settle, and no unexpected status/network failure/timeout/oversized response. Intended aborts are separate expected outcomes. |
| Database                   | >=95% sample coverage, zero observer errors, <=10 app/other connections excluding observer, no observed lock waiter or idle transaction, and final median connections <=initial median+2. No concurrent unrelated clients are permitted.        |

Warm-up is excluded from growth fitting. Five-minute p10 windows reduce normal GC
sawtooth noise; sparse windows are omitted, never filled with invented values.
The idle cooldown's lower envelopes are reported separately. RSS need not return
to cold-start levels: retained runtime/code/public caches can be legitimate, but
sustained unexplained growth requires investigation. These workload-specific
thresholds are not a measured pre-optimization baseline and do not support a
before/after improvement claim.

## Evaluation and limitations

Capture the driver's single final JSON object privately as `workload.json`, then:

```bash
bun --no-env-file scripts/server-resource-protocol.ts --report /LOCAL_EVIDENCE/server.jsonl /LOCAL_EVIDENCE/workload.json
```

Evaluation refuses oversized evidence, non-Bun/Linux sampler metadata and changed
policy values. It also requires Bun 1.4.4, production NODE_ENV, the declared
scheduler isolation and a recorded SHA-256 of the actual entrypoint. It prints
JSON and exits nonzero for failed/incomplete gates.
`within-declared-bounds` describes only the observed signals under this workload.
Review aggregate application/task failures, container exit/OOM status and the
actual container limits alongside it. Keep synthetic evidence and image/source
hashes with the result.

This steady-state, fixed-key GET mix does not exercise cache-cardinality attacks,
authenticated editor workflows, large document/provider streams, paid generation,
uploads, or the full background-worker failure matrix. Those require the separate
focused concurrency, browser and failure tests in the readiness plan. Passing
this run cannot establish that all leaks, races or unwanted exceptions are absent.

The sampler follows Bun's documented [heap measurement APIs](https://bun.com/docs/project/benchmarking)
and [preload mechanism](https://bun.com/docs/runtime). No heap snapshot is taken;
snapshots can contain secrets/content and are outside this aggregate protocol.
