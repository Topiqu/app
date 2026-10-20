import { afterEach, describe, expect, it, vi } from 'vitest'

const article = (id: string, views: number) => ({
  id,
  slug: id,
  title: id,
  content: `<p>${id}</p>`,
  excerpt: null,
  language: 'cs',
  createdAt: new Date('2026-09-01'),
  publishedAt: new Date('2026-09-01'),
  imageUrl: null,
  readingTime: 1,
  views,
  tags: [],
  reactions: [],
  user: null,
  _count: { comments: 0, reactions: 0 },
})

afterEach(() => vi.unstubAllGlobals())

describe('featured homepage endpoint', () => {
  it('ranks additional stories across the tenant, outside the lead selection', async () => {
    const lead = ['lead', 'related-1', 'related-2', 'related-3'].map((id) => article(id, 5))
    const popular = [article('popular-1', 40), article('popular-2', 30)]
    const findMany = vi.fn().mockResolvedValueOnce(lead).mockResolvedValueOnce(popular)
    const db = {
      clientSite: { findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', language: 'cs' }) },
      article: { count: vi.fn().mockResolvedValue(20), findMany },
    }

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getSessionUser', vi.fn().mockResolvedValue({ id: 'reader-1' }))
    vi.stubGlobal('getRouterParam', vi.fn().mockReturnValue('publication'))
    vi.stubGlobal('getQuery', vi.fn().mockReturnValue({ locale: 'cs' }))
    vi.stubGlobal('useServerI18n', vi.fn().mockResolvedValue({ translate: (key: string) => key }))
    vi.stubGlobal('getEnhancedPrisma', vi.fn().mockResolvedValue(db))
    vi.stubGlobal(
      'localizeArticles',
      vi.fn().mockImplementation(async (_db, articles) => articles),
    )

    const { default: endpoint } = await import('../../../server/api/articles/featured/[slug]')
    const result = await endpoint({} as Parameters<typeof endpoint>[0])

    expect(result.featured?.id).toBe('lead')
    expect(result.topArticles.map((item) => item.id)).toEqual(['popular-1', 'popular-2'])
    expect(findMany).toHaveBeenCalledTimes(2)
    expect(findMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        clientSiteId: 'tenant-1',
        status: 'published',
        deletedAt: null,
        id: { notIn: ['lead', 'related-1', 'related-2', 'related-3'] },
      },
      orderBy: [{ views: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
  })
})
