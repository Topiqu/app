// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shopifyAccessToken } from '../../../server/utils/shopify/token'
import { publishShopifyArticle } from '../../../server/utils/shopify/publication'
import { ShopifyApiError, shopifyGraphql } from '../../../server/utils/shopify/api'

vi.mock('../../../server/utils/shopify/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/api')>()),
  shopifyGraphql: vi.fn(),
}))
vi.mock('../../../server/utils/shopify/token', () => ({ shopifyAccessToken: vi.fn() }))

describe('Shopify publication processing', () => {
  let row: Record<string, any>
  const remote = () => ({
    id: 'gid://shopify/Article/123',
    handle: 'article-unique',
    isPublished: false,
    blog: { id: 'gid://shopify/Blog/1', handle: 'news' },
    marker: { value: 'article-1' },
  })
  beforeEach(() => {
    vi.clearAllMocks()
    row = {
      id: 'publication-1',
      status: 'QUEUED',
      nextAttemptAt: new Date(),
      lease: null,
      attempts: 0,
      connectionId: 'connection-1',
      articleId: 'article-1',
      clientSiteId: 'site-1',
      shopifyArticleId: null,
      handle: 'article-unique',
      blogId: 'gid://shopify/Blog/1',
      createStartedAt: null,
      payload: {
        title: 'Article',
        blogId: 'gid://shopify/Blog/1',
        handle: 'article-unique',
        isPublished: false,
        author: { name: 'Topiqu' },
        body: '<p>Text</p>',
      },
      connection: {
        shop: 'store.myshopify.com',
        status: 'CONNECTED',
        storefrontUrl: 'https://store.example',
        clientSite: { plan: 'PRO', deletedAt: null },
      },
    }
    vi.stubGlobal('prisma', {
      shopifyPublication: {
        findUnique: vi.fn(async () => structuredClone(row)),
        updateMany: vi.fn(async ({ where, data }) => {
          if ((where.status && where.status !== row.status) || (where.lease && where.lease !== row.lease))
            return { count: 0 }
          for (const [key, value] of Object.entries(data))
            row[key] =
              key === 'attempts' && typeof value === 'object'
                ? row.attempts + (value as { increment: number }).increment
                : value
          return { count: 1 }
        }),
      },
      shopifyConnection: { count: vi.fn(async () => 1), updateMany: vi.fn(async () => ({ count: 1 })) },
    })
    vi.mocked(shopifyAccessToken).mockResolvedValue('token')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('creates one draft and retains the Shopify ID for later updates', async () => {
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce({ articles: { nodes: [] } })
      .mockResolvedValueOnce({ articleCreate: { article: remote(), userErrors: [] } })
    await Promise.all([publishShopifyArticle('publication-1'), publishShopifyArticle('publication-1')])
    expect(row).toMatchObject({
      status: 'SYNCED',
      shopifyArticleId: 'gid://shopify/Article/123',
      isPublished: false,
      url: 'https://store.example/blogs/news/article-unique',
    })
    expect(vi.mocked(shopifyGraphql).mock.calls.filter((call) => call[4])).toHaveLength(1)
    expect(vi.mocked(shopifyGraphql).mock.calls[1]![3]).toMatchObject({
      article: { isPublished: false, metafields: [{ value: 'article-1' }] },
    })
  })

  it('updates the known article without creating a second one', async () => {
    row.shopifyArticleId = remote().id
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce({ article: remote() })
      .mockResolvedValueOnce({ articleUpdate: { article: { ...remote(), isPublished: true }, userErrors: [] } })
    await publishShopifyArticle('publication-1')
    expect(row.isPublished).toBe(true)
    expect(vi.mocked(shopifyGraphql).mock.calls[1]![2]).toContain('articleUpdate')
  })

  it('recovers an article created before a timeout and updates it by ID', async () => {
    row.createStartedAt = new Date()
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce({ articles: { nodes: [remote()] } })
      .mockResolvedValueOnce({ article: remote() })
      .mockResolvedValueOnce({ articleUpdate: { article: remote(), userErrors: [] } })
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('SYNCED')
    expect(vi.mocked(shopifyGraphql).mock.calls.at(-1)![2]).toContain('articleUpdate')
  })

  it('does not create again when the previous create cannot be confirmed', async () => {
    row.createStartedAt = new Date()
    vi.mocked(shopifyGraphql).mockResolvedValueOnce({ articles: { nodes: [] } })
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('UNCERTAIN')
    expect(vi.mocked(shopifyGraphql).mock.calls.some((call) => call[4])).toBe(false)
  })

  it('does not overwrite an unrelated article with a matching handle', async () => {
    vi.mocked(shopifyGraphql).mockResolvedValueOnce({
      articles: { nodes: [{ ...remote(), marker: { value: 'somebody-else' } }] },
    })
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('FAILED')
    expect(shopifyGraphql).toHaveBeenCalledTimes(1)
  })

  it('keeps a timed-out create uncertain instead of retrying it automatically', async () => {
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce({ articles: { nodes: [] } })
      .mockRejectedValueOnce(new ShopifyApiError('UNCERTAIN', 'timeout'))
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('UNCERTAIN')
    expect(row.createStartedAt).toBeInstanceOf(Date)
  })

  it('can retry a rate-limited create because Shopify did not execute it', async () => {
    vi.mocked(shopifyGraphql)
      .mockResolvedValueOnce({ articles: { nodes: [] } })
      .mockRejectedValueOnce(new ShopifyApiError('RETRY', 'rate limited'))
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('QUEUED')
    expect(row.createStartedAt).toBeNull()
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('stops publication after a plan downgrade', async () => {
    row.connection.clientSite.plan = 'BASIC'
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('FAILED')
    expect(shopifyGraphql).not.toHaveBeenCalled()
  })

  it('does not send after its lease was cancelled during the remote lookup', async () => {
    vi.mocked(shopifyGraphql).mockImplementationOnce(async () => {
      row.status = 'FAILED'
      row.lease = null
      return { articles: { nodes: [] } }
    })
    await publishShopifyArticle('publication-1')
    expect(row.status).toBe('FAILED')
    expect(vi.mocked(shopifyGraphql).mock.calls.some((call) => call[4])).toBe(false)
  })
})
