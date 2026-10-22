import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionUser } from '../../shared/types/auth'

import * as integration from '../../server/utils/integrationOAuth'
import {
  authTransferHash,
  authTransferSecret,
  requireCentralAuth,
  requireSameAuthOrigin,
} from '../../server/utils/authTransfer'

const request = 'r'.repeat(43)
const secret = 's'.repeat(43)
const origin = 'https://blog.example.test'
const central = 'https://app.topiqu.com'
const event = {} as never
const scope = vi.fn()
const source = vi.fn()
const target = vi.fn()
const actualMember = vi.fn()
const remove = vi.fn()
const update = vi.fn()
const create = vi.fn()
let user: SessionUser
let saved: string | undefined
let query: Record<string, string>
let requestOrigin: string
let headerOrigin: string
let body: Record<string, unknown>
let row: { id: string; value: string; expiresAt: Date } | null

const data = () => ({
  actorId: 'actor',
  sourceSessionId: 'source-session',
  tenantId: 'tenant-a',
  origin,
  locale: 'cs' as const,
  provider: 'linkedin' as const,
  platformAdmin: false,
})
const resetTicket = (authorized = true) => {
  row = {
    id: authTransferHash(request),
    value: JSON.stringify({ ...data(), ...(authorized ? { stateHash: authTransferHash(secret) } : {}) }),
    expiresAt: new Date(Date.now() + 600_000),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('AUTH_ORIGIN', central)
  vi.stubEnv('APP_URL', central)
  vi.stubEnv('LINKEDIN_CLIENT_ID_PERSONAL', 'personal-client')
  user = {
    id: 'actor',
    sessionId: 'central-session',
    name: 'Fixture',
    email: 'fixture@example.test',
    role: 'admin',
    clientSiteId: 'tenant-b',
    scopes: [],
    plan: 'PREMIUM',
    avatarUrl: null,
  }
  requestOrigin = central
  headerOrigin = central
  query = { state: `${request}.${secret}` }
  saved = query.state
  body = { request }
  resetTicket()
  scope.mockImplementation(async () => ({ user, membership: { role: 'OWNER', scopes: ['INTEGRATION_CONTROL'] } }))
  source.mockResolvedValue({ id: 'source-session' })
  target.mockResolvedValue({ id: 'tenant-a', domain: 'blog.example.test' })
  actualMember.mockResolvedValue(null)
  remove.mockImplementation(async ({ where }) => {
    if (!row || row.id !== where.id || row.value !== where.value) return { count: 0 }
    row = null
    return { count: 1 }
  })
  update.mockImplementation(async ({ where, data: change }) => {
    if (!row || row.id !== where.id || row.value !== where.value) return { count: 0 }
    row = { ...row, ...change }
    return { count: 1 }
  })
  create.mockResolvedValue({})
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRequestURL', () => new URL(requestOrigin))
  vi.stubGlobal('getRequestHeader', () => headerOrigin)
  vi.stubGlobal('requireCentralAuth', requireCentralAuth)
  vi.stubGlobal('requireSameAuthOrigin', requireSameAuthOrigin)
  vi.stubGlobal('requireUser', async () => user)
  vi.stubGlobal('getSessionUser', async () => user)
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('getIp', () => 'test-ip')
  vi.stubGlobal('getCookie', () => 'cs')
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('takeOAuthState', () => saved)
  vi.stubGlobal('setOAuthState', vi.fn())
  vi.stubGlobal('setResponseHeader', vi.fn())
  vi.stubGlobal('authTransferSecret', authTransferSecret)
  vi.stubGlobal('authTransferHash', authTransferHash)
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) => parse(body))
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (body: unknown) => unknown) => parse(query))
  for (const [name, value] of Object.entries(integration)) vi.stubGlobal(name, value)
  vi.stubGlobal('prisma', {
    clientSite: { findFirst: target },
    tenantMembership: { findUnique: actualMember },
    session: { findFirst: source },
    verification: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => (row && row.expiresAt > new Date() ? row : null)),
      create,
      deleteMany: remove,
      updateMany: update,
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('central integration OAuth handoff', () => {
  it('stores only a hash of the source ticket and binds its actor, tenant and verified origin', async () => {
    requestOrigin = origin
    user.clientSiteId = 'tenant-a'
    const result = await integration.createIntegrationTicket(event, 'linkedin', 'tenant-a', 'cs')
    const ticket = new URL(result.url).searchParams.get('request')!
    const stored = create.mock.calls[0]![0].data
    expect(result.url).toContain(`${central}/cs/integrations-connect?request=`)
    expect(stored.id).toBe(authTransferHash(ticket))
    expect(stored.value).not.toContain(ticket)
    expect(JSON.parse(stored.value)).toMatchObject({
      actorId: 'actor',
      tenantId: 'tenant-a',
      origin,
      platformAdmin: false,
    })
    expect(target).toHaveBeenCalledWith({
      where: { id: 'tenant-a', deletedAt: null, domain: 'blog.example.test', domainVerified: true },
      select: { id: true, domain: true },
    })
  })
  it('authorizes the original tenant even if the central session selects another project', async () => {
    const result = await integration.consumeIntegrationOAuth(event, 'linkedin')
    expect(result.user.clientSiteId).toBe('tenant-a')
    expect(scope).toHaveBeenCalledWith(event, 'INTEGRATION_CONTROL', 'tenant-a')
  })
  it('accepts the trusted platform root while still looking up the selected tenant', async () => {
    await integration.requireIntegrationOrigin('https://topiqu.com', 'tenant-a')
    expect(target).toHaveBeenCalledWith({
      where: { id: 'tenant-a', deletedAt: null },
      select: { id: true, domain: true },
    })
  })
  it.each(['https://another.topiqu.com', 'https://topiqu.com:444', 'http://topiqu.com'])(
    'does not treat %s as the trusted platform origin',
    async (origin) => {
      await integration.requireIntegrationOrigin(origin, 'tenant-a')
      expect(target).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ domain: new URL(origin).hostname, domainVerified: true }),
        }),
      )
    },
  )
  it.each(['another-account', 'anonymous'])('rejects a different account: %s', async (id) => {
    user.id = id
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
    expect(remove).not.toHaveBeenCalled()
  })
  it('rechecks revoked membership before completing the connection', async () => {
    scope.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
    expect(remove).not.toHaveBeenCalled()
  })
  it('does not promote a custom-host request to platform administrator access', async () => {
    user.role = 'superadmin'
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
    expect(actualMember).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientSiteId_userId: { clientSiteId: 'tenant-a', userId: 'actor' } } }),
    )
  })
  it('requires the initiating session to remain valid', async () => {
    source.mockResolvedValue(null)
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
    expect(remove).not.toHaveBeenCalled()
  })
  it.each([undefined, 'forged-state'])('rejects missing or mismatched browser CSRF state', async (state) => {
    saved = state
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
    expect(remove).not.toHaveBeenCalled()
  })
  it('rejects an invalid callback secret even when copied into a cookie', async () => {
    saved = query.state = `${request}.${'x'.repeat(43)}`
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects expired tickets and changed domain ownership', async () => {
    row!.expiresAt = new Date(0)
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 400 })
    resetTicket()
    target.mockResolvedValue(null)
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('atomically consumes callbacks and blocks replay or a concurrent callback', async () => {
    const results = await Promise.allSettled([
      integration.consumeIntegrationOAuth(event, 'linkedin'),
      integration.consumeIntegrationOAuth(event, 'linkedin'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    await expect(integration.consumeIntegrationOAuth(event, 'linkedin')).rejects.toBeDefined()
  })
  it('keeps LinkedIn scopes personal and sends the registered central callback', () => {
    const url = new URL(integration.integrationOAuthUrl('linkedin', 'opaque'))
    expect(url.searchParams.get('scope')).toBe('openid profile email w_member_social')
    expect(url.searchParams.get('redirect_uri')).toBe(`${central}/api/linkedin/callback`)
    expect(url.searchParams.get('client_id')).toBe('personal-client')
  })
  it('returns cancellation to the exact verified source origin and locale', async () => {
    resetTicket(false)
    body.cancel = true
    const handler = (await import('../../server/api/integrations/authorize.post')).default
    await expect(handler(event)).resolves.toEqual({ url: `${origin}/cs/settings?tab=integrations&linkedin=cancelled` })
    expect(row).toBeNull()
  })
  it('requires a same-origin POST for confirmation', async () => {
    resetTicket(false)
    headerOrigin = 'https://evil.example.test'
    const handler = (await import('../../server/api/integrations/authorize.post')).default
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(update).not.toHaveBeenCalled()
  })
  it('shows a cold central session only the confirmation target, then recognizes the same signed-in actor', async () => {
    resetTicket(false)
    query = { request }
    vi.stubGlobal('getSessionUser', async () => null)
    const handler = (await import('../../server/api/integrations/request.get')).default
    await expect(handler(event)).resolves.toEqual({
      host: 'blog.example.test',
      provider: 'linkedin',
      accountMatches: false,
    })
    vi.stubGlobal('getSessionUser', async () => user)
    await expect(handler(event)).resolves.toMatchObject({ accountMatches: true })
  })
  it('does not authorize a cold central session until it signs in', async () => {
    resetTicket(false)
    vi.stubGlobal('requireUser', async () => {
      throw createError({ statusCode: 401 })
    })
    const handler = (await import('../../server/api/integrations/authorize.post')).default
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(update).not.toHaveBeenCalled()
  })
  it('requires a central session for confirmation and atomically starts OAuth only once', async () => {
    resetTicket(false)
    const handler = (await import('../../server/api/integrations/authorize.post')).default
    const result = await handler(event)
    expect(new URL(result.url).origin).toBe('https://www.linkedin.com')
    expect(JSON.parse(row!.value).stateHash).toMatch(/^[a-f0-9]{64}$/)
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 409 })
  })
})
