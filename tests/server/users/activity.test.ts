import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const article = {
  id: 'visible-article',
  slug: 'visible',
  language: 'cs',
  title: 'Visible article',
  content: 'Content',
  excerpt: null,
  imageUrl: null,
  createdAt: new Date('2026-09-30T09:00:00Z'),
  views: 12,
  user: null,
  tags: [{ tag: { name: 'News' } }],
  reactions: [{ id: 'reaction-1' }],
}

describe('user activity article visibility', () => {
  const db = {
    article: { count: vi.fn(), findMany: vi.fn() },
    // Reactions remain readable even when their article is hidden by read policies.
    articleReaction: { count: vi.fn(), findMany: vi.fn() },
    comment: { count: vi.fn(), findMany: vi.fn() },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    db.article.count.mockResolvedValue(1)
    db.article.findMany.mockResolvedValue([article])
    db.articleReaction.count.mockResolvedValue(2)
    db.articleReaction.findMany.mockResolvedValue([{ article: null }, { article }])
    db.comment.count.mockResolvedValue(0)
    db.comment.findMany.mockResolvedValue([])
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getServerSession', async () => ({ user: { id: 'user-1' } }))
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('getQuery', () => ({ page: '1', limit: '10', sort: 'createdAt:desc' }))
    vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 10 }))
  })

  afterEach(() => vi.unstubAllGlobals())

  const run = async () => (await import('../../../server/api/users/activity.get')).default({} as never)

  it('returns readable liked articles without dereferencing hidden relations', async () => {
    const result = await run()

    expect(result.likedArticles).toEqual([
      {
        id: article.id,
        slug: article.slug,
        language: article.language,
        title: article.title,
        content: article.content,
        excerpt: '',
        imageUrl: null,
        createdAt: '2026-09-30T09:00:00.000Z',
        authorUsername: 'Anonym',
        authorPfp: null,
        views: 12,
        tags: ['News'],
        likesCount: 1,
      },
    ])
    const where = { reactions: { some: { userId: 'user-1' } } }
    expect(db.article.count).toHaveBeenCalledWith({ where })
    expect(db.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 5, orderBy: { createdAt: 'desc' } }),
    )
    expect(db.articleReaction.findMany).not.toHaveBeenCalled()
    expect(result.hasMore.likedArticles).toBe(false)
  })

  it('returns an empty completed list when no liked articles are readable', async () => {
    db.article.count.mockResolvedValue(0)
    db.article.findMany.mockResolvedValue([])

    const result = await run()

    expect(result.likedArticles).toEqual([])
    expect(result.hasMore.likedArticles).toBe(false)
  })

  it('uses the readable article count for subsequent pages and preserves likes sorting', async () => {
    vi.stubGlobal('getQuery', () => ({ sort: 'likes:desc' }))
    vi.stubGlobal('getPagination', async () => ({ skip: 5, take: 5 }))
    db.article.count.mockResolvedValue(7)

    const result = await run()

    expect(db.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, orderBy: { reactions: { _count: 'desc' } } }),
    )
    expect(result.hasMore.likedArticles).toBe(true)
  })
})
