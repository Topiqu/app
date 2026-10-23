import { createError } from 'h3'
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * In-memory stand-in for ioredis. It stores strings and nothing else — which is
 * the whole point: Upstash used to JSON-serialize for us, ioredis does not, so
 * these tests fail loudly if `cache.ts` ever stops owning that boundary.
 */
class FakeRedis extends EventEmitter {
  store = new Map<string, string>()
  ttls = new Map<string, number>()
  failOn: string | null = null
  // `cache.ts` only issues commands while this reads 'ready'
  status = 'ready'

  quit = vi.fn(async () => {
    this.status = 'end'
    this.emit('end')
    return 'OK'
  })
  disconnect = vi.fn(() => {
    this.status = 'end'
    this.emit('end')
  })

  async get(key: string) {
    if (this.failOn === 'get') throw new Error('connection refused')
    return this.store.has(key) ? this.store.get(key)! : null
  }

  async ping(): Promise<string> {
    if (this.failOn === 'ping') throw new Error('connection refused')
    if (this.failOn === 'hang') return new Promise(() => {})
    return 'PONG'
  }

  async set(key: string, value: string, _token: string, ttl: number) {
    if (this.failOn === 'set') throw new Error('connection refused')
    this.store.set(key, value)
    this.ttls.set(key, ttl)
    return 'OK'
  }

  async incr(key: string) {
    if (this.failOn === 'incr') throw new Error('connection refused')
    const next = Number(this.store.get(key) ?? 0) + 1
    this.store.set(key, String(next))
    return next
  }

  async expire(key: string, ttl: number) {
    this.ttls.set(key, ttl)
    return 1
  }
  async del(key: string) {
    this.ttls.delete(key)
    return this.store.delete(key) ? 1 : 0
  }
  async eval(_script: string, _keys: number, key: string, ttl: number) {
    const count = await this.incr(key)
    if (count === 1 || !this.ttls.has(key)) await this.expire(key, ttl)
    return count
  }
}

let mockInstance = new FakeRedis()
let mockOptions: Record<string, unknown> = {}
let failConstruction = false

// `new Redis(url, opts)` must work, so this has to be constructible: an object
// method shorthand would not be, hence the standalone declaration.
function MockRedis(_url: string, options: Record<string, unknown>) {
  if (failConstruction) throw new Error('Invalid redis://private-user:private-password@private-host')
  mockOptions = options
  return mockInstance
}

vi.mock('ioredis', () => ({ Redis: MockRedis }))

