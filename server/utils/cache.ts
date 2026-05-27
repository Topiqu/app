import { Redis } from '@upstash/redis'

// Cross-instance cache-aside over Upstash (HTTP/REST, serverless-friendly).
// INVARIANT: only depersonalised, publicly-shareable data may be cached here.
// Per-user fields (userReaction, draft visibility, …) must be resolved per
// request OUTSIDE the cached value — never baked into a shared key.

let client: Redis | null | undefined

function getClient(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  client = url && token ? new Redis({ url, token }) : null
  if (!client) console.warn('[cache] Upstash not configured (UPSTASH_REDIS_REST_*) — caching disabled')
  return client
}

const logErr = (op: string, key: string, e: unknown) =>
  console.warn(`[cache] ${op} failed for "${key}"`, (e as Error)?.message)

/**
 * Cache-aside: return the cached value or compute it via `fn`, store, and return.
 * Degrades gracefully — if Redis is unconfigured or errors, `fn` runs directly,
 * so a cache outage never breaks the request.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = getClient()
  if (!redis) return fn()

  try {
    const hit = await redis.get<T>(key)
    if (hit !== null && hit !== undefined) {
      // TEMPORARY: verify cache effectiveness in prod, remove once confirmed.
      console.info(`[cache] HIT ${key}`)
      return hit
    }
  } catch (e) {
    logErr('get', key, e)
    return fn()
  }

  // TEMPORARY: paired with the HIT log above, remove once confirmed.
  console.info(`[cache] MISS ${key}`)
  const fresh = await fn()
  try {
    await redis.set(key, fresh, { ex: ttlSeconds })
  } catch (e) {
    logErr('set', key, e)
  }
  return fresh
}

/**
 * Monotonic generation counter for a namespace. Bump it on a write to invalidate
 * every key built under the current gen at once — no SCAN, no pattern delete.
 * Old keys are simply never read again and expire on their TTL.
 */
export async function bumpGen(ns: string): Promise<void> {
  const redis = getClient()
  if (!redis) return
  try {
    await redis.incr(`gen:${ns}`)
  } catch (e) {
    logErr('incr', ns, e)
  }
}

/** Current generation for a namespace (0 when unset or cache unavailable). */
export async function getGen(ns: string): Promise<number> {
  const redis = getClient()
  if (!redis) return 0
  try {
    return (await redis.get<number>(`gen:${ns}`)) ?? 0
  } catch (e) {
    logErr('get-gen', ns, e)
    return 0
  }
}
