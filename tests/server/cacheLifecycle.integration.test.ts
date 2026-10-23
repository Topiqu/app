// @vitest-environment node
import { Redis } from 'ioredis'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rmdir, unlink } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const binary = process.env.TEST_CACHE_REDIS_BINARY
const enabled = !!binary && existsSync(binary)
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe.skipIf(!enabled)('cache lifecycle on an isolated Unix-socket Redis', () => {
  let process: ChildProcess | undefined
  let directory: string | undefined
  let socket: string
  let admin: Redis | undefined
  const caches: (typeof import('../../server/utils/cache'))[] = []

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'topiqu-cache-test-'))
    socket = join(directory, 'redis.sock')
    process = spawn(
      binary!,
      [
        '--port',
        '0',
        '--unixsocket',
        socket,
        '--unixsocketperm',
        '700',
        '--save',
        '',
        '--appendonly',
        'no',
        '--daemonize',
        'no',
        '--dir',
        directory,
      ],
      { stdio: 'ignore' },
    )
    const started = Date.now()
    while (!existsSync(socket)) {
      if (process.exitCode !== null || Date.now() - started > 3000) throw new Error('Isolated Redis did not start')
      await pause(25)
    }
    admin = new Redis(socket, {
      lazyConnect: true,
      protocol: 2,
      enableOfflineQueue: false,
      retryStrategy: null,
      commandTimeout: 1000,
      socketTimeout: 1000,
    })
    admin.on('error', () => {})
    await admin.connect()
  })

  afterEach(async () => {
    await Promise.all(caches.splice(0).map((cache) => cache.closeCache()))
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    try {
      if (admin?.status === 'ready') await admin.quit()
    } finally {
      admin?.disconnect()
      if (process && process.exitCode === null) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => process!.kill('SIGKILL'), 1500)
          process!.once('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
          process!.kill('SIGTERM')
        })
      }
      if (socket && existsSync(socket)) await unlink(socket)
      if (directory) await rmdir(directory)
    }
  })

  const cacheModule = async () => {
    vi.resetModules()
    vi.stubEnv('REDIS_URL', socket)
    const cache = await import('../../server/utils/cache')
    caches.push(cache)
    return cache
  }

  it('invalidates a prewarmed generation on the first call before its client is ready', async () => {
    const siteId = `cache-test-${randomUUID()}`
    await admin!.set(`feed:${siteId}:v0`, JSON.stringify('stale'))
    const cache = await cacheModule()
    await expect(cache.invalidateFeed(siteId)).resolves.toBe('invalidated')
    const generation = await cache.feedGen(siteId)
    expect(generation).toBe(1)
    await expect(cache.cached(`feed:${siteId}:v${generation}`, 60, async () => 'fresh')).resolves.toBe('fresh')
  })

  it('shares initial readiness while retaining every concurrent invalidation', async () => {
    const siteId = `cache-test-${randomUUID()}`
    const cache = await cacheModule()
    await expect(Promise.all(Array.from({ length: 32 }, () => cache.invalidateFeed(siteId)))).resolves.toEqual(
      Array(32).fill('invalidated'),
    )
    expect(await admin!.get(`gen:feed:${siteId}`)).toBe('32')
  })

  it('stops a ready invalidation from racing graceful shutdown in the same turn', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const siteId = `cache-test-${randomUUID()}`
    const cache = await cacheModule()
    await cache.invalidateFeed(siteId)
    const write = cache.invalidateFeed(siteId)
    await cache.closeCache()
    await expect(write).resolves.toBe('unavailable')
    expect(await admin!.get(`gen:feed:${siteId}`)).toBe('1')
  })

  it('bounds a stalled command, reconnects, and does not resend an ambiguous increment', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const siteId = `cache-test-${randomUUID()}`
    const cache = await cacheModule()
    await cache.invalidateFeed(siteId)
    await admin!.call('CLIENT', 'PAUSE', 1500, 'ALL')
    const started = Date.now()
    await expect(cache.invalidateFeed(siteId)).resolves.toBe('unavailable')
    expect(Date.now() - started).toBeLessThan(1800)
    await pause(1800)
    const resumed = Date.now()
    while ((await cache.cacheAvailability()) !== 'ready') {
      if (Date.now() - resumed > 3000) throw new Error('Isolated cache did not reconnect')
      await pause(50)
    }
    const prior = Number(await admin!.get(`gen:feed:${siteId}`))
    expect(prior).toBeLessThanOrEqual(2)
    await expect(cache.invalidateFeed(siteId)).resolves.toBe('invalidated')
    expect(Number(await admin!.get(`gen:feed:${siteId}`))).toBe(prior + 1)
  }, 10_000)

  it('cancels initial connection work and prevents a late write after shutdown', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const siteId = `cache-test-${randomUUID()}`
    const cache = await cacheModule()
    const write = cache.invalidateFeed(siteId)
    await cache.closeCache()
    await expect(write).resolves.toBe('unavailable')
    await pause(50)
    expect(await admin!.get(`gen:feed:${siteId}`)).toBeNull()
    await expect(cache.cacheAvailability()).resolves.toBe('unavailable')
  })
})
