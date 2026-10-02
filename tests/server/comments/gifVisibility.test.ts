import { afterEach, describe, expect, it, vi } from 'vitest'

describe('comment GIF visibility', () => {
  afterEach(() => vi.unstubAllGlobals())

  const setup = async (commentGifsEnabled: boolean) => {
    const makeComment = (id: string, parentId: string | null) => ({
      id,
      parentId,
      articleId: 'article-1',
      userId: 'reader-1',
      content: 'A saved comment',
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
      deletedAt: null,
      createdAt: new Date('2026-10-01'),
      user: null,
      reactions: [],
      emojiReactions: [],
    })
    const saved = [makeComment('root-1', null), makeComment('reply-1', 'root-1')]
    const db = {
      article: {
        findUnique: vi.fn().mockResolvedValue({
          clientSiteId: 'site-1',
          clientSite: { commentGifsEnabled },
        }),
      },
      comment: {
        findMany: vi.fn(async ({ where }) =>
          saved.filter((comment) =>
            where.parentId === null ? comment.parentId === null : where.parentId.in.includes(comment.parentId),
          ),
        ),
        count: vi.fn().mockResolvedValue(1),
      },
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getRouterParam', () => 'article-1')
    vi.stubGlobal('getServerSession', async () => null)
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('getPagination', async () => ({ skip: 0, take: 5 }))
    vi.stubGlobal('getQuery', () => ({}))
    vi.stubGlobal('prisma', { tenantMembership: { findMany: async () => [] } })
    const handler = (await import('../../../server/api/comments/[id]/index.get')).default
    return { run: () => handler({} as never), saved }
  }

  it('hides existing GIFs from comments and nested replies without removing stored content', async () => {
    const { run, saved } = await setup(false)
    const result = await run()
    expect(result.comments[0]).toMatchObject({ content: 'A saved comment', gifUrl: null })
    expect(result.comments[0]!.replies[0]).toMatchObject({ content: 'A saved comment', gifUrl: null })
    expect(saved.every((comment) => comment.gifUrl !== null)).toBe(true)
  })

  it('shows stored GIFs again when the tenant enables them', async () => {
    const { run, saved } = await setup(true)
    const result = await run()
    expect(result.comments[0]!.gifUrl).toBe(saved[0]!.gifUrl)
    expect(result.comments[0]!.replies[0]!.gifUrl).toBe(saved[1]!.gifUrl)
  })
})