async function loadCache({ configured = true } = {}) {
  vi.resetModules()
  mockInstance = new FakeRedis()
  failConstruction = false
  if (configured) process.env.REDIS_URL = 'redis://localhost:6379'
  else delete process.env.REDIS_URL
  return import('../../server/utils/cache')
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('cache availability', () => {
  it('distinguishes disabled caching from an unavailable connection and a successful live probe', async () => {
    const disabled = await loadCache({ configured: false })
    await expect(disabled.cacheAvailability()).resolves.toBe('unconfigured')
    const configured = await loadCache()
    await expect(configured.cacheAvailability()).resolves.toBe('ready')
    mockInstance.status = 'reconnecting'
    await expect(configured.cacheAvailability()).resolves.toBe('unavailable')
    mockInstance.status = 'ready'
    mockInstance.failOn = 'ping'
    await expect(configured.cacheAvailability()).resolves.toBe('unavailable')
  })
  it('bounds a stalled live probe to one second', async () => {
    vi.useFakeTimers()
    try {
      const { cacheAvailability } = await loadCache()
      mockInstance.failOn = 'hang'
      const result = cacheAvailability()
      await vi.advanceTimersByTimeAsync(1001)
      await expect(result).resolves.toBe('unavailable')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('cache connection lifecycle', () => {
  it('waits for initial readiness before invalidating a warm cross-instance feed', async () => {
    const cache = await loadCache()
    mockInstance.status = 'connecting'
    mockInstance.store.set('feed:site-1:v0', JSON.stringify('stale'))
    let finished = false
    const write = cache.invalidateFeed('site-1').then((outcome) => {
      finished = true
      return outcome
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    mockInstance.status = 'ready'
    mockInstance.emit('ready')
    await expect(write).resolves.toBe('invalidated')
    const generation = await cache.feedGen('site-1')
    await expect(cache.cached(`feed:site-1:v${generation}`, 60, async () => 'fresh')).resolves.toBe('fresh')
    expect(generation).toBe(1)
  })

  it('waits for initial readiness before removing an existing host cache key', async () => {
    const { uncache } = await loadCache()
    mockInstance.status = 'connecting'
    mockInstance.store.set('host:publication.test', 'old-host')
    const removal = uncache('host:publication.test')
    mockInstance.status = 'ready'
    mockInstance.emit('ready')
    await removal
    expect(mockInstance.store.has('host:publication.test')).toBe(false)
  })

  it('shares a bounded readiness wait and disposes listeners after connecting', async () => {
    vi.useFakeTimers()
    try {
      const { invalidateFeed } = await loadCache()
      mockInstance.status = 'connecting'
      const writes = Array.from({ length: 20 }, () => invalidateFeed('site-1'))
      expect(mockInstance.listenerCount('ready')).toBeLessThanOrEqual(2)
      mockInstance.status = 'ready'
      mockInstance.emit('ready')
      await Promise.all(writes)
      expect(mockInstance.store.get('gen:feed:site-1')).toBe('20')
      expect(mockInstance.listenerCount('ready')).toBe(1)
      expect(mockInstance.listenerCount('error')).toBe(1)
      expect(mockInstance.listenerCount('end')).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds unavailable invalidation, removes its waiters, and recovers on the next write', async () => {
    vi.useFakeTimers()
    try {
      const { invalidateFeed } = await loadCache()
      mockInstance.status = 'connecting'
      const pending = invalidateFeed('site-1')
      await vi.advanceTimersByTimeAsync(1001)
      await expect(pending).resolves.toBe('unavailable')
      expect(mockInstance.listenerCount('ready')).toBe(1)
      expect(mockInstance.listenerCount('end')).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
      mockInstance.status = 'ready'
      mockInstance.emit('ready')
      expect(mockInstance.store.has('gen:feed:site-1')).toBe(false)
      await expect(invalidateFeed('site-1')).resolves.toBe('invalidated')
      expect(mockInstance.store.get('gen:feed:site-1')).toBe('1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports connection failures without logging raw connection details', async () => {
    const { invalidateFeed } = await loadCache()
    mockInstance.status = 'connecting'
    const write = invalidateFeed('site-1')
    mockInstance.emit('error', new Error('redis://private-user:private-password@private-host'))
    await expect(write).resolves.toBe('unavailable')
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private-password')
    expect(mockInstance.listenerCount('ready')).toBe(1)
  })

  it('bounds ready-client commands at the SDK boundary and disables ambiguous resends', async () => {
    const { cacheAvailability } = await loadCache()
    await cacheAvailability()
    expect(mockOptions).toMatchObject({
      protocol: 2,
      commandTimeout: 1000,
      socketTimeout: 1000,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
    })
  })

  it('closes a healthy connection once and prevents reconnection after shutdown', async () => {
    const cache = await loadCache()
    await cache.cacheAvailability()
    await Promise.all([cache.closeCache(), cache.closeCache()])
    expect(mockInstance.quit).toHaveBeenCalledTimes(1)
    expect(mockInstance.disconnect).toHaveBeenCalledTimes(1)
    await expect(cache.invalidateFeed('site-1')).resolves.toBe('unavailable')
    await expect(cache.cached('after-close', 60, async () => 'direct')).resolves.toBe('direct')
    expect(mockInstance.store.has('gen:feed:site-1')).toBe(false)
  })

  it('prevents an already-ready invalidation from starting after shutdown in the same turn', async () => {
    const cache = await loadCache()
    await cache.cacheAvailability()
    const write = cache.invalidateFeed('site-1')
    await cache.closeCache()
    await expect(write).resolves.toBe('unavailable')
    expect(mockInstance.store.has('gen:feed:site-1')).toBe(false)
  })

  it('degrades safely when client construction rejects configuration without logging it', async () => {
    const cache = await loadCache()
    failConstruction = true
    await expect(cache.cacheAvailability()).resolves.toBe('unavailable')
    await expect(cache.invalidateFeed('site-1')).resolves.toBe('unavailable')
    await expect(cache.cached('one', 60, async () => 'direct')).resolves.toBe('direct')
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private-password')
  })

  it('cancels an initial readiness wait when shutdown starts', async () => {
    const cache = await loadCache()
    mockInstance.status = 'connecting'
    const write = cache.invalidateFeed('site-1')
    await cache.closeCache()
    await expect(write).resolves.toBe('unavailable')
    expect(mockInstance.quit).not.toHaveBeenCalled()
    expect(mockInstance.disconnect).toHaveBeenCalledTimes(1)
    expect(mockInstance.listenerCount('ready')).toBe(1)
    expect(mockInstance.listenerCount('end')).toBe(0)
  })

  it('forces disconnect after a stalled graceful close without leaking a timer', async () => {
    vi.useFakeTimers()
    try {
      const cache = await loadCache()
      await cache.cacheAvailability()
      mockInstance.quit.mockImplementation(() => new Promise(() => {}))
      const close = cache.closeCache()
      await vi.advanceTimersByTimeAsync(1001)
      await close
      expect(mockInstance.disconnect).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('registers cleanup on the Nitro close lifecycle', async () => {
    const cache = await loadCache()
    await cache.cacheAvailability()
    const hook = vi.fn()
    vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
    try {
      const plugin = (await import('../../server/plugins/cache')).default
      plugin({ hooks: { hook } } as never)
      expect(hook).toHaveBeenCalledWith('close', cache.closeCache)
      await hook.mock.calls[0]![1]()
      expect(mockInstance.disconnect).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('cached', () => {
  it.each([true, false])('coalesces concurrent cold loads (Redis configured: %s)', async (configured) => {
    const { cached } = await loadCache({ configured })
    let finish!: (value: string) => void
    const result = new Promise<string>((resolve) => {
      finish = resolve
    })
    const load = vi.fn(() => result)
    const requests = Array.from({ length: 20 }, () => cached('public:one', 60, load))
    await vi.waitFor(() => expect(load).toHaveBeenCalled())
    const calls = load.mock.calls.length
    finish('loaded')
    await expect(Promise.all(requests)).resolves.toEqual(Array(20).fill('loaded'))
    expect(calls).toBe(1)
  })

  it('releases a failed coalesced loader so the next request can retry', async () => {
    const { cached } = await loadCache({ configured: false })
    const failed = vi.fn().mockRejectedValue(new Error('Loader unavailable'))
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => cached('public:retry', 60, failed)))
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(failed).toHaveBeenCalledOnce()
    await expect(cached('public:retry', 60, async () => 'recovered')).resolves.toBe('recovered')
  })
  it('computes and stores on a miss, with the requested TTL', async () => {
    const { cached } = await loadCache()
    const fn = vi.fn().mockResolvedValue({ items: [1, 2] })

    await expect(cached('k', 600, fn)).resolves.toEqual({ items: [1, 2] })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockInstance.ttls.get('k')).toBe(600)
  })

  it('serves the second call from the cache without recomputing', async () => {
    const { cached } = await loadCache()
    const fn = vi.fn().mockResolvedValue({ items: [1, 2] })

    await cached('k', 600, fn)
    await expect(cached('k', 600, fn)).resolves.toEqual({ items: [1, 2] })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('round-trips a structured payload as JSON, not as "[object Object]"', async () => {
    const { cached } = await loadCache()
    const payload = { items: [{ id: 'a', tags: ['x'] }], hasMore: true, latestPoll: '' }

    await cached('feed', 600, async () => payload)
    const raw = mockInstance.store.get('feed')

    expect(typeof raw).toBe('string')
    expect(raw).not.toContain('[object Object]')
    expect(JSON.parse(raw!)).toEqual(payload)

    const hit = await cached('feed', 600, async () => {
      throw new Error('must not recompute')
    })
    expect(hit).toEqual(payload)
  })

  it('falls back to the loader when the cache is unreachable', async () => {
    const { cached } = await loadCache()
    mockInstance.failOn = 'get'
    const fn = vi.fn().mockResolvedValue('fresh')

    await expect(cached('k', 600, fn)).resolves.toBe('fresh')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('still returns the fresh value when the write fails', async () => {
    const { cached } = await loadCache()
    mockInstance.failOn = 'set'

    await expect(cached('k', 600, async () => 'fresh')).resolves.toBe('fresh')
  })

  it('recomputes rather than throwing when the stored value is corrupt', async () => {
    const { cached } = await loadCache()
    mockInstance.store.set('k', '{not json')

    await expect(cached('k', 600, async () => 'fresh')).resolves.toBe('fresh')
  })

  it('skips the cache entirely while the connection is not ready', async () => {
    const { cached } = await loadCache()
    // what a still-connecting or downed Valkey looks like
    mockInstance.status = 'reconnecting'
    const fn = vi.fn().mockResolvedValue('direct')

    await expect(cached('k', 600, fn)).resolves.toBe('direct')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockInstance.store.size).toBe(0)
  })

  it('runs the loader untouched when REDIS_URL is unset', async () => {
    const { cached } = await loadCache({ configured: false })
    const fn = vi.fn().mockResolvedValue('direct')

    await expect(cached('k', 600, fn)).resolves.toBe('direct')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockInstance.store.size).toBe(0)
  })
})

describe('tag mutation feed invalidation', () => {
  it.each(['rename', 'delete'] as const)('expires a warmed public feed after tag %s', async (operation) => {
    const { cached, feedGen, invalidateFeed } = await loadCache()
    let name: string | null = 'Original'
    const read = async () => cached(`feed:site-1:v${await feedGen('site-1')}`, 600, async () => ({ tag: name }))
    await expect(read()).resolves.toEqual({ tag: 'Original' })
    name = 'Changed outside cache'
    await expect(read()).resolves.toEqual({ tag: 'Original' })
    const db = {
      tag: {
        findUnique: vi.fn().mockResolvedValue({ id: 'tag-1', clientSiteId: 'site-1' }),
        update: vi.fn(async () => {
          name = 'Renamed'
          return { id: 'tag-1', name, slug: 'renamed' }
        }),
        delete: vi.fn(async () => {
          name = null
          return { id: 'tag-1' }
        }),
      },
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'u1', role: 'admin', clientSiteId: 'site-1' } }))
    vi.stubGlobal('getRouterParam', () => 'tag-1')
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('readBody', async () => ({ name: 'Renamed', slug: 'renamed' }))
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse({ name: 'Renamed', slug: 'renamed' }),
    )
    vi.stubGlobal('invalidateFeed', invalidateFeed)
    try {
      const handler =
        operation === 'rename'
          ? (await import('../../server/api/tags/[id]/index.patch')).default
          : (await import('../../server/api/tags/[id]/index.delete')).default
      await handler({} as never)
      await expect(read()).resolves.toEqual({ tag: operation === 'rename' ? 'Renamed' : null })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('translation mutation feed invalidation', () => {
  it.each(['edit', 'unpublish', 'delete'] as const)(
    'expires a warmed public translation after %s',
    async (operation) => {
      const { cached, feedGen, invalidateFeed } = await loadCache()
      const observed = new Date('2026-10-22T12:00:00Z')
      let row: {
        id: string
        articleId: string
        language: string
        title: string
        slug: string
        content: string
        status: string
        updatedAt: Date
        clientSite: { publishToWeb: boolean }
      } | null = {
        id: 'translation-1',
        articleId: 'article-1',
        language: 'fr',
        title: 'French',
        slug: 'french',
        content: 'Original translation',
        status: 'PUBLISHED',
        updatedAt: observed,
        clientSite: { publishToWeb: true },
      }
      const read = async () =>
        cached(`feed:site-1:v${await feedGen('site-1')}`, 600, async () => ({
          content: row?.status === 'PUBLISHED' ? row.content : null,
        }))
      await expect(read()).resolves.toEqual({ content: 'Original translation' })
      const client = {
        articleTranslation: {
          findFirst: async () => ({ ...row }),
          updateMany: async ({ data }: { data: Partial<NonNullable<typeof row>> }) => {
            row = { ...row!, ...data }
            return { count: 1 }
          },
          findUniqueOrThrow: async () => row,
          deleteMany: async () => {
            row = null
            return { count: 1 }
          },
        },
      }
      const db = { ...client, $transaction: async (run: (tx: typeof client) => unknown) => run(client) }
      const payload = {
        expectedUpdatedAt: observed.toISOString(),
        ...(operation === 'edit' ? { content: 'Changed translation' } : { status: 'READY' }),
      }
      vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
      vi.stubGlobal('createError', createError)
      vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
      vi.stubGlobal('getRouterParam', () => 'translation-1')
      vi.stubGlobal('requireDb', async () => ({ user: { id: 'u1', clientSiteId: 'site-1' }, db }))
      vi.stubGlobal('requireArticleAccess', vi.fn())
      vi.stubGlobal('requireTenantScope', vi.fn())
      vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(payload))
      vi.stubGlobal('invalidateFeed', invalidateFeed)
      vi.stubGlobal('sanitizeHtml', (content: string) => content)
      vi.stubGlobal('prisma', {})
      vi.stubGlobal('syncArticleMediaUsages', vi.fn())
      vi.stubGlobal('logAction', vi.fn())
      vi.stubGlobal('getIp', () => '192.0.2.1')
      vi.stubGlobal('announceArticle', vi.fn().mockResolvedValue(undefined))
      vi.stubGlobal('reportCaughtError', vi.fn())
      try {
        const handler =
          operation === 'delete'
            ? (await import('../../server/api/translations/[id]/index.delete')).default
            : (await import('../../server/api/translations/[id]/index.patch')).default
        await handler({} as never)
        await expect(read()).resolves.toEqual({ content: operation === 'edit' ? 'Changed translation' : null })
      } finally {
        vi.unstubAllGlobals()
      }
    },
  )
})

describe('generation counters', () => {
  it('starts at 0 and returns a number, not the string Redis stores', async () => {
    const { bumpGen, getGen } = await loadCache()

    expect(await getGen('feed:site-1')).toBe(0)

    await bumpGen('feed:site-1')
    const gen = await getGen('feed:site-1')

    expect(gen).toBe(1)
    expect(typeof gen).toBe('number')
    // the raw value really is a string — this is what the coercion guards
    expect(mockInstance.store.get('gen:feed:site-1')).toBe('1')
  })

  it('reports 0 when the cache is unreachable so keys stay buildable', async () => {
    const { getGen } = await loadCache()
    mockInstance.failOn = 'get'

    expect(await getGen('feed:site-1')).toBe(0)
  })

  it('is a no-op without REDIS_URL', async () => {
    const { bumpGen, getGen } = await loadCache({ configured: false })

    await expect(bumpGen('feed:site-1')).resolves.toBe('unconfigured')
    expect(await getGen('feed:site-1')).toBe(0)
  })
})

describe('invalidateFeed', () => {
  it('bumps the generation the feed keys are built from', async () => {
    const { feedGen, invalidateFeed } = await loadCache()

    expect(await feedGen('site-1')).toBe(0)
    await invalidateFeed('site-1')

    expect(await feedGen('site-1')).toBe(1)
    expect(mockInstance.store.get('gen:feed:site-1')).toBe('1')
  })

  it('scopes invalidation to one tenant', async () => {
    const { feedGen, invalidateFeed } = await loadCache()

    await invalidateFeed('site-1')

    expect(await feedGen('site-1')).toBe(1)
    expect(await feedGen('site-2')).toBe(0)
  })
})

describe('author summaries', () => {
  it('ignores older public summaries that could include scheduled article statistics', async () => {
    const { cachedAuthor } = await loadCache()
    mockInstance.store.set('author:one:v0', JSON.stringify({ articleCount: 99 }))
    const load = vi.fn().mockResolvedValue({ articleCount: 1 })
    await expect(cachedAuthor('one', load)).resolves.toEqual({ articleCount: 1 })
    expect(load).toHaveBeenCalledOnce()
  })

  it('shares a summary for five minutes and invalidates only the edited author', async () => {
    const { cachedAuthor, invalidateAuthor } = await loadCache()
    const first = vi.fn().mockResolvedValue({ username: 'Before' })
    const other = vi.fn().mockResolvedValue({ username: 'Other' })
    await cachedAuthor('one', first)
    await cachedAuthor('two', other)
    await cachedAuthor('one', first)
    expect(first).toHaveBeenCalledTimes(1)
    expect(mockInstance.ttls.get('author:2:one:v0')).toBe(300)

    await invalidateAuthor('one')
    first.mockResolvedValue({ username: 'After' })
    await expect(cachedAuthor('one', first)).resolves.toEqual({ username: 'After' })
    await cachedAuthor('two', other)
    expect(first).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('does not resurrect an old in-flight summary after a profile edit', async () => {
    const { cachedAuthor, invalidateAuthor } = await loadCache()
    let finish!: (value: string) => void
    let started!: () => void
    const loading = new Promise<void>((resolve) => {
      started = resolve
    })
    const oldRequest = cachedAuthor('one', () => {
      started()
      return new Promise<string>((resolve) => {
        finish = resolve
      })
    })
    await loading
    await invalidateAuthor('one')
    await cachedAuthor('one', async () => 'new')
    finish('old')
    await oldRequest
    await expect(cachedAuthor('one', async () => 'unexpected')).resolves.toBe('new')
  })

  it('falls back without Redis and does not cache loader failures', async () => {
    const { cachedAuthor } = await loadCache({ configured: false })
    await expect(cachedAuthor('one', async () => 'fresh')).resolves.toBe('fresh')
    const configured = await loadCache()
    await expect(
      configured.cachedAuthor('one', async () => {
        throw new Error('missing')
      }),
    ).rejects.toThrow('missing')
    await expect(configured.cachedAuthor('one', async () => 'created')).resolves.toBe('created')
  })
})

describe('consumeRateLimit', () => {
  it.each([true, false])('releases only a failed operation claim (Redis configured: %s)', async (configured) => {
    const { consumeRateLimit, clearRateLimit } = await loadCache({ configured })
    await consumeRateLimit('report:identity', 1, 600)
    await consumeRateLimit('report:budget', 1, 3600)
    await expect(consumeRateLimit('report:identity', 1, 600)).resolves.toBe(false)
    await clearRateLimit('report:identity')
    await expect(consumeRateLimit('report:identity', 1, 600)).resolves.toBe(true)
    await expect(consumeRateLimit('report:budget', 1, 3600)).resolves.toBe(false)
  })
  it('repairs a Redis counter without a TTL', async () => {
    const { consumeRateLimit } = await loadCache()
    mockInstance.store.set('rate:orphan', '1')
    await expect(consumeRateLimit('orphan', 3, 60)).resolves.toBe(true)
    expect(mockInstance.ttls.get('rate:orphan')).toBe(60)
  })
  it('bounds fallback memory without evicting active identity limits and reclaims expired entries', async () => {
    vi.useFakeTimers()
    try {
      const { consumeRateLimit } = await loadCache({ configured: false })
      for (let i = 0; i < 20_000; i++) await consumeRateLimit(`identity:${i}`, 1, 60)
      await expect(consumeRateLimit('overflow', 1, 60)).resolves.toBe(false)
      await expect(consumeRateLimit('identity:0', 1, 60)).resolves.toBe(false)
      vi.advanceTimersByTime(60_001)
      await expect(consumeRateLimit('overflow', 1, 60)).resolves.toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
  it('shares counters through Redis and rejects after the configured limit', async () => {
    const { consumeRateLimit } = await loadCache()

    await expect(consumeRateLimit('login:identity:x', 2, 900)).resolves.toBe(true)
    await expect(consumeRateLimit('login:identity:x', 2, 900)).resolves.toBe(true)
    await expect(consumeRateLimit('login:identity:x', 2, 900)).resolves.toBe(false)
    expect(mockInstance.store.get('rate:login:identity:x')).toBe('3')
    expect(mockInstance.ttls.get('rate:login:identity:x')).toBe(900)
  })

  it('keeps independent identities isolated', async () => {
    const { consumeRateLimit } = await loadCache()

    await consumeRateLimit('login:identity:a', 1, 900)
    await expect(consumeRateLimit('login:identity:a', 1, 900)).resolves.toBe(false)
    await expect(consumeRateLimit('login:identity:b', 1, 900)).resolves.toBe(true)
  })
})
