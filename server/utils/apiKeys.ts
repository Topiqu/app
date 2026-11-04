import type { H3Event } from 'h3'
import type { ApiKeyScope, ClientPlan, TenantScope } from '~~/generated/zenstack/models'

import { createHash, randomBytes } from 'node:crypto'

declare module 'h3' {
  interface H3EventContext {
    apiKey?: AuthenticatedApiKey
    /** The key creator's tenant access narrowed to the key's scopes; `requireTenantMember` returns it. */
    apiKeyMembership?: TenantAccess['membership']
  }
}

export type AuthenticatedApiKey = {
  id: string
  clientSiteId: string
  scopes: ApiKeyScope[]
  createdById: string | null
  plan: ClientPlan
}

export const API_RATE_LIMIT = { requests: 120, windowSeconds: 60 }
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000
const LAST_USED_RESOLUTION_MS = 5 * 60_000

export const hashApiKey = (key: string) => createHash('sha256').update(key, 'utf8').digest('hex')

/** 256 random bits: a plain SHA-256 is enough, since there is nothing to brute-force. */
export const createApiKeySecret = () => {
  const key = `sk_${randomBytes(32).toString('hex')}`
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 11) }
}

export const API_KEY_VIEW = {
  id: true,
  name: true,
  prefix: true,
  scopes: true,
  createdAt: true,
  lastUsedAt: true,
  createdBy: { select: { username: true } },
} as const

const KEY_TENANT_SCOPES: Record<ApiKeyScope, TenantScope[]> = {
  READ: [],
  WRITE: ['ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS'],
  PUBLISH: ['ARTICLE_PUBLISH'],
  GENERATE: ['AI_USE'],
}

/** A key never grants more than its creator holds right now, nor more than its own scopes. */
export const apiKeyTenantScopes = (keyScopes: readonly ApiKeyScope[], memberScopes: readonly TenantScope[]) =>
  memberScopes.filter((scope) => keyScopes.some((keyScope) => KEY_TENANT_SCOPES[keyScope].includes(scope)))

/** The tenant scopes a member needs to mint a key with these scopes. */
export const requiredTenantScopes = (keyScopes: readonly ApiKeyScope[]) => [
  ...new Set(
    keyScopes.flatMap((scope) => (scope === 'WRITE' ? (['ARTICLE_WRITE'] as const) : KEY_TENANT_SCOPES[scope])),
  ),
]

export const requireApiKey = async (event: H3Event, scope: ApiKeyScope) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'x-api-key')

  const raw = getHeader(event, 'x-api-key')?.trim()
  if (!raw) throw createError({ statusCode: 401, message: 'Missing API Key' })

  const key = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(raw) },
    select: {
      id: true,
      scopes: true,
      createdById: true,
      revokedAt: true,
      deletedAt: true,
      lastUsedAt: true,
      clientSite: {
        select: {
          id: true,
          name: true,
          domain: true,
          description: true,
          logoUrl: true,
          language: true,
          theme: true,
          plan: true,
          deletedAt: true,
        },
      },
    },
  })
  if (!key || key.revokedAt || key.deletedAt || key.clientSite.deletedAt)
    throw createError({ statusCode: 401, message: 'Invalid API Key' })

  if (!(await consumeRateLimit(`api-key:${key.id}`, API_RATE_LIMIT.requests, API_RATE_LIMIT.windowSeconds))) {
    setResponseHeader(event, 'Retry-After', API_RATE_LIMIT.windowSeconds)
    throw createError({ statusCode: 429, message: 'Rate limit exceeded' })
  }
  if (!key.scopes.includes(scope)) throw createError({ statusCode: 403, message: `API key lacks the ${scope} scope` })

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS)
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch((error: unknown) => console.error('[api-keys] lastUsedAt update failed:', error))

  const { deletedAt: _deletedAt, plan, ...site } = key.clientSite
  const authenticated = { id: key.id, clientSiteId: site.id, scopes: key.scopes, createdById: key.createdById, plan }
  event.context.apiKey = authenticated
  return { key: authenticated, site }
}

/**
 * Write routes run the editor's own handlers as the member who created the key. The session-less request gets
 * that member as `authUser` and a membership narrowed to the key's scopes, so every existing check still applies.
 */
