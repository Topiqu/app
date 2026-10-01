// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shopifyGraphql } from '../../../server/utils/shopify/api'
import { shopifyAccessToken } from '../../../server/utils/shopify/token'
import { collectFeedProducts } from '../../../server/utils/knowledge/feed'
import {
  catalogVariants,
  fetchShopifyCatalog,
  queueShopifyCatalog,
  type CatalogProduct,
} from '../../../server/utils/shopify/catalog'

vi.mock('../../../server/utils/shopify/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/api')>()),
  shopifyGraphql: vi.fn(),
}))
vi.mock('../../../server/utils/shopify/token', () => ({ shopifyAccessToken: vi.fn() }))

const page = <T>(nodes: T[], hasNextPage = false, endCursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage, endCursor },
})
const STOREFRONT = 'https://dev-store.myshopify.com'
const product = (id = '1'): CatalogProduct => ({
  id: `gid://shopify/Product/${id}`,
  title: 'Running shoes',
  description: '<p>Lightweight shoes.</p>',
  vendor: 'Example',
  productType: 'Shoes',
  handle: `shoes-${id}`,
  onlineStoreUrl: `https://shop.example/products/shoes-${id}`,
  variants: page([
    {
      id: `gid://shopify/ProductVariant/${id}`,
      price: '99.00',
      inventoryQuantity: 2,
      inventoryPolicy: 'DENY',
      inventoryItem: { tracked: true },
      selectedOptions: [{ name: 'Size', value: '42' }],
    },
  ]),
  collections: page([
    { id: 'gid://shopify/Collection/1', title: 'Trail running', description: 'For off-road runners', handle: 'trail' },
  ]),
})
const result = (products: CatalogProduct[], more = false, cursor: string | null = null) => ({
  shop: { currencyCode: 'EUR' },
  products: page(products, more, cursor),
})

