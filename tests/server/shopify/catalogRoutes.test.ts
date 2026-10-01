// @vitest-environment node
import { createError } from 'h3'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requireShopifyAccess } from '../../../server/utils/shopify/access'
import { queueShopifyCatalog } from '../../../server/utils/shopify/catalog'
import { kickKnowledgeIndex, knowledgeLimits } from '../../../server/utils/knowledge/sources'

vi.mock('../../../server/utils/shopify/access', () => ({ requireShopifyAccess: vi.fn() }))
vi.mock('../../../server/utils/shopify/catalog', () => ({ queueShopifyCatalog: vi.fn() }))
vi.mock('../../../server/utils/knowledge/sources', () => ({
  hashKnowledge: () => 'a'.repeat(64),
  knowledgeLimits: vi.fn(),
  limitKnowledgeRequests: vi.fn(),
  kickKnowledgeIndex: vi.fn(),
}))

describe('Shopify catalog routes', () => {
  let input: Record<string, unknown>
  let source: Record<string, unknown> | null
  const upsert = vi.fn()
  const findConnection = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    input = { language: 'cs', confirmed: true }
    source = null
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('requireTenantScope', vi.fn())
    vi.stubGlobal('requireAiPlan', vi.fn())
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) => parse(input))
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    findConnection.mockResolvedValue({
      id: 'connection',
      status: 'CONNECTED',
      shopName: 'Shop',
      grantedScopes: ['read_products'],
    })
    upsert.mockResolvedValue({ id: 'source' })
    vi.mocked(requireShopifyAccess).mockResolvedValue({
      user: { id: 'user' },
      site: { id: 'tenant' },
      db: {
        shopifyConnection: { findUnique: findConnection },
        knowledgeSource: { findUnique: async () => source, upsert },
      },
    } as never)
    vi.mocked(knowledgeLimits).mockResolvedValue({
      maxSources: 50,
      maxProducts: 500,
      usage: { sources: 0, products: 0 },
    } as never)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const ingest = async () => (await import('../../../server/api/shopify/catalog.post')).default({} as never)

  it('creates one tenant-owned catalog source with explicit consent and selected language', async () => {
    expect(await ingest()).toEqual({ sourceId: 'source' })
    expect(requireTenantScope).toHaveBeenCalledWith({}, 'TENANT_SETTINGS', 'tenant')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopifyConnectionId: 'connection' },
        create: expect.objectContaining({
          clientSiteId: 'tenant',
          kind: 'SHOPIFY',
          language: 'cs',
          shopifyConnectionId: 'connection',
        }),
      }),
    )
    expect(kickKnowledgeIndex).toHaveBeenCalledWith('source')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ consent: expect.objectContaining({ version: 1 }) }),
      }),
    )
  })

  it('requires knowledge permissions and consent before writing a source', async () => {
    vi.mocked(requireTenantScope).mockRejectedValueOnce(createError({ statusCode: 403 }))
    await expect(ingest()).rejects.toMatchObject({ statusCode: 403 })
    input.confirmed = false
    await expect(ingest()).rejects.toThrow()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('enforces source and product quotas for first import', async () => {
    vi.mocked(knowledgeLimits).mockResolvedValue({
      maxSources: 50,
      maxProducts: 500,
      usage: { sources: 50, products: 0 },
    } as never)
    await expect(ingest()).rejects.toMatchObject({ statusCode: 409, data: { code: 'KNOWLEDGE_QUOTA' } })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejects a missing product scope and does not reset a running sync', async () => {
    findConnection.mockResolvedValueOnce({ id: 'connection', status: 'CONNECTED', grantedScopes: ['write_content'] })
    await expect(ingest()).rejects.toMatchObject({ statusCode: 409 })
    source = { id: 'source', status: 'PROCESSING' }
    await expect(ingest()).rejects.toMatchObject({ statusCode: 409 })
    expect(upsert).not.toHaveBeenCalled()
  })

  it.each([
    'products/create',
    'products/update',
    'products/delete',
    'collections/create',
    'collections/update',
    'collections/delete',
    'inventory_levels/update',
    'inventory_items/update',
  ])('queues a signed %s event for the authenticated shop', async (topic) => {
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
    const raw = '{}'
    const signature = createHmac('sha256', 'secret').update(raw).digest('base64')
    vi.stubGlobal('readRawBody', async () => raw)
    vi.stubGlobal(
      'getHeader',
      (_event: unknown, name: string) =>
        ({
          'x-shopify-topic': topic,
          'x-shopify-shop-domain': 'store.myshopify.com',
          'x-shopify-hmac-sha256': signature,
        })[name],
    )
    const handler = (await import('../../../server/api/shopify/webhooks.post')).default
    expect(await handler({} as never)).toEqual({ success: true })
    expect(queueShopifyCatalog).toHaveBeenCalledWith('store.myshopify.com')
  })
})
