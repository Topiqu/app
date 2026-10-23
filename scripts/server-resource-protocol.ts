import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync, statSync } from 'node:fs'

const MiB = 1024 * 1024

/** Fixed before measurement; a short smoke run never satisfies the sustained gate. */
export const RESOURCE_POLICY = Object.freeze({
  warmupMs: 10 * 60_000,
  measuredMs: 60 * 60_000,
  cooldownMs: 5 * 60_000,
  sampleIntervalMs: 10_000,
  maxSampleGapMs: 25_000,
  requestIntervalMs: 500,
  requestTimeoutMs: 10_000,
  abortAfterMs: 2,
  concurrency: 4,
  maxResponseBytes: 2 * MiB,
  windowMs: 5 * 60_000,
  heapGrowthBytes: 16 * MiB,
  heapGrowthRatio: 0.2,
  rssGrowthBytes: 64 * MiB,
  rssGrowthRatio: 0.25,
  externalGrowthBytes: 16 * MiB,
  heapSlopeBytesPerMinute: MiB,
  rssSlopeBytesPerMinute: 2 * MiB,
  fdGrowth: 8,
  socketGrowth: 8,
  dbConnectionGrowth: 2,
  maxDbConnections: 10,
  maxWaitingDbConnections: 0,
  eventLoopP95Ms: 50,
  eventLoopMaxMs: 1000,
})

// Every request is a read. Invalid comment sort fails before a DB/provider call.
export const RESOURCE_ROUTES = Object.freeze([
  { name: 'feed', path: '/api/articles/by-clientsite/topiqu-dev?take=10&locale=cs', status: 200 },
  { name: 'article', path: '/cs/clanky/jak-postavit-udrzitelnou-redakci', status: 200 },
  { name: 'live', path: '/api/live', status: 200 },
  { name: 'article', path: '/cs/clanky/jak-postavit-udrzitelnou-redakci', status: 200 },
  { name: 'ready', path: '/api/health', status: 200 },
  { name: 'feed', path: '/api/articles/by-clientsite/topiqu-dev?take=10&locale=cs', status: 200 },
  { name: 'validation', path: '/api/comments/resource-protocol?sort=invalid', status: 400 },
  { name: 'missing', path: '/api/articles/by-clientsite/resource-protocol-missing', status: 404 },
  { name: 'asset', path: '/topik_normal_rm.png', status: 200 },
  { name: 'abort', path: '/cs/clanky/jak-postavit-udrzitelnou-redakci', status: 200, abort: true },
] as const)

export const localResourceOrigin = (value: string) => {
  const url = new URL(value)
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('RESOURCE_ORIGIN_MUST_BE_EXPLICIT_LOOPBACK_HTTP_PORT')
  return url.origin
}

export const resourceDatabaseTarget = (value: string, expectedName: string) => {
  const url = new URL(value)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^[a-z][a-z0-9_]{0,62}$/i.test(expectedName) ||
    !/(^|_)test(_|$)/i.test(expectedName) ||
    decodeURIComponent(url.pathname.slice(1)) !== expectedName ||
    [...url.searchParams].some(([key, entry]) => key !== 'schema' || entry !== 'public') ||
    url.hash ||
    !url.port
  )
    throw new Error('RESOURCE_DATABASE_MUST_MATCH_EXPLICIT_LOCAL_TEST_TARGET')
  return value
}

export interface ResourceSample {
  timestampMs: number
  rss: number
  heapUsed: number
  external: number
  jscHeapSize: number
  rssOutsideJsHeapEstimate: number
  fdCount: number | null
  socketFdCount: number | null
  eventLoopP95Ms: number
  eventLoopMaxMs: number
  sampleDurationMs: number
}

export const percentile = (input: number[], fraction: number) => {
  if (!input.length) return null
  const values = [...input].sort((a, b) => a - b)
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))]!
}

export const lowerEnvelope = (samples: ResourceSample[], field: 'rss' | 'jscHeapSize' | 'external') =>
  percentile(
    samples.map((sample) => sample[field]),
    0.1,
  )

