import { afterEach, describe, expect, it, vi } from 'vitest'

const makeComment = (id: string, parentId: string | null = null, articleId = 'article-1') => ({
  id,
  parentId,
  articleId,
  userId: 'reader-1',
  content: `Comment ${id}`,
  gifUrl: null,
  deletedAt: null,
  createdAt: new Date('2026-10-01'),
  user: null,
  reactions: [],
  emojiReactions: [],
})

const setup = async (target?: string) => {
  const saved = [
    makeComment('newest'),
    makeComment('second'),
    makeComment('older'),
    makeComment('reply', 'older'),
    makeComment('nested-reply', 'reply'),
    makeComment('foreign', null, 'other-article'),
  ]
  const db = {
    article: {
      findUnique: vi.fn().mockResolvedValue({
        clientSiteId: 'site-1',
        status: 'published',
        deletedAt: null,
        releaseAt: null,
        clientSite: { deletedAt: null, commentGifsEnabled: true },
      }),
    },
    comment: {
      findFirst: vi.fn(async ({ where }) => saved.find((c) => c.id === where.id && c.articleId === where.articleId)),
      findMany: vi.fn(async ({ where, skip, take }) => {
        const matching = saved.filter(
          (c) =>
            c.articleId === where.articleId &&
            (!where.id || where.id.in.includes(c.id)) &&
            (where.parentId === null ? c.parentId === null : !where.parentId || where.parentId.in.includes(c.parentId)),
        )
        return (take === undefined ? matching : matching.slice(skip ?? 0, (skip ?? 0) + take)).map((comment) => ({
          ...comment,
          _count: { replies: saved.filter((child) => child.parentId === comment.id).length },
        }))
      }),
      count: vi.fn().mockResolvedValue(3),
    },
    commentReaction: { groupBy: vi.fn().mockResolvedValue([]) },
    emojiReaction: { groupBy: vi.fn().mockResolvedValue([]) },
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('getSessionUser', async () => null)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 2 }))
  vi.stubGlobal('getQuery', () => ({ target }))
  vi.stubGlobal('prisma', { tenantMembership: { findMany: async () => [] } })
  const handler = (await import('../../../server/api/comments/[id]/index.get')).default
  return { run: () => handler({} as never), db, saved }
}

afterEach(() => vi.unstubAllGlobals())

describe('comment permalink threads', () => {
  it('loads an older root directly without loading earlier pages', async () => {
    const { run, db } = await setup('older')
    const result = await run()
    expect(result.comments.map((c) => c.id)).toEqual(['older'])
    expect(result.hasMore).toBe(false)
    expect(db.comment.count).not.toHaveBeenCalled()
  })

  it('loads the entire parent thread for a nested reply', async () => {
    const { run } = await setup('nested-reply')
    const result = await run()
    expect(result.comments[0]?.id).toBe('older')
    expect(result.comments[0]?.replies[0]?.id).toBe('reply')
    expect(result.comments[0]?.replies[0]?.replies[0]?.id).toBe('nested-reply')
  })

  it.each(['foreign', 'missing'])('does not load an unavailable target: %s', async (target) => {
    const { run } = await setup(target)
    expect(await run()).toEqual({ comments: [], hasMore: false })
  })

  it('keeps deleted parent content hidden while retaining the target reply', async () => {
    const { run, saved } = await setup('nested-reply')
    Object.assign(saved[2]!, { deletedAt: new Date() })
    const result = await run()
    expect(result.comments[0]?.content).toBe('')
    expect(result.comments[0]?.replies[0]?.replies[0]?.content).toBe('Comment nested-reply')
  })

  it('retains normal pagination for visits without a permalink', async () => {
    const { run, db } = await setup()
    const result = await run()
    expect(result.comments.map((c) => c.id)).toEqual(['newest', 'second'])
    expect(result.hasMore).toBe(true)
    expect(db.comment.findFirst).not.toHaveBeenCalled()
  })
})
