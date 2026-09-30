// @vitest-environment node
import { createError } from 'h3'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireShopifyAccess } from '../../../server/utils/shopify/access'

describe('Shopify access gates and webhooks', () => {
  const connectionUpdate = vi.fn()
  const publicationUpdate = vi.fn()
  const connectionDelete = vi.fn()
  let raw: string
  let signature: string
  let topic: string
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('requireUser', vi.fn(async () => ({ id: 'admin', role: 'admin', clientSiteId: 'site-1' })))
    vi.stubGlobal('requireTenantScope', vi.fn(async () => ({ membership: { role: 'OWNER', scopes: [] } })))
    vi.stubGlobal('getEnhancedPrisma', vi.fn(async () => ({ clientSite: { findUnique: async () => ({ id: 'site-1', plan: 'PRO' }) } })))
    const db = {
      shopifyConnection: { findUnique: async () => ({ id: 'connection-1' }), update: connectionUpdate, deleteMany: connectionDelete },
      shopifyPublication: { updateMany: publicationUpdate },
      shopifyOAuthAttempt: { deleteMany: vi.fn() },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
    }
    vi.stubGlobal('prisma', db)
    raw = '{"myshopify_domain":"store.myshopify.com"}'
    topic = 'app/uninstalled'
    signature = createHmac('sha256', 'secret').update(raw).digest('base64')
    vi.stubGlobal('readRawBody', async () => raw)
    vi.stubGlobal('getHeader', (_event: unknown, key: string) => ({ 'x-shopify-hmac-sha256': signature, 'x-shopify-shop-domain': 'store.myshopify.com', 'x-shopify-topic': topic })[key])
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  const webhook = async () => (await import('../../../server/api/shopify/webhooks.post')).default({} as never)

  it('requires tenant integration permissions for settings and publishing permissions for sends', async () => {
    await requireShopifyAccess({} as never)
    expect(requireTenantScope).toHaveBeenCalledWith({}, 'INTEGRATION_CONTROL', 'site-1')
    await requireShopifyAccess({} as never, 'ARTICLE_PUBLISH')
    expect(requireTenantScope).toHaveBeenCalledWith({}, 'ARTICLE_PUBLISH', 'site-1')
    vi.mocked(requireTenantScope).mockRejectedValue(createError({ statusCode: 403 }))
    await expect(requireShopifyAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects Basic plans before accessing Shopify', async () => {
    vi.mocked(getEnhancedPrisma).mockResolvedValue({ clientSite: { findUnique: async () => ({ id: 'site-1', plan: 'BASIC' }) } } as never)
    await expect(requireShopifyAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects forged webhook signatures before any database change', async () => {
    signature = 'forged'
    await expect(webhook()).rejects.toMatchObject({ statusCode: 401 })
    expect(connectionUpdate).not.toHaveBeenCalled()
  })

  it('clears credentials and stops queued publications after uninstall', async () => {
    expect(await webhook()).toEqual({ success: true })
    expect(connectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REVOKED', encryptedAccessToken: null, encryptedRefreshToken: null }) }))
    expect(publicationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', lease: null }) }))
  })

  it('cannot apply a signed uninstall payload to another shop', async () => {
    raw = '{"myshopify_domain":"other.myshopify.com"}'
    signature = createHmac('sha256', 'secret').update(raw).digest('base64')
    await expect(webhook()).rejects.toMatchObject({ statusCode: 400 })
    expect(connectionUpdate).not.toHaveBeenCalled()
  })

  it('removes store data on shop/redact and acknowledges customer topics without storing their payloads', async () => {
    raw = '{"shop_domain":"store.myshopify.com"}'
    signature = createHmac('sha256', 'secret').update(raw).digest('base64')
    topic = 'shop/redact'
    await webhook()
    expect(connectionDelete).toHaveBeenCalledWith({ where: { shop: 'store.myshopify.com' } })
    for (const next of ['customers/data_request', 'customers/redact']) {
      topic = next
      await expect(webhook()).resolves.toEqual({ success: true })
    }
    expect(connectionDelete).toHaveBeenCalledTimes(1)
  })
})
