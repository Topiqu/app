import { Redis } from 'ioredis'

// Cross-instance cache-aside over self-hosted Valkey (RESP over TCP).
// INVARIANT: only depersonalised, publicly-shareable data may be cached here.
// Per-user fields (userReaction, draft visibility, …) must be resolved per
// request OUTSIDE the cached value — never baked into a shared key.

let client: Redis | null | undefined
let down = false

function getClient(): Redis | null {
  if (client !== undefined) return client

  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('[cache] REDIS_URL not set — caching disabled')
    client = null
    return client
  }

  client = new Redis(url, {
    // Never queue: with the offline queue on, a downed Valkey makes commands
    // wait through reconnect attempts and costs seconds per request.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  })

  // ioredis throws when 'error' has no listener; the flag stops a downed Valkey
  // from logging once per reconnect attempt.
  client.on('error', (e) => {
    if (down) return
    down = true
    console.warn('[cache] redis unavailable —', e.message)
  })
  client.on('ready', () => {
    down = false
  })

  return client
}

/**
 * The client only while it can actually serve a command. ioredis connects
 * asynchronously, so without this gate the first requests after boot would each
 * eat a rejection, and a downed Valkey would do so for every request forever.
 * Skipping straight to the loader keeps both cases free; `status` returns to
 * 'ready' on its own once Valkey is back.
 */
function activeClient(): Redis | null {
  const redis = getClient()
  return redis && redis.status === 'ready' ? redis : null
}

const logErr = (op: string, key: string, e: unknown) =>
  console.warn(`[cache] ${op} failed for "${key}"`, (e as Error)?.message)

/**
 * Cache-aside: return the cached value or compute it via `fn`, store, and return.
 * Degrades to calling `fn` directly whenever Redis is unconfigured, unreachable
 * or holding an unparseable value, so a cache outage never breaks a request.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = activeClient()
  if (!redis) return fn()

  try {
    const raw = await redis.get(key)
    // ioredis stores strings, so this module owns the JSON boundary — which is
    // why a Date in the payload comes back as an ISO string on a hit.
    if (raw !== null) return JSON.parse(raw) as T
  } catch (e) {
    logErr('get', key, e)
    return fn()
  }

  const fresh = await fn()
  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds)
  } catch (e) {
    logErr('set', key, e)
  }
  return fresh
}

/**
 * Monotonic generation counter for a namespace. Bump it on a write to invalidate
 * every key built under the current gen at once — no SCAN, no pattern delete.
 * Old keys are never read again and expire on their own TTL.
 */
export async function bumpGen(ns: string): Promise<void> {
  const redis = activeClient()
  if (!redis) return
  try {
    await redis.incr(`gen:${ns}`)
  } catch (e) {
    logErr('incr', ns, e)
  }
}

/** Current generation for a namespace (0 when unset or cache unavailable). */
export async function getGen(ns: string): Promise<number> {
  const redis = activeClient()
  if (!redis) return 0
  try {
    const raw = await redis.get(`gen:${ns}`)
    // ioredis answers with a string; without the coercion the key would carry
    // `v5` from a number on a miss and `v"5"` from a string on a hit.
    return raw === null ? 0 : Number(raw) || 0
  } catch (e) {
    logErr('get-gen', ns, e)
    return 0
  }
}

const feedNs = (clientSiteId: string) => `feed:${clientSiteId}`

/** Generation for a tenant's public article listings. */
export const feedGen = (clientSiteId: string) => getGen(feedNs(clientSiteId))

/**
 * Call after a write that changes what a tenant's listings return. Deliberately
 * NOT called from view/share counters — bumping on every article open would
 * make the cache miss on every request.
 */
export const invalidateFeed = (clientSiteId: string) => bumpGen(feedNs(clientSiteId))

const fallbackLimits = new Map<string, { count: number; resetAt: number }>()

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redis = activeClient()
  if (redis) {
    try {
      const redisKey = `rate:${key}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.expire(redisKey, windowSeconds)
      return count <= limit
    } catch (e) {
      logErr('rate-limit', key, e)
    }
  }

  const now = Date.now()
  const current = fallbackLimits.get(key)
  if (!current || current.resetAt <= now) {
    fallbackLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return true
  }
  current.count++
  return current.count <= limit
}
