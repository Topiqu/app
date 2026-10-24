// @vitest-environment node
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('Shopify publication media review', () => {
  const setup = async (mode: 'draft' | 'published') => {
    const review = vi.fn().mockRejectedValue(createError({ statusCode: 409, message: 'Rights need review' }))
    const snapshot = vi.fn()
    const transaction = vi.fn().mockRejectedValue(new Error('Reached publication queue'))
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getRouterParam', () => 'article-1')
    vi.stubGlobal('readBody', async () => ({ mode }))
    vi.stubGlobal('requireShopifyAccess', async () => ({
      user: { id: 'user-1' },
      site: { id: 'site-1' },
      db: {
        article: {
          findFirst: async () => ({
            id: 'article-1',
            userId: 'user-1',
            title: 'Article',
            slug: 'article',
            content: '<p>Content</p>',
            language: 'cs',
            tags: [],
            clientSite: { domain: 'blog.test' },
          }),
        },
        shopifyConnection: {
          findUnique: async () => ({ id: 'connection-1', status: 'CONNECTED', blogId: 'blog-1', author: 'Author' }),
        },
        $transaction: transaction,
      },
    }))
    vi.stubGlobal('requireTenantScope', async () => ({ membership: {} }))
    vi.stubGlobal('requireMediaRightsReview', review)
    vi.stubGlobal('createMediaRightsSnapshot', snapshot)
    vi.stubGlobal('applyMediaAttributions', async (_site: string, content: string) => content)
    vi.stubGlobal('shopifyHandle', () => 'article')
    vi.stubGlobal('exportShopifyContent', () => '<p>Content</p>')
    vi.stubGlobal('prisma', {})
    const handler = (await import('../../../server/api/articles/[id]/shopify.post')).default
    return { run: () => handler({} as never), review, snapshot, transaction }
  }

  it('allows hiding a Shopify publication without acknowledging media rights', async () => {
    const fixture = await setup('draft')
    await expect(fixture.run()).rejects.toThrow('Reached publication queue')
    expect(fixture.review).not.toHaveBeenCalled()
    expect(fixture.snapshot).not.toHaveBeenCalled()
    expect(fixture.transaction).toHaveBeenCalledOnce()
  })

  it('still requires media review when publishing to Shopify', async () => {
    const fixture = await setup('published')
    await expect(fixture.run()).rejects.toMatchObject({ statusCode: 409 })
    expect(fixture.transaction).not.toHaveBeenCalled()
  })
})
