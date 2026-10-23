import { isAbsolute } from 'node:path'
import { createHash } from 'node:crypto'
import { closeSync, openSync, opendirSync, readFileSync, readlinkSync, writeSync } from 'node:fs'

import { RESOURCE_POLICY } from './server-resource-protocol'

/** Opt-in only. This module observes the process without replacing handlers or retaining requests. */
if (process.env.TOPIQU_RESOURCE_PROTOCOL === '1') {
  if (process.platform !== 'linux' || !process.versions.bun) throw new Error('RESOURCE_PRELOAD_REQUIRES_BUN_LINUX')
  const filename = process.env.TOPIQU_RESOURCE_SAMPLE_FILE ?? ''
  if (!isAbsolute(filename) || !filename.endsWith('.jsonl')) throw new Error('RESOURCE_SAMPLE_FILE_REQUIRED')
  const { heapStats } = await import('bun:jsc')
  const output = openSync(filename, 'wx', 0o600)
  const entrypointSha256 = process.argv[1]
    ? createHash('sha256').update(readFileSync(process.argv[1])).digest('hex')
    : null
  const startedAtMs = Date.now()
  let closed = false
  let samples = 0
  let ticks = 0
  let maximumDelay = 0
  // Fixed bins avoid retaining one timer sample per request or an unbounded time series.
  const bounds = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, Infinity]
  const buckets = bounds.map(() => 0)
  let previousTick = performance.now()
  const delayTimer = setInterval(() => {
    const now = performance.now()
    const delay = Math.max(0, now - previousTick - 100)
    previousTick = now
    ticks++
    maximumDelay = Math.max(maximumDelay, delay)
    buckets[bounds.findIndex((bound) => delay <= bound)]!++
  }, 100)
  delayTimer.unref()
  const emit = (value: unknown) => writeSync(output, `${JSON.stringify(value)}\n`)
  emit({
    kind: 'sampler',
    version: 1,
    startedAtMs,
    intervalMs: RESOURCE_POLICY.sampleIntervalMs,
    runtime: 'bun',
    runtimeVersion: process.versions.bun,
    platform: 'linux',
    architecture: process.arch,
    nodeEnv: process.env.NODE_ENV === 'production' ? 'production' : 'other',
    schedulerTestFlag: process.env.TEST === '1',
    entrypointSha256,
    forcedGc: false,
    nativeAllocatorBytes: null,
    applicationCaches: null,
    serverInflight: null,
  })
  const sample = () => {
    const started = performance.now()
    const memory = process.memoryUsage()
    const heap = heapStats()
    let fdCount: number | null = 0
    let socketFdCount: number | null = 0
    let threads: number | null = null
    try {
      const directory = opendirSync('/proc/self/fd')
      try {
        for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
          fdCount++
          if (fdCount > 8192) {
            fdCount = null
            socketFdCount = null
            break
          }
          try {
            if (readlinkSync(`/proc/self/fd/${entry.name}`).startsWith('socket:')) socketFdCount++
          } catch {
            /* A descriptor can close during observation. */
          }
        }
      } finally {
        directory.closeSync()
      }
      const status = readFileSync('/proc/self/status', 'utf8')
      threads = Number(status.match(/^Threads:\s+(\d+)$/m)?.[1] ?? NaN)
      if (!Number.isFinite(threads)) threads = null
    } catch {
      fdCount = null
      socketFdCount = null
    }
    let cumulative = 0
    const p95Index = buckets.findIndex((count) => {
      cumulative += count
      return cumulative >= ticks * 0.95
    })
    emit({
      kind: 'sample',
      timestampMs: Date.now(),
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
      jscHeapSize: heap.heapSize,
      jscHeapCapacity: heap.heapCapacity,
      jscExtraMemorySize: heap.extraMemorySize,
      jscObjectCount: heap.objectCount,
      jscProtectedObjectCount: heap.protectedObjectCount,
      rssOutsideJsHeapEstimate: Math.max(0, memory.rss - heap.heapSize),
      fdCount,
      socketFdCount,
      threads,
      eventLoopP95Ms: ticks ? (Number.isFinite(bounds[p95Index]) ? bounds[p95Index] : maximumDelay) : 0,
      eventLoopMaxMs: maximumDelay,
      timerTicks: ticks,
      sampleDurationMs: performance.now() - started,
    })
    ticks = 0
    maximumDelay = 0
    buckets.fill(0)
  }
  const stop = (reason: string) => {
    if (closed) return
    closed = true
    clearInterval(delayTimer)
    clearInterval(sampleTimer)
    try {
      emit({ kind: 'samplerStopped', timestampMs: Date.now(), reason })
    } finally {
      closeSync(output)
    }
  }
  const sampleTimer = setInterval(() => {
    try {
      sample()
      // Bound the evidence even if an operator leaves the server running beyond the protocol.
      if (++samples >= 510) stop('duration-limit')
    } catch {
      try {
        stop('observation-failed')
      } catch {
        /* Missing samples make the evidence incomplete. */
      }
    }
  }, RESOURCE_POLICY.sampleIntervalMs)
  sampleTimer.unref()
  process.once('exit', (code) => {
    if (closed) return
    stop(`exit-${code}`)
  })
}