export const resourceGrowth = (samples: ResourceSample[], field: 'rss' | 'jscHeapSize' | 'external') => {
  if (!samples.length) return null
  const start = samples[0]!.timestampMs
  const windows: number[][] = []
  for (const sample of samples) {
    const index = Math.floor((sample.timestampMs - start) / RESOURCE_POLICY.windowMs)
    ;(windows[index] ??= []).push(sample[field])
  }
  const points = windows.flatMap((values, index) => {
    if (values.length < (RESOURCE_POLICY.windowMs / RESOURCE_POLICY.sampleIntervalMs) * 0.8) return []
    const value = percentile(values, 0.1)
    return value === null ? [] : [{ x: (index * RESOURCE_POLICY.windowMs) / 60_000, y: value }]
  })
  if (points.length < 2) return null
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const slope =
    points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) /
    points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0)
  return {
    baseline: points[0]!.y,
    final: points.at(-1)!.y,
    delta: points.at(-1)!.y - points[0]!.y,
    slopeBytesPerMinute: slope,
    windows: points.length,
  }
}

export const evaluateResourceSamples = (samples: ResourceSample[], measuredStartMs: number, measuredEndMs: number) => {
  const measured = samples.filter(
    (sample) => sample.timestampMs >= measuredStartMs && sample.timestampMs <= measuredEndMs,
  )
  const cooldown = samples.filter(
    (sample) => sample.timestampMs > measuredEndMs && sample.timestampMs <= measuredEndMs + RESOURCE_POLICY.cooldownMs,
  )
  const heap = resourceGrowth(measured, 'jscHeapSize')
  const rss = resourceGrowth(measured, 'rss')
  const external = resourceGrowth(measured, 'external')
  const checks = {
    duration: measuredEndMs - measuredStartMs >= RESOURCE_POLICY.measuredMs,
    sampleCoverage: measured.length >= (RESOURCE_POLICY.measuredMs / RESOURCE_POLICY.sampleIntervalMs) * 0.95,
    cooldownCoverage: cooldown.length >= (RESOURCE_POLICY.cooldownMs / RESOURCE_POLICY.sampleIntervalMs) * 0.95,
    sampleContinuity:
      measured.length > 0 &&
      measured[0]!.timestampMs - measuredStartMs <= RESOURCE_POLICY.maxSampleGapMs &&
      measuredEndMs - measured.at(-1)!.timestampMs <= RESOURCE_POLICY.maxSampleGapMs &&
      measured.every(
        (sample, index) =>
          index === 0 ||
          (sample.timestampMs > measured[index - 1]!.timestampMs &&
            sample.timestampMs - measured[index - 1]!.timestampMs <= RESOURCE_POLICY.maxSampleGapMs),
      ),
    heap: Boolean(
      heap &&
      heap.delta <= Math.max(RESOURCE_POLICY.heapGrowthBytes, heap.baseline * RESOURCE_POLICY.heapGrowthRatio) &&
      heap.slopeBytesPerMinute <= RESOURCE_POLICY.heapSlopeBytesPerMinute,
    ),
    rss: Boolean(
      rss &&
      rss.delta <= Math.max(RESOURCE_POLICY.rssGrowthBytes, rss.baseline * RESOURCE_POLICY.rssGrowthRatio) &&
      rss.slopeBytesPerMinute <= RESOURCE_POLICY.rssSlopeBytesPerMinute,
    ),
    external: Boolean(external && external.delta <= RESOURCE_POLICY.externalGrowthBytes),
    eventLoop:
      measured.length > 0 &&
      measured.every(
        (sample) =>
          sample.eventLoopP95Ms <= RESOURCE_POLICY.eventLoopP95Ms &&
          sample.eventLoopMaxMs <= RESOURCE_POLICY.eventLoopMaxMs,
      ),
    fdGrowth: handleGrowth(measured, 'fdCount', RESOURCE_POLICY.fdGrowth),
    socketGrowth: handleGrowth(measured, 'socketFdCount', RESOURCE_POLICY.socketGrowth),
  }
  return {
    checks,
    passed: Object.values(checks).every((value) => value === true),
    heap,
    rss,
    external,
    cooldown: {
      samples: cooldown.length,
      heapLowerEnvelope: lowerEnvelope(cooldown, 'jscHeapSize'),
      rssLowerEnvelope: lowerEnvelope(cooldown, 'rss'),
      externalLowerEnvelope: lowerEnvelope(cooldown, 'external'),
    },
    samples: measured.length,
    observability: {
      applicationCaches: null,
      serverInflight: null,
      nativeAllocatorBytes: null,
      poolWaitingClients: null,
      rssOutsideJsHeapIsEstimate: true,
    },
  }
}