export const actAsApiKeyMember = async (event: H3Event, key: AuthenticatedApiKey): Promise<SessionUser> => {
  if (key.plan === 'BASIC')
    throw createError({ statusCode: 403, message: 'Writing through the API requires the Pro plan' })
  if (!key.createdById)
    throw createError({ statusCode: 403, message: 'This key is read-only. Create a new key to write through the API.' })

  const user = await prisma.user.findFirst({
    where: { id: key.createdById, deletedAt: null },
    select: { id: true, username: true, email: true, role: true, avatarUrl: true, language: true, theme: true },
  })
  const membership = user
    ? await prisma.tenantMembership.findUnique({
        where: { clientSiteId_userId: { clientSiteId: key.clientSiteId, userId: user.id } },
        select: { id: true, role: true, scopes: true, deletedAt: true },
      })
    : null
  const superadmin = user?.role === 'superadmin'
  if (!user || (!superadmin && (!membership || membership.deletedAt)))
    throw createError({ statusCode: 403, message: 'The member who created this key no longer has access to the site' })

  const memberScopes = superadmin || membership?.role === 'OWNER' ? TENANT_SCOPES : membership!.scopes
  const scopes = apiKeyTenantScopes(key.scopes, memberScopes)
  event.context.apiKeyMembership = {
    id: membership?.id ?? 'superadmin',
    clientSiteId: key.clientSiteId,
    userId: user.id,
    role: 'MEMBER',
    scopes,
  }
  // Never superadmin: ZenStack must keep the request inside the key's tenant.
  event.context.authUser = {
    id: user.id,
    name: user.username,
    email: user.email,
    role: 'admin',
    clientSiteId: key.clientSiteId,
    plan: key.plan,
    scopes,
    avatarUrl: user.avatarUrl,
    sessionId: `api-key:${key.id}`,
    language: user.language,
    theme: user.theme,
  }
  return event.context.authUser
}

const requestHash = (event: H3Event, body: unknown) =>
  createHash('sha256')
    .update(`${event.method} ${event.path.split('?')[0]}\n${JSON.stringify(body ?? null)}`)
    .digest('hex')

/**
 * A write retried with the same `Idempotency-Key` replays the stored response instead of running twice. Failed
 * requests are not stored, so the same key can retry them.
 */
export const withIdempotency = async <T>(
  event: H3Event,
  key: AuthenticatedApiKey,
  body: unknown,
  run: () => Promise<T>,
  { required = false } = {},
): Promise<T> => {
  const idempotencyKey = getHeader(event, 'idempotency-key')?.trim()
  if (!idempotencyKey) {
    if (required) throw createError({ statusCode: 400, message: 'The Idempotency-Key header is required' })
    return run()
  }
  if (idempotencyKey.length > 255)
    throw createError({ statusCode: 400, message: 'The Idempotency-Key header is at most 255 characters' })

  const hash = requestHash(event, body)
  const claim = () =>
    prisma.apiIdempotencyKey.create({
      data: { apiKeyId: key.id, key: idempotencyKey, requestHash: hash },
      select: { id: true },
    })
  let record = await claim().catch((error: unknown) => {
    if (!isUniqueViolation(error)) throw error
    return null
  })
  if (!record) {
    const existing = await prisma.apiIdempotencyKey.findUnique({
      where: { apiKeyId_key: { apiKeyId: key.id, key: idempotencyKey } },
      select: { id: true, requestHash: true, statusCode: true, response: true, createdAt: true },
    })
    if (existing && Date.now() - existing.createdAt.getTime() > IDEMPOTENCY_TTL_MS) {
      await prisma.apiIdempotencyKey.deleteMany({ where: { id: existing.id } })
      record = await claim()
    } else if (!existing) {
      record = await claim()
    } else {
      if (existing.requestHash !== hash)
        throw createError({ statusCode: 422, message: 'This Idempotency-Key was used for a different request' })
      if (existing.statusCode === null)
        throw createError({ statusCode: 409, message: 'A request with this Idempotency-Key is still running' })
      setResponseStatus(event, existing.statusCode)
      setResponseHeader(event, 'Idempotent-Replayed', 'true')
      return existing.response as T
    }
  }

  try {
    const result = await run()
    await prisma.apiIdempotencyKey.update({
      where: { id: record.id },
      data: { statusCode: getResponseStatus(event), response: toDatabaseJson(result ?? null) },
    })
    return result
  } catch (error) {
    await prisma.apiIdempotencyKey.deleteMany({ where: { id: record.id } })
    throw error
  }
}

export const pruneIdempotencyKeys = (now = new Date()) =>
  prisma.apiIdempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - IDEMPOTENCY_TTL_MS) } } })

export const logApiAction = (
  event: H3Event,
  key: AuthenticatedApiKey,
  action: string,
  metadata: Record<string, unknown> = {},
) =>
  logAction({
    action,
    userId: key.createdById ?? undefined,
    clientSiteId: key.clientSiteId,
    ip: getIp(event),
    metadata: { apiKeyId: key.id, ...metadata },
  }).catch((error) => reportCaughtError('API audit entry failed', error, { apiKeyId: key.id, action }))
