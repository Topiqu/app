import { Redis } from 'ioredis'

// Cross-instance cache-aside over self-hosted Valkey (RESP over TCP).
// INVARIANT: only depersonalised, publicly-shareable data may be cached here.
// Per-user fields (userReaction, draft visibility, …) must be resolved per
// request OUTSIDE the cached value — never baked into a shared key.

let client: Redis | null | undefined
let down = false
let configured = false
let closed = false
let closing: Promise<void> | undefined
let readiness: Promise<boolean> | undefined
let cancelReadiness: (() => void) | undefined
const REDIS_TIMEOUT_MS = 1000

function getClient(): Redis | null {
  if (closed) return null
  if (client !== undefined) return client

  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('[cache] REDIS_URL not set — caching disabled')
    client = null
    return client
  }

  configured = true
  try {
    client = new Redis(url, {
      // Keep the deployed RESP2 wire contract when upgrading the Redis client.
      protocol: 2,
      // Never queue: with the offline queue on, a downed Valkey makes commands
      // wait through reconnect attempts and costs seconds per request.
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
      maxRetriesPerRequest: 1,
      connectTimeout: REDIS_TIMEOUT_MS,
      commandTimeout: REDIS_TIMEOUT_MS,
      socketTimeout: REDIS_TIMEOUT_MS,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    })
  } catch {
    client = null
    console.warn('[cache] redis initialization failed')
    return null
  }

  // ioredis throws when 'error' has no listener; the flag stops a downed Valkey
  // from logging once per reconnect attempt.
  client.on('error', () => {
    if (down) return
    down = true
    console.warn('[cache] redis unavailable')
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

function readyForInvalidation(redis: Redis): Promise<boolean> {
  if (closed || redis.status === 'end') return Promise.resolve(false)
  if (redis.status === 'ready') return Promise.resolve(true)
  if (readiness) return readiness

  // Reads can bypass a connecting cache, but writes must not silently skip the
  // generation shared by other replicas. Concurrent writes share one short wait.
  readiness = new Promise<boolean>((resolve) => {
    const settle = (ready: boolean) => {
      clearTimeout(timeout)
      redis.removeListener('ready', onReady)
      redis.removeListener('error', onUnavailable)
      redis.removeListener('end', onUnavailable)
      cancelReadiness = undefined
      resolve(ready && !closed)
    }
    const onReady = () => settle(true)
    const onUnavailable = () => settle(false)
    const timeout = setTimeout(onUnavailable, REDIS_TIMEOUT_MS)
    cancelReadiness = onUnavailable
    redis.once('ready', onReady)
    redis.once('error', onUnavailable)
    redis.once('end', onUnavailable)
  }).finally(() => {
    readiness = undefined
  })
  return readiness
}

/** Stop retries and sockets on Nitro shutdown or after a maintenance script. */
export function closeCache(): Promise<void> {
  if (closing) return closing
  closed = true
  cancelReadiness?.()
  const redis = client
  closing = (async () => {
    if (!redis) return
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      if (redis.status === 'ready') {
        await Promise.race([
          redis.quit(),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, REDIS_TIMEOUT_MS)
          }),
        ])
      }
    } catch {
      console.warn('[cache] graceful shutdown failed; disconnecting')
    } finally {
      if (timeout) clearTimeout(timeout)
      redis.disconnect()
    }
  })()
  return closing
}

