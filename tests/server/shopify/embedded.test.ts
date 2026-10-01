// @vitest-environment node
import { createError } from 'h3'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { syncShopifyPlan } from '../../../server/utils/shopify/billing'
import { renderShopifyAppHome } from '../../../server/utils/shopify/appHome'
import { signShopifyLink, verifyShopifyLink } from '../../../server/utils/shopify/security'
import { shopifyGraphql, shopifyTokenExchange, ShopifyApiError } from '../../../server/utils/shopify/api'

vi.mock('../../../server/utils/shopify/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/api')>()),
  shopifyGraphql: vi.fn(),
  shopifyTokenExchange: vi.fn(),
}))
vi.mock('../../../server/utils/shopify/billing', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/billing')>()),
  syncShopifyPlan: vi.fn(async () => undefined),
}))

const INSTALLATION_ID = '0d4c1b0e-6f0a-4a8e-9c1d-2b3a4c5d6e7f'

const idToken = (shop = 'store.myshopify.com') => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const body = `${encode({ alg: 'HS256' })}.${encode({
    iss: `https://${shop}/admin`,
    dest: `https://${shop}`,
    aud: 'client',
    exp: now + 60,
    nbf: now - 1,
  })}`
  return `${body}.${createHmac('sha256', 'secret').update(body).digest('base64url')}`
}

const stubEnv = () => {
  vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
  vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
  vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
  vi.stubEnv('SHOPIFY_APP_HANDLE', 'topiqu')
  vi.stubEnv('APP_URL', 'https://app.topiqu.com')
}

describe('Shopify App Home session', () => {
  let headers: Record<string, string>
  let connection: Record<string, unknown> | null
  let installation: Record<string, unknown> | null
  let site: Record<string, unknown>
  const responseHeaders: Record<string, string> = {}
  const connectionUpdate = vi.fn()
  const installationUpsert = vi.fn(async () => ({ id: INSTALLATION_ID }))

  beforeEach(() => {
    vi.clearAllMocks()
    stubEnv()
    headers = { authorization: `Bearer ${idToken()}` }
    connection = null
    installation = null
    site = { name: 'Shop blog', plan: 'BASIC', billingProvider: 'SHOPIFY' }
    vi.stubGlobal('prisma', {
      shopifyConnection: { findUnique: async () => connection, update: connectionUpdate },
      shopifyInstallation: { findUnique: async () => installation, upsert: installationUpsert },
      clientSite: { findUnique: async () => site },
    })
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getHeader', (_event: unknown, key: string) => headers[key])
    vi.stubGlobal('setHeader', (_event: unknown, key: string, value: string) => {
      responseHeaders[key] = value
    })
    vi.stubGlobal('readBody', async () => ({ refresh: true }))
    vi.mocked(shopifyTokenExchange).mockResolvedValue({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      scope: 'read_products,write_content',
    })
    vi.mocked(shopifyGraphql).mockResolvedValue({
      shop: { id: 'gid://shopify/Shop/1', name: 'Store', primaryDomain: { url: 'https://store.example' } },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const run = async () => (await import('../../../server/api/shopify/app/session.post')).default({} as never)

  it('rejects a missing or forged ID token and asks App Bridge to retry', async () => {
    headers = { authorization: `Bearer ${idToken().slice(0, -2)}xx` }
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
    expect(responseHeaders['X-Shopify-Retry-Invalid-Session-Request']).toBe('1')
    expect(shopifyTokenExchange).not.toHaveBeenCalled()
  })

  it('stores an unlinked store as an encrypted installation and returns a signed link', async () => {
    const state = (await run()) as { linked: boolean; linkUrl: string }
    expect(state.linked).toBe(false)
    expect(shopifyTokenExchange).toHaveBeenCalledWith('store.myshopify.com', expect.any(String))
    const saved = (installationUpsert.mock.calls[0] as never[])[0] as { create: Record<string, string> }
    expect(saved.create.encryptedAccessToken).not.toContain('access-secret')
    expect(saved.create.shopGid).toBe('gid://shopify/Shop/1')
    const code = new URL(state.linkUrl).searchParams.get('code')
    expect(state.linkUrl.startsWith('https://app.topiqu.com/api/shopify/link?')).toBe(true)
    expect(verifyShopifyLink(code)).toBe(INSTALLATION_ID)
  })

  it('treats a revoked connection as unlinked instead of silently reconnecting it', async () => {
    connection = { id: 'connection-1', status: 'REVOKED', shopGid: 'gid', grantedScopes: ['write_content'], clientSiteId: 'site-1' }
    expect(await run()).toMatchObject({ linked: false })
    expect(connectionUpdate).not.toHaveBeenCalled()
  })

  it('heals an expired grant of a linked store and reports the Shopify plan state', async () => {
    connection = { id: 'connection-1', status: 'REAUTH_REQUIRED', shopGid: 'gid', grantedScopes: ['write_content'], clientSiteId: 'site-1' }
    expect(await run()).toEqual({
      linked: true,
      project: 'Shop blog',
      plan: 'BASIC',
      needsPlan: true,
      pricingUrl: 'https://admin.shopify.com/store/store/charges/topiqu/pricing_plans',
    })
    expect(connectionUpdate).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: expect.objectContaining({ status: 'CONNECTED', catalogRevision: { increment: 1 }, refreshLease: null }),
    })
    expect(syncShopifyPlan).toHaveBeenCalledWith('connection-1', { force: true })
  })

  it('leaves a healthy connection alone and hides Shopify pricing from Stripe customers', async () => {
    connection = { id: 'connection-1', status: 'CONNECTED', shopGid: 'gid', grantedScopes: ['write_content'], clientSiteId: 'site-1' }
    site = { name: 'Shop blog', plan: 'PRO', billingProvider: 'STRIPE' }
    expect(await run()).toMatchObject({ linked: true, needsPlan: false, pricingUrl: null })
    expect(shopifyTokenExchange).not.toHaveBeenCalled()
  })

  it('answers a rejected token exchange with a retryable 401', async () => {
    vi.mocked(shopifyTokenExchange).mockRejectedValue(new ShopifyApiError('REAUTH_REQUIRED', 'expired'))
    await expect(run()).rejects.toMatchObject({ statusCode: 401 })
  })
})

describe('Shopify store linking', () => {
  let cookies: Record<string, string | undefined>
  let membership: { role: string; scopes: string[] }
  let site: Record<string, unknown>
  let installationRow: Record<string, unknown> | null
  let connections: Record<string, Record<string, unknown> | null>
  const setCookie = vi.fn()
  const deleteCookie = vi.fn()
  const created = vi.fn(async () => ({ id: 'connection-new' }))
  const updated = vi.fn(async () => ({ id: 'connection-1' }))
  const deleted = vi.fn()
  const siteUpdate = vi.fn()
  const installationDelete = vi.fn(async () => ({ count: 1 }))

  beforeEach(() => {
    vi.clearAllMocks()
    stubEnv()
    cookies = { shopify_link: signShopifyLink(INSTALLATION_ID) }
    membership = { role: 'OWNER', scopes: [] }
    site = { plan: 'BASIC', stripeSubscriptionId: null, billingProvider: 'STRIPE' }
    installationRow = {
      id: INSTALLATION_ID,
      shop: 'store.myshopify.com',
      shopName: 'Store',
      shopGid: 'gid://shopify/Shop/1',
      storefrontUrl: 'https://store.example',
      encryptedAccessToken: 'enc-access',
      encryptedRefreshToken: 'enc-refresh',
      accessTokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
      grantedScopes: ['write_content'],
    }
    connections = { site: null, shop: null }
    const db = {
      shopifyInstallation: { findUnique: async () => installationRow, deleteMany: installationDelete },
      shopifyConnection: {
        findUnique: async ({ where }: { where: Record<string, string> }) =>
          where.clientSiteId ? connections.site : connections.shop,
        create: created,
        update: updated,
        delete: deleted,
      },
      clientSite: { findUnique: async () => site, update: siteUpdate },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
    }
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getCookie', (_event: unknown, key: string) => cookies[key])
    vi.stubGlobal('setCookie', setCookie)
    vi.stubGlobal('deleteCookie', deleteCookie)
    vi.stubGlobal('setHeader', vi.fn())
    vi.stubGlobal('getQuery', () => ({ code: cookies.shopify_link }))
    vi.stubGlobal('sendRedirect', (_event: unknown, url: string) => url)
    vi.stubGlobal('requireUser', vi.fn(async () => ({ id: 'user-1', role: 'admin', clientSiteId: 'site-1' })))
    vi.stubGlobal('requireTenantScope', vi.fn(async () => ({ membership })))
    vi.stubGlobal(
      'hasTenantScope',
      (value: { role: string; scopes: string[] }, scope: string) => value.role === 'OWNER' || value.scopes.includes(scope),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const land = async () => (await import('../../../server/api/shopify/link.get')).default({} as never)
  const claim = async () => (await import('../../../server/api/shopify/link.post')).default({} as never)

  it('moves a valid link into an httpOnly cookie and rejects altered ones', async () => {
    expect(await land()).toBe('https://app.topiqu.com/en/settings?tab=integrations&shopify=link')
    expect(setCookie).toHaveBeenCalledWith({}, 'shopify_link', cookies.shopify_link, expect.objectContaining({ httpOnly: true, path: '/api/shopify' }))
    expect(setCookie).toHaveBeenCalledWith({}, 'shopify_install', 'store.myshopify.com', expect.objectContaining({ path: '/' }))
    setCookie.mockClear()
    cookies.shopify_link = `${cookies.shopify_link}x`
    expect(await land()).toBe('https://app.topiqu.com/en/settings?tab=integrations&shopify=expired')
    expect(setCookie).not.toHaveBeenCalled()
  })

  it('links the session project and moves a project without Stripe to Shopify billing', async () => {
    expect(await claim()).toEqual({ success: true })
    expect(created).toHaveBeenCalledWith({
      data: expect.objectContaining({ clientSiteId: 'site-1', shop: 'store.myshopify.com', encryptedAccessToken: 'enc-access', status: 'CONNECTED' }),
      select: { id: true },
    })
    expect(siteUpdate).toHaveBeenCalledWith({ where: { id: 'site-1' }, data: { billingProvider: 'SHOPIFY' } })
    expect(deleteCookie).toHaveBeenCalledWith({}, 'shopify_link', expect.anything())
    expect(syncShopifyPlan).toHaveBeenCalledWith('connection-new', { force: true })
  })

  it('keeps existing Stripe customers on Stripe', async () => {
    site = { plan: 'PRO', stripeSubscriptionId: 'sub_1', billingProvider: 'STRIPE' }
    membership = { role: 'MEMBER', scopes: ['INTEGRATION_CONTROL'] }
    await claim()
    expect(created).toHaveBeenCalled()
    expect(siteUpdate).not.toHaveBeenCalled()
  })

  it('requires billing permission to switch the project to Shopify billing', async () => {
    membership = { role: 'MEMBER', scopes: ['INTEGRATION_CONTROL'] }
    await expect(claim()).rejects.toMatchObject({ statusCode: 403 })
    expect(installationDelete).not.toHaveBeenCalled()
  })

  it('rejects a claim without a valid signed cookie', async () => {
    cookies.shopify_link = undefined
    await expect(claim()).rejects.toMatchObject({ statusCode: 403 })
    cookies.shopify_link = signShopifyLink(INSTALLATION_ID)
    installationRow = null
    await expect(claim()).rejects.toMatchObject({ statusCode: 403 })
  })

  it('never takes a store from a project that still has it connected', async () => {
    connections.shop = { id: 'connection-other', clientSiteId: 'site-2', status: 'CONNECTED' }
    await expect(claim()).rejects.toMatchObject({ statusCode: 409 })
    expect(deleted).not.toHaveBeenCalled()
    expect(created).not.toHaveBeenCalled()
  })

  it('replaces a revoked connection of another project', async () => {
    connections.shop = { id: 'connection-other', clientSiteId: 'site-2', status: 'REVOKED' }
    await claim()
    expect(deleted).toHaveBeenCalledWith({ where: { id: 'connection-other' } })
    expect(created).toHaveBeenCalled()
  })

  it('refuses a second store while the project still has one connected', async () => {
    connections.site = { id: 'connection-1', shop: 'first.myshopify.com', status: 'CONNECTED' }
    await expect(claim()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('reactivates the same store on its own project', async () => {
    connections.site = { id: 'connection-1', shop: 'store.myshopify.com', status: 'REVOKED' }
    connections.shop = { id: 'connection-1', clientSiteId: 'site-1', status: 'REVOKED' }
    await claim()
    expect(updated).toHaveBeenCalledWith({
      where: { id: 'connection-1' },
      data: expect.objectContaining({ status: 'CONNECTED', catalogRevision: { increment: 1 } }),
      select: { id: true },
    })
  })

  it('cannot claim one installation twice', async () => {
    installationDelete.mockResolvedValueOnce({ count: 0 })
    await expect(claim()).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('Shopify App Home document', () => {
  it('loads App Bridge first, binds the script to the nonce and escapes translations', () => {
    const html = renderShopifyAppHome({
      lang: 'cs',
      clientId: 'client"id',
      nonce: 'nonce-1',
      openUrl: 'https://app.topiqu.com/cs/start',
      t: (key) => (key.endsWith('.about') ? '<img src=x onerror=alert(1)>' : key),
    })
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(([tag]) => tag)
    expect(scripts[0]).toBe('<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js">')
    expect(scripts.at(-1)).toContain('nonce="nonce-1"')
    expect(html).toContain('content="client&#34;id"')
    expect(html).not.toContain('<img src=x')
  })
})