const handleGrowth = (samples: ResourceSample[], field: 'fdCount' | 'socketFdCount', limit: number) => {
  if (!samples.length || samples.some((sample) => sample[field] === null)) return null
  const first = percentile(
    samples.slice(0, 30).map((sample) => sample[field]!),
    0.5,
  )!
  const last = percentile(
    samples.slice(-30).map((sample) => sample[field]!),
    0.5,
  )!
  return last - first <= limit
}

export const executeResourceRequest = async (
  origin: string,
  route: (typeof RESOURCE_ROUTES)[number],
  fetcher: typeof fetch = fetch,
) => {
  const controller = new AbortController()
  const started = performance.now()
  const timer = setTimeout(
    () => controller.abort(),
    'abort' in route ? RESOURCE_POLICY.abortAfterMs : RESOURCE_POLICY.requestTimeoutMs,
  )
  try {
    const response = await fetcher(new URL(route.path, origin), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    })
    let bytes = 0
    if (response.body) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > RESOURCE_POLICY.maxResponseBytes) {
            await reader.cancel()
            return { outcome: 'oversized', durationMs: performance.now() - started, bytes }
          }
        }
      } finally {
        reader.releaseLock()
      }
    }
    return {
      outcome: response.status === route.status ? 'expected' : 'unexpectedStatus',
      status: response.status,
      durationMs: performance.now() - started,
      bytes,
    }
  } catch {
    return {
      outcome: controller.signal.aborted ? ('abort' in route ? 'aborted' : 'timeout') : 'networkError',
      durationMs: performance.now() - started,
      bytes: 0,
    }
  } finally {
    clearTimeout(timer)
  }
}

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))

export const evaluateResourceWorkload = (workload: {
  measuredOffered: number
  measuredSkipped: number
  measuredOutcomes: Record<string, number>
  peakInflight: number
  measuredStartMs: number
  measuredEndMs: number
  db: {
    failures: number
    samples: { timestampMs: number; total: number; idleInTransaction: number; waiting: number }[]
  } | null
}) => {
  const samples =
    workload.db?.samples.filter(
      (sample) => sample.timestampMs >= workload.measuredStartMs && sample.timestampMs <= workload.measuredEndMs,
    ) ?? []
  return {
    offered: workload.measuredOffered >= (RESOURCE_POLICY.measuredMs / RESOURCE_POLICY.requestIntervalMs) * 0.95,
    noAdmissionDrops: workload.measuredSkipped === 0,
    allRequestsSettled:
      Object.values(workload.measuredOutcomes).reduce((sum, count) => sum + count, 0) ===
      workload.measuredOffered - workload.measuredSkipped,
    boundedClientInflight: workload.peakInflight <= RESOURCE_POLICY.concurrency,
    expectedResponses: Object.entries(workload.measuredOutcomes).every(
      ([key, count]) => ['expected', 'aborted'].includes(key) || count === 0,
    ),
    dbCoverage: workload.db
      ? workload.db.failures === 0 &&
        samples.length >= (RESOURCE_POLICY.measuredMs / RESOURCE_POLICY.sampleIntervalMs) * 0.95
      : null,
    dbBounded: workload.db
      ? samples.length > 0 &&
        samples.every(
          (sample) =>
            sample.total <= RESOURCE_POLICY.maxDbConnections &&
            sample.idleInTransaction === 0 &&
            sample.waiting <= RESOURCE_POLICY.maxWaitingDbConnections,
        )
      : null,
    dbGrowth:
      workload.db && samples.length
        ? percentile(
            samples.slice(-30).map((sample) => sample.total),
            0.5,
          )! -
            percentile(
              samples.slice(0, 30).map((sample) => sample.total),
              0.5,
            )! <=
          RESOURCE_POLICY.dbConnectionGrowth
        : null,
  }
}