/** A live probe, without exposing connection strings or waiting through reconnects. */
export async function cacheAvailability(): Promise<'ready' | 'unavailable' | 'unconfigured'> {
  if (closed) return 'unavailable'
  const redis = getClient()
  if (!redis) return configured ? 'unavailable' : 'unconfigured'
  if (redis.status !== 'ready') return 'unavailable'
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return (await Promise.race([
      redis.ping(),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), REDIS_TIMEOUT_MS)
      }),
    ])) === 'PONG'
      ? 'ready'
      : 'unavailable'
  } catch {
    return 'unavailable'
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

const logErr = (op: string, key: string) => console.warn(`[cache] ${op} failed for "${key}"`)

const inFlight = new Map<string, Promise<unknown>>()
const MAX_IN_FLIGHT = 512

/**
 * Cache-aside: return the cached value or compute it via `fn`, store, and return.
 * Degrades to calling `fn` directly whenever Redis is unconfigured, unreachable
 * or holding an unparseable value, so a cache outage never breaks a request.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key)
  if (pending) return pending as Promise<T>
  const result = loadCached(key, ttlSeconds, fn)
  if (inFlight.size >= MAX_IN_FLIGHT) return result
  inFlight.set(key, result)
  try {
    return await result
  } finally {
    inFlight.delete(key)
  }
}

async function loadCached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = activeClient()
  if (!redis) return fn()

  try {
    const raw = await redis.get(key)
    // ioredis stores strings, so this module owns the JSON boundary — which is
    // why a Date in the payload comes back as an ISO string on a hit.
    if (raw !== null) return JSON.parse(raw) as T
  } catch {
    logErr('get', key)
    return fn()
  }

  const fresh = await fn()
  if (closed) return fresh
  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds)
  } catch {
    logErr('set', key)
  }
  return fresh
}

/** Drop changed keys, waiting briefly for startup/reconnection rather than losing the first write. */
export async function uncache(...keys: string[]): Promise<void> {
  if (!keys.length) return
  const redis = getClient()
  if (!redis) return
  if (!(await readyForInvalidation(redis)) || closed || redis.status !== 'ready') {
    logErr('del-unavailable', keys.join(','))
    return
  }
  try {
    await redis.del(...keys)
  } catch {
    logErr('del', keys.join(','))
  }
}

/**
 * Monotonic generation counter for a namespace. Bump it on a write to invalidate
 * every key built under the current gen at once — no SCAN, no pattern delete.
 * Old keys are never read again and expire on their own TTL.
 */
export async function bumpGen(ns: string): Promise<'invalidated' | 'unavailable' | 'unconfigured'> {
  const redis = getClient()
  if (!redis) return closed || configured ? 'unavailable' : 'unconfigured'
  if (!(await readyForInvalidation(redis)) || closed || redis.status !== 'ready') {
    logErr('incr-unavailable', ns)
    return 'unavailable'
  }
  try {
    await redis.incr(`gen:${ns}`)
    return 'invalidated'
  } catch {
    logErr('incr', ns)
    return 'unavailable'
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
  } catch {
    logErr('get-gen', ns)
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

/** Public author summaries tolerate five-minute-old counters, but profile edits expire immediately. */
export async function cachedAuthor<T>(userId: string, load: () => Promise<T>): Promise<T> {
  const generation = await getGen(`author:${userId}`)
  return cached(`author:2:${userId}:v${generation}`, 300, load)
}

export const invalidateAuthor = (userId: string) => bumpGen(`author:${userId}`)

const fallbackLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_FALLBACK_LIMITS = 20_000
let nextPruneAt = 0

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const redis = activeClient()
  if (redis) {
    try {
      const redisKey = `rate:${key}`
      const count = Number(
        await redis.eval(
          "local n = redis.call('INCR', KEYS[1]); if n == 1 or redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
          1,
          redisKey,
          windowSeconds,
        ),
      )
      return count <= limit
    } catch {
      logErr('rate-limit', key)
    }
  }

  const now = Date.now()
  if (now >= nextPruneAt) {
    for (const [entry, value] of fallbackLimits) if (value.resetAt <= now) fallbackLimits.delete(entry)
    nextPruneAt = now + 60_000
  }
  const current = fallbackLimits.get(key)
  if (!current || current.resetAt <= now) {
    // Do not evict live identity limits: eviction would turn a memory cap into a bypass.
    if (!current && fallbackLimits.size >= MAX_FALLBACK_LIMITS) return false
    fallbackLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return true
  }
  current.count++
  return current.count <= limit
}

/** Release a failed, operation-specific claim; never clear a caller's abuse budget. */
export async function clearRateLimit(key: string): Promise<void> {
  fallbackLimits.delete(key)
  await uncache(`rate:${key}`)
}
