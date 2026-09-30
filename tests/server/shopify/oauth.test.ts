// @vitest-environment node
import { createError } from 'h3'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hashShopifyState } from '../../../server/utils/shopify/security'
import { shopifyGraphql, shopifyTokenRequest } from '../../../server/utils/shopify/api'

vi.mock('../../../server/utils/shopify/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/api')>()),
  shopifyGraphql: vi.fn(),
  shopifyTokenRequest: vi.fn(),
}))

describe('Shopify callback and tenant binding', () => {
  const state = 'a'.repeat(64)
  let query: Record<string, string>
  let membership: { role: string; scopes: string[]; deletedAt: Date | null } | null
  let attempt: Record<string, unknown> | null
  let cookie: string
  const attemptDelete = vi.fn()
  const saveConnection = vi.fn()
  const findConnection = vi.fn()

  const sign = () => {
    const message = Object.keys(query)
      .filter((key) => key !== 'hmac')
      .sort()
      .map((key) => `${key}=${query[key]}`)
      .join('&')
    query.hmac = createHmac('sha256', 'secret').update(message).digest('hex')
  }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    vi.stubEnv('APP_URL', 'https://app.topiqu.com')
    cookie = state
    query = { state, code: 'valid-code', shop: 'store.myshopify.com', timestamp: String(Math.floor(Date.now() / 1000)) }
    sign()
    membership = { role: 'OWNER', scopes: [], deletedAt: null }
    attempt = {
      id: 'attempt-1',
      userId: 'user-1',
      clientSiteId: 'tenant-1',
      shop: 'store.myshopify.com',
      locale: 'cs',
      expiresAt: new Date(Date.now() + 60_000),
    }
    attemptDelete.mockResolvedValue({ count: 1 })
    findConnection.mockResolvedValue(null)
    const db = {
      shopifyOAuthAttempt: {
        findUnique: vi.fn(async ({ where }) => (where.tokenHash === hashShopifyState(state) ? attempt : null)),
        deleteMany: attemptDelete,
      },
      user: { findUnique: vi.fn(async () => ({ id: 'user-1', role: 'admin', deletedAt: null })) },
      tenantMembership: { findUnique: vi.fn(async () => membership) },
      clientSite: {
        findUnique: vi.fn(async () => ({ domain: 'custom-tenant.example', plan: 'PRO', deletedAt: null })),
      },
      shopifyConnection: { findUnique: findConnection, create: saveConnection, update: saveConnection },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
    }
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getQuery', () => query)
    vi.stubGlobal('getCookie', () => cookie)
    vi.stubGlobal('deleteCookie', vi.fn())
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
    vi.stubGlobal(
      'hasTenantScope',
      (value: { role: string; scopes: string[] }, scope: string) =>
        value.role === 'OWNER' || value.scopes.includes(scope),
    )
    vi.mocked(shopifyTokenRequest).mockResolvedValue({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      scope: 'write_content',
    })
    vi.mocked(shopifyGraphql).mockResolvedValue({
      shop: { name: 'Store', primaryDomain: { url: 'https://store.example' } },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const run = async () => (await import('../../../server/api/shopify/callback.get')).default({} as never)

  it('connects the initiating tenant and locale even when the callback has no session on its custom domain', async () => {
    expect(await run()).toBe('https://custom-tenant.example/cs/settings?tab=integrations&shopify=connected')
    expect(attemptDelete).toHaveBeenCalledWith({ where: { id: 'attempt-1', expiresAt: expect.any(Object) } })
    const saved = saveConnection.mock.calls[0]![0].data
    expect(saved.clientSiteId).toBe('tenant-1')
    expect(saved.encryptedAccessToken).not.toContain('access-secret')
    expect(saved.encryptedRefreshToken).not.toContain('refresh-secret')
    expect(shopifyTokenRequest).toHaveBeenCalledWith('store.myshopify.com', { code: 'valid-code', expiring: '1' })
  })

  it('rejects an OAuth state that is not bound to the browser cookie', async () => {
    cookie = 'b'.repeat(64)
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('rejects a callback whose shop was altered after signing', async () => {
    query.shop = 'attacker.myshopify.com'
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(saveConnection).not.toHaveBeenCalled()
  })

  it('rejects a correctly signed callback for a shop different from the original attempt', async () => {
    query.shop = 'other.myshopify.com'
    sign()
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects expired and already consumed attempts', async () => {
    attempt!.expiresAt = new Date(Date.now() - 1)
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    attempt = null
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('rechecks integration permissions after Shopify approval', async () => {
    membership = { role: 'MEMBER', scopes: ['ARTICLE_PUBLISH'], deletedAt: null }
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    membership = null
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('cannot exchange a code when another callback wins the atomic consumption', async () => {
    attemptDelete.mockResolvedValue({ count: 0 })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('does not switch an existing connection to a different store', async () => {
    findConnection.mockResolvedValue({ id: 'connection-1', shop: 'existing.myshopify.com' })
    expect(await run()).toContain('shopify=error')
    expect(saveConnection).not.toHaveBeenCalled()
  })
})

describe('Shopify authorization account binding', () => {
  const state = 'a'.repeat(64)
  const user = vi.fn()
  const permissions = vi.fn()
  const cookie = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APP_URL', 'https://app.topiqu.com')
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getQuery', () => ({ state }))
    vi.stubGlobal('getRequestURL', () => new URL('https://app.topiqu.com/api/shopify/authorize'))
    vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
    vi.stubGlobal('requireUser', user)
    vi.stubGlobal('requireTenantScope', permissions)
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('setCookie', cookie)
    vi.stubGlobal('prisma', {
      shopifyOAuthAttempt: {
        findUnique: vi.fn(async () => ({
          userId: 'initiator',
          clientSiteId: 'tenant-1',
          shop: 'store.myshopify.com',
          expiresAt: new Date(Date.now() + 60_000),
        })),
      },
    })
    user.mockResolvedValue({ id: 'initiator', role: 'admin' })
    permissions.mockResolvedValue({})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const run = async () => (await import('../../../server/api/shopify/authorize.get')).default({} as never)
  it('sets the browser cookie only for the initiating account with current integration permission', async () => {
    expect(await run()).toContain('https://store.myshopify.com/admin/oauth/authorize?')
    expect(permissions).toHaveBeenCalledWith({}, 'INTEGRATION_CONTROL', 'tenant-1')
    expect(cookie).toHaveBeenCalledWith(
      {},
      'shopify_oauth_state',
      state,
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }),
    )
  })
  it('rejects a copied authorization link opened by a different account', async () => {
    user.mockResolvedValue({ id: 'another-account', role: 'admin' })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(cookie).not.toHaveBeenCalled()
  })
  it('rejects an unsigned-in browser before creating its authorization cookie', async () => {
    user.mockRejectedValue(createError({ statusCode: 401 }))
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(cookie).not.toHaveBeenCalled()
  })
  it('rechecks permissions before redirecting to Shopify', async () => {
    permissions.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(cookie).not.toHaveBeenCalled()
  })
})

describe('Shopify-initiated install', () => {
  let query: Record<string, string>
  const cookie = vi.fn()
  const sign = () => {
    const message = Object.keys(query)
      .filter((key) => key !== 'hmac')
      .sort()
      .map((key) => `${key}=${query[key]}`)
      .join('&')
    query.hmac = createHmac('sha256', 'secret').update(message).digest('hex')
  }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APP_URL', 'https://app.topiqu.com')
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getQuery', () => query)
    vi.stubGlobal('getCookie', () => 'cs')
    vi.stubGlobal('setCookie', cookie)
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
    query = { host: 'YWRtaW4', shop: 'store.myshopify.com', timestamp: String(Math.floor(Date.now() / 1000)) }
    sign()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const run = async () => (await import('../../../server/api/shopify/install.get')).default({} as never)

  it('remembers the signed store and opens the integration settings', async () => {
    expect(await run()).toBe('https://app.topiqu.com/cs/settings?tab=integrations&shopify=install')
    expect(cookie).toHaveBeenCalledWith(
      {},
      'shopify_install',
      'store.myshopify.com',
      expect.objectContaining({ secure: true, sameSite: 'lax', path: '/' }),
    )
  })
  it('rejects a store swapped after signing', async () => {
    query.shop = 'other.myshopify.com'
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(cookie).not.toHaveBeenCalled()
  })
  it('rejects a replayed launch link', async () => {
    query = { shop: 'store.myshopify.com', timestamp: String(Math.floor(Date.now() / 1000) - 7200) }
    sign()
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(cookie).not.toHaveBeenCalled()
  })
})