async function runWorkload(config: {
  origin: string
  confirmation: string
  databaseUrl?: string
  expectedDatabase?: string
}) {
  if (config.confirmation !== 'dedicated-local-server-resource-test') throw new Error('RESOURCE_CONFIRMATION_REQUIRED')
  const origin = localResourceOrigin(config.origin)
  const database = config.databaseUrl ? resourceDatabaseTarget(config.databaseUrl, config.expectedDatabase ?? '') : null
  const { Client } = database ? await import('pg') : { Client: null }
  const client =
    Client && database
      ? new Client({
          connectionString: database,
          application_name: 'topiqu-resource-observer',
          connectionTimeoutMillis: 3000,
          statement_timeout: 3000,
          query_timeout: 3000,
        })
      : null
  const startedAtMs = Date.now()
  const outcomes: Record<string, number> = {}
  const statusCodes: Record<string, number> = {}
  const routes: Record<string, number> = {}
  const latencyBuckets = Array.from({ length: 16 }, () => 0)
  const dbSamples: {
    timestampMs: number
    total: number
    active: number
    idle: number
    idleInTransaction: number
    waiting: number
  }[] = []
  const measuredOutcomes: Record<string, number> = {}
  let dbFailures = 0
  let lastDbSample = 0
  let offered = 0
  let skipped = 0
  let peakInflight = 0
  let measuredOffered = 0
  let measuredSkipped = 0
  client?.on('error', () => {
    dbFailures++
  })
  const active = new Set<Promise<void>>()
  try {
    await client?.connect()
    for (const route of RESOURCE_ROUTES) {
      if ('abort' in route) continue
      if ((await executeResourceRequest(origin, route)).outcome !== 'expected')
        throw new Error('RESOURCE_HTTP_PREFLIGHT_FAILED')
    }
    const loadUntil = startedAtMs + RESOURCE_POLICY.warmupMs + RESOURCE_POLICY.measuredMs
    const endAt = loadUntil + RESOURCE_POLICY.cooldownMs
    while (Date.now() < endAt) {
      if (client && Date.now() - lastDbSample >= RESOURCE_POLICY.sampleIntervalMs) {
        lastDbSample = Date.now()
        try {
          const result = await client.query<{
            total: string
            active: string
            idle: string
            idleInTransaction: string
            waiting: string
          }>(`SELECT count(*) AS total,
            count(*) FILTER (WHERE state = 'active') AS active,
            count(*) FILTER (WHERE state = 'idle') AS idle,
            count(*) FILTER (WHERE state LIKE 'idle in transaction%') AS "idleInTransaction",
            count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting
            FROM pg_stat_activity WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`)
          const row = result.rows[0]!
          dbSamples.push({
            timestampMs: Date.now(),
            total: Number(row.total),
            active: Number(row.active),
            idle: Number(row.idle),
            idleInTransaction: Number(row.idleInTransaction),
            waiting: Number(row.waiting),
          })
        } catch {
          dbFailures++
        }
      }
      if (Date.now() < loadUntil) {
        const measured = Date.now() >= startedAtMs + RESOURCE_POLICY.warmupMs
        if (measured) measuredOffered++
        const route = RESOURCE_ROUTES[offered++ % RESOURCE_ROUTES.length]!
        if (active.size >= RESOURCE_POLICY.concurrency) {
          skipped++
          if (measured) measuredSkipped++
        } else {
          const request = executeResourceRequest(origin, route)
            .then((result) => {
              outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1
              if (measured) measuredOutcomes[result.outcome] = (measuredOutcomes[result.outcome] ?? 0) + 1
              if ('status' in result) statusCodes[String(result.status)] = (statusCodes[String(result.status)] ?? 0) + 1
              routes[route.name] = (routes[route.name] ?? 0) + 1
              latencyBuckets[Math.min(15, Math.floor(Math.log2(Math.max(1, result.durationMs))))]!++
            })
            .finally(() => active.delete(request))
          active.add(request)
          peakInflight = Math.max(peakInflight, active.size)
        }
      }
      await wait(RESOURCE_POLICY.requestIntervalMs)
    }
    await Promise.all(active)
    return {
      kind: 'workload',
      policy: RESOURCE_POLICY,
      startedAtMs,
      measuredStartMs: startedAtMs + RESOURCE_POLICY.warmupMs,
      measuredEndMs: loadUntil,
      finishedAtMs: Date.now(),
      offered,
      skipped,
      measuredOffered,
      measuredSkipped,
      measuredOutcomes,
      peakInflight,
      outcomes,
      statusCodes,
      routes,
      latencyBucketsLog2Ms: latencyBuckets,
      db: client ? { samples: dbSamples, failures: dbFailures, excludesObserver: true } : null,
      observability: { serverInflight: null, applicationCaches: null, poolWaitingClients: null },
      interpretation:
        'Protocol evidence only; does not prove absence of leaks or cover paid/background provider execution.',
    }
  } finally {
    await client?.end()
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2)
    if (args.length === 0 || (args.length === 1 && args[0] === '--plan'))
      console.log(
        JSON.stringify({
          kind: 'plan',
          policy: RESOURCE_POLICY,
          routes: RESOURCE_ROUTES,
          observability: { applicationCaches: null, serverInflight: null, nativeAllocatorBytes: null },
          totalDurationMs: RESOURCE_POLICY.warmupMs + RESOURCE_POLICY.measuredMs + RESOURCE_POLICY.cooldownMs,
        }),
      )
    else if (args.length === 1 && args[0] === '--run') {
      const input = await Bun.stdin.text()
      if (input.length > 16_384) throw new Error('RESOURCE_CONFIG_TOO_LARGE')
      console.log(JSON.stringify(await runWorkload(JSON.parse(input))))
    } else if (args.length === 3 && args[0] === '--report') {
      if (statSync(resolve(args[2]!)).size > 2 * MiB || statSync(resolve(args[1]!)).size > 2 * MiB)
        throw new Error('RESOURCE_EVIDENCE_TOO_LARGE')
      const workloadText = readFileSync(resolve(args[2]!), 'utf8')
      const sampleText = readFileSync(resolve(args[1]!), 'utf8')
      if (workloadText.length > 2 * MiB || sampleText.length > 2 * MiB) throw new Error('RESOURCE_EVIDENCE_TOO_LARGE')
      const workload = JSON.parse(workloadText)
      if (!Object.entries(RESOURCE_POLICY).every(([key, value]) => workload.policy?.[key] === value))
        throw new Error('RESOURCE_EVIDENCE_POLICY_MISMATCH')
      const records = sampleText
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      const sampler = records[0]
      if (
        sampler?.kind !== 'sampler' ||
        sampler.runtime !== 'bun' ||
        sampler.platform !== 'linux' ||
        sampler.runtimeVersion !== '1.4.4' ||
        sampler.nodeEnv !== 'production' ||
        sampler.schedulerTestFlag !== true ||
        !/^[a-f0-9]{64}$/.test(sampler.entrypointSha256 ?? '') ||
        sampler.intervalMs !== RESOURCE_POLICY.sampleIntervalMs ||
        sampler.forcedGc !== false
      )
        throw new Error('RESOURCE_EVIDENCE_REQUIRES_BUN_LINUX')
      const samples = records.filter((row) => row.kind === 'sample') as ResourceSample[]
      const resources = evaluateResourceSamples(samples, workload.measuredStartMs, workload.measuredEndMs)
      const checks = { ...resources.checks, ...evaluateResourceWorkload(workload) }
      const passed = Object.values(checks).every((value) => value === true)
      console.log(
        JSON.stringify({
          kind: 'evaluation',
          runtime: {
            version: sampler.runtimeVersion,
            platform: sampler.platform,
            architecture: sampler.architecture,
            nodeEnv: sampler.nodeEnv,
            schedulerTestFlag: sampler.schedulerTestFlag,
            entrypointSha256: sampler.entrypointSha256,
          },
          policy: RESOURCE_POLICY,
          ...resources,
          checks,
          passed,
          status: Object.values(checks).some((value) => value === null)
            ? 'incomplete'
            : passed
              ? 'within-declared-bounds'
              : 'investigate',
        }),
      )
      if (!passed) process.exitCode = 1
    } else throw new Error('RESOURCE_USAGE_PLAN_RUN_OR_REPORT')
  } catch {
    console.log(
      JSON.stringify({
        kind: 'error',
        code: 'RESOURCE_PROTOCOL_FAILED',
        detail:
          'Check the declared local target, config format, evidence files and runtime; no input or credentials are printed.',
      }),
    )
    process.exitCode = 1
  }
}
