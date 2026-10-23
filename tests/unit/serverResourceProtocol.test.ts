// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  evaluateResourceSamples,
  evaluateResourceWorkload,
  executeResourceRequest,
  localResourceOrigin,
  RESOURCE_POLICY,
  RESOURCE_ROUTES,
  resourceDatabaseTarget,
  type ResourceSample,
} from '../../scripts/server-resource-protocol'

const MiB = 1024 * 1024
const samples = (driftPerMinute = 0): ResourceSample[] =>
  Array.from({ length: 391 }, (_, index) => ({
    timestampMs: index * 10_000,
    rss: 120 * MiB + (driftPerMinute * index) / 6,
    heapUsed: 40 * MiB,
    jscHeapSize: 40 * MiB + (driftPerMinute * index) / 6,
    external: 2 * MiB,
    rssOutsideJsHeapEstimate: 80 * MiB,
    fdCount: 12,
    socketFdCount: 3,
    eventLoopP95Ms: 5,
    eventLoopMaxMs: 15,
    sampleDurationMs: 1,
  }))
afterEach(() => vi.useRealTimers())

describe('opt-in server resource protocol', () => {
  it('accepts only an explicit loopback origin without credentials, paths or redirects', () => {
    expect(localResourceOrigin('http://localhost:4183')).toBe('http://localhost:4183')
    for (const origin of [
      'https://localhost:4183',
      'http://localhost.evil:4183',
      'http://localhost',
      'http://reader:secret@localhost:4183',
      'http://127.0.0.1:4183/private',
      'http://127.0.0.1:4183?redirect=outside',
    ])
      expect(() => localResourceOrigin(origin)).toThrow()
  })

  it('requires the exact explicitly named local test database', () => {
    expect(
      resourceDatabaseTarget(
        'postgresql://test:synthetic@127.0.0.1:55432/topiqu_test_resources',
        'topiqu_test_resources',
      ),
    ).toContain('topiqu_test_resources')
    for (const [url, name] of [
      ['postgresql://127.0.0.1:55432/topiqu', 'topiqu'],
      ['postgresql://127.0.0.1:55432/contest', 'contest'],
      ['postgresql://db.remote:55432/topiqu_test', 'topiqu_test'],
      ['postgresql://127.0.0.1:55432/other_test', 'topiqu_test'],
      ['postgresql://127.0.0.1:55432/topiqu_test?host=database.remote', 'topiqu_test'],
    ])
      expect(() => resourceDatabaseTarget(url!, name!)).toThrow()
  })

  it('drains response bodies, disables redirects and clears the request deadline', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('synthetic fixture'))
    const result = await executeResourceRequest('http://localhost:4183', RESOURCE_ROUTES[0], fetcher)
    expect(result).toMatchObject({ outcome: 'expected', bytes: 17 })
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ method: 'GET', redirect: 'manual' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds response consumption without retaining or printing body content', async () => {
    const result = await executeResourceRequest(
      'http://localhost:4183',
      RESOURCE_ROUTES[0],
      vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(RESOURCE_POLICY.maxResponseBytes + 1))),
    )
    expect(result.outcome).toBe('oversized')
    expect(result).not.toHaveProperty('body')
  })

  it('cancels an interrupted request and disposes its timer without masking it as a server failure', async () => {
    vi.useFakeTimers()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_input, options) =>
          new Promise((_resolve, reject) =>
            options!.signal!.addEventListener('abort', () => reject(new Error('synthetic disconnect')), { once: true }),
          ),
      )
    const pending = executeResourceRequest('http://localhost:4183', RESOURCE_ROUTES[9], fetcher)
    await vi.advanceTimersByTimeAsync(RESOURCE_POLICY.abortAfterMs)
    expect((await pending).outcome).toBe('aborted')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('accepts a complete bounded envelope while declaring inaccessible metrics', () => {
    const result = evaluateResourceSamples(samples(), 0, RESOURCE_POLICY.measuredMs)
    expect(result.passed).toBe(true)
    expect(result.observability).toMatchObject({
      applicationCaches: null,
      serverInflight: null,
      nativeAllocatorBytes: null,
      poolWaitingClients: null,
    })
  })

  it('rejects sustained retained-memory and descriptor growth', () => {
    const drifting = samples(3 * MiB).map((sample, index) => ({ ...sample, fdCount: 12 + Math.floor(index / 4) }))
    const result = evaluateResourceSamples(drifting, 0, RESOURCE_POLICY.measuredMs)
    expect(result.passed).toBe(false)
    expect(result.checks).toMatchObject({ heap: false, rss: false, fdGrowth: false })
  })

  it('cannot certify short runs, missing Linux metrics or long sample gaps', () => {
    expect(evaluateResourceSamples(samples().slice(0, 30), 0, 300_000).checks.duration).toBe(false)
    const missing = evaluateResourceSamples(
      samples().map((sample) => ({ ...sample, fdCount: null })),
      0,
      RESOURCE_POLICY.measuredMs,
    )
    expect(missing.checks.fdGrowth).toBeNull()
    expect(missing.passed).toBe(false)
    const gap = samples().filter((_sample, index) => index < 100 || index > 110)
    expect(evaluateResourceSamples(gap, 0, RESOURCE_POLICY.measuredMs).checks.sampleContinuity).toBe(false)
  })

  it('keeps absent DB observations incomplete and rejects unexpected HTTP results', () => {
    const result = evaluateResourceWorkload({
      measuredOffered: 7200,
      measuredSkipped: 0,
      measuredOutcomes: { expected: 7000, unexpectedStatus: 1 },
      peakInflight: 4,
      measuredStartMs: 0,
      measuredEndMs: RESOURCE_POLICY.measuredMs,
      db: null,
    })
    expect(result).toMatchObject({ expectedResponses: false, dbCoverage: null, dbBounded: null, dbGrowth: null })
  })

  it('detects blocked/idle transactions or connection growth in aggregate test-DB observations', () => {
    const rows = samples().map((sample, index) => ({
      timestampMs: sample.timestampMs,
      total: index < 100 ? 2 : 10,
      idleInTransaction: 0,
      waiting: index === 200 ? 1 : 0,
    }))
    const result = evaluateResourceWorkload({
      measuredOffered: 7200,
      measuredSkipped: 0,
      measuredOutcomes: { expected: 7000, aborted: 200 },
      peakInflight: 4,
      measuredStartMs: 0,
      measuredEndMs: RESOURCE_POLICY.measuredMs,
      db: { failures: 0, samples: rows },
    })
    expect(result).toMatchObject({ dbCoverage: true, dbBounded: false, dbGrowth: false })
  })
})