describe('Shopify catalog ingestion', () => {
  const findConnection = vi.fn()
  const connectionUpdate = vi.fn()
  const sourceUpdate = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    findConnection.mockResolvedValue({
      id: 'connection',
      shop: 'store.myshopify.com',
      grantedScopes: ['read_products'],
      catalogRevision: 7,
    })
    vi.mocked(shopifyAccessToken).mockResolvedValue('token')
    vi.stubGlobal('prisma', {
      shopifyConnection: { findFirst: findConnection, updateMany: connectionUpdate },
      knowledgeSource: { updateMany: sourceUpdate },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('merges variants into knowledge with collection context and factual prices', () => {
    const item = product()
    item.variants.nodes.push({
      ...item.variants.nodes[0]!,
      id: 'variant-2',
      price: '109.00',
      selectedOptions: [{ name: 'Size', value: '43' }],
    })
    const snapshot = collectFeedProducts(catalogVariants(item, 'EUR', STOREFRONT), 500)
    expect(snapshot.products).toHaveLength(1)
    expect(snapshot.products[0]).toMatchObject({
      externalId: item.id,
      price: '99.00',
      currency: 'EUR',
      availability: 'IN_STOCK',
    })
    expect(snapshot.products[0]!.text).toContain('Collection: Trail running')
    expect(snapshot.products[0]!.text).toContain('For off-road runners')
    expect(snapshot.products[0]!.text).toContain('Size: 42, 43')
    expect(snapshot.products[0]!.text).not.toContain('<p>')
  })

  it('distinguishes tracked stock, backorders and products without inventory tracking', () => {
    const item = product()
    item.variants.nodes[0]!.inventoryQuantity = 0
    expect(catalogVariants(item, 'EUR', STOREFRONT)[0]!.availability).toBe('OUT_OF_STOCK')
    item.variants.nodes[0]!.inventoryPolicy = 'CONTINUE'
    expect(catalogVariants(item, 'EUR', STOREFRONT)[0]!.availability).toBe('BACKORDER')
    item.variants.nodes[0]!.inventoryItem.tracked = false
    expect(catalogVariants(item, 'EUR', STOREFRONT)[0]!.availability).toBe('IN_STOCK')
  })

  it('builds product URLs from the storefront when a password-protected store hides onlineStoreUrl', () => {
    const item = product()
    item.onlineStoreUrl = null
    expect(catalogVariants(item, 'EUR', STOREFRONT)[0]!.url).toBe('https://dev-store.myshopify.com/products/shoes-1')
    item.handle = ''
    expect(catalogVariants(item, 'EUR', STOREFRONT)).toEqual([])
  })

  it('fetches all nested pages and computes collection counts from the imported products', async () => {
    const first = product()
    first.variants.pageInfo = { hasNextPage: true, endCursor: 'variant-cursor' }
    first.collections.pageInfo = { hasNextPage: true, endCursor: 'collection-cursor' }
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce(result([first], true, 'product-cursor'))
      .mockResolvedValueOnce({
        product: { variants: page([{ ...first.variants.nodes[0], id: 'variant-extra', price: '90.00' }]) },
      })
      .mockResolvedValueOnce({
        product: {
          collections: page([
            { id: 'collection-extra', title: 'Summer', description: 'Warm weather', handle: 'summer' },
          ]),
        },
      })
      .mockResolvedValueOnce(result([product('2')]))
    const snapshot = await fetchShopifyCatalog('connection', 'tenant', 500)
    expect(snapshot.products).toHaveLength(2)
    expect(snapshot.products[0]!.price).toBe('90.00')
    expect(snapshot.report.collections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Trail running', products: 2, available: 2 }),
        expect.objectContaining({ title: 'Summer', products: 1, available: 1 }),
      ]),
    )
    expect(snapshot.revision).toBe(7)
    expect(findConnection).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'connection', clientSiteId: 'tenant', status: 'CONNECTED' } }),
    )
    expect(vi.mocked(shopifyGraphql).mock.calls[3]![3]).toEqual({ after: 'product-cursor' })
    expect(sourceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shopifyConnectionId: 'connection', clientSiteId: 'tenant', status: 'PROCESSING' },
      }),
    )
  })

  it('fails an incomplete snapshot and accepts a genuinely empty published catalog', async () => {
    vi.mocked(shopifyGraphql).mockResolvedValueOnce(result([product()], true, null))
    await expect(fetchShopifyCatalog('connection', 'tenant', 500)).rejects.toMatchObject({ code: 'RETRY' })
    vi.mocked(shopifyGraphql).mockResolvedValueOnce(result([]))
    expect((await fetchShopifyCatalog('connection', 'tenant', 500)).products).toEqual([])
  })

  it('does not contact Shopify for an absent or cross-tenant connection', async () => {
    findConnection.mockResolvedValue(null)
    await expect(fetchShopifyCatalog('other-connection', 'tenant', 500)).rejects.toMatchObject({
      code: 'REAUTH_REQUIRED',
    })
    expect(shopifyAccessToken).not.toHaveBeenCalled()
    expect(shopifyGraphql).not.toHaveBeenCalled()
  })

  it('caps products to the quota and reports that the catalog is incomplete', async () => {
    vi.mocked(shopifyGraphql).mockResolvedValueOnce(result([product('1'), product('2'), product('3')], true, 'cursor'))
    const snapshot = await fetchShopifyCatalog('connection', 'tenant', 1)
    expect(snapshot.products).toHaveLength(1)
    expect(snapshot.report.truncated).toBeGreaterThan(0)
    expect(snapshot.report.collections[0]).toMatchObject({ products: 1, available: 1 })
    expect(shopifyGraphql).toHaveBeenCalledTimes(1)
  })

  it('quotes the cheapest orderable variant rather than a cheaper sold-out variant', async () => {
    const item = product()
    item.variants.nodes.push({ ...item.variants.nodes[0]!, id: 'sold-out', price: '29.00', inventoryQuantity: 0 })
    vi.mocked(shopifyGraphql).mockResolvedValueOnce(result([item]))
    const snapshot = await fetchShopifyCatalog('connection', 'tenant', 500)
    expect(snapshot.products[0]).toMatchObject({ price: '99.00', availability: 'IN_STOCK' })
  })

  it('records changes during processing without allowing a second worker to claim the source', async () => {
    await queueShopifyCatalog('store.myshopify.com')
    expect(connectionUpdate).toHaveBeenCalledWith({
      where: { shop: 'store.myshopify.com', status: 'CONNECTED' },
      data: { catalogRevision: { increment: 1 } },
    })
    expect(sourceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'SHOPIFY',
          status: { not: 'PROCESSING' },
          shopifyConnection: { shop: 'store.myshopify.com', status: 'CONNECTED' },
        }),
      }),
    )
  })
})
