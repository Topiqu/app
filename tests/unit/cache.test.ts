import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * In-memory stand-in for ioredis. It stores strings and nothing else — which is
 * the whole point: Upstash used to JSON-serialize for us, ioredis does not, so
 * these tests fail loudly if `cache.ts` ever stops owning that boundary.
 */
class FakeRedis {
  store = new Map<string, string>()
  ttls = new Map<string, number>()
  failOn: string | null = null
  // `cache.ts` only issues commands while this reads 'ready'
  status = 'ready'

  on() {
    return this
  }

  async get(key: string) {
    if (this.failOn === 'get') throw new Error('connection refused')
    return this.store.has(key) ? this.store.get(key)! : null
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
}

let mockInstance = new FakeRedis()

// `new Redis(url, opts)` must work, so this has to be constructible: an object
// method shorthand would not be, hence the standalone declaration.
function MockRedis() {
  return mockInstance
}

vi.mock('ioredis', () => ({ Redis: MockRedis }))

async function loadCache({ configured = true } = {}) {
  vi.resetModules()
  mockInstance = new FakeRedis()
  if (configured) process.env.REDIS_URL = 'redis://localhost:6379'
  else delete process.env.REDIS_URL
  return import('../../server/utils/cache')
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('cached', () => {
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

    await expect(bumpGen('feed:site-1')).resolves.toBeUndefined()
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
