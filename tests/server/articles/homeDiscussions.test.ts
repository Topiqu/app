import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const gifUrl = 'https://media.giphy.com/media/discussion/giphy.gif'
const site = { id: 'site-1', language: 'cs', commentsEnabled: true, commentGifsEnabled: true }
const saved = [
  {
    id: 'comment-1',
    content: '[reader](reader) Komentář s GIFem',
    gifUrl,
    createdAt: new Date('2026-10-24T09:00:00Z'),
    user: { username: 'Čtenář', avatarUrl: null },
    article: { id: 'article-1', slug: 'clanek', title: 'Článek', language: 'cs', _count: { comments: 2 } },
  },
  {
    id: 'comment-2',
    content: 'Komentář bez GIFu',
    gifUrl: null,
    createdAt: new Date('2026-10-24T08:00:00Z'),
    user: { username: 'Čtenář', avatarUrl: null },
    article: { id: 'article-2', slug: 'dalsi-clanek', title: 'Další článek', language: 'cs', _count: { comments: 1 } },
  },
]

describe('homepage discussion GIFs', () => {
  const db = {
    clientSite: { findUnique: vi.fn() },
    comment: { findMany: vi.fn() },
  }
  const cache = new Map<string, unknown>()

  beforeEach(() => {
    vi.resetAllMocks()
    cache.clear()
    site.commentsEnabled = true
    site.commentGifsEnabled = true
    db.clientSite.findUnique.mockImplementation(async () => ({ ...site }))
    db.comment.findMany.mockResolvedValue(saved)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getRouterParam', () => 'blog')
    vi.stubGlobal('getQuery', () => ({ locale: 'cs' }))
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    vi.stubGlobal('localizeArticles', async (_db: unknown, articles: unknown[]) => articles)
    vi.stubGlobal('cached', async (key: string, _ttl: number, build: () => Promise<unknown>) => {
      if (!cache.has(key)) cache.set(key, await build())
      return cache.get(key)
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  const run = async () => (await import('../../../server/api/comments/by-clientsite/[slug].get')).default({} as never)

  it('includes saved GIFs and preserves comment text and discussion links', async () => {
    const result = await run()

    expect(result[0]).toMatchObject({
      id: saved[0]!.id,
      content: saved[0]!.content,
      gifUrl,
      article: { slug: 'clanek', title: 'Článek', language: 'cs', comments: 2 },
    })
    expect(result[1]!.gifUrl).toBeNull()
    expect(db.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ gifUrl: true }) }),
    )
  })

  it('applies the current GIF setting to an already cached discussion', async () => {
    expect((await run())[0]!.gifUrl).toBe(gifUrl)

    site.commentGifsEnabled = false
    expect((await run()).map((comment) => comment.gifUrl)).toEqual([null, null])

    site.commentGifsEnabled = true
    expect((await run())[0]!.gifUrl).toBe(gifUrl)
    expect(db.comment.findMany).toHaveBeenCalledOnce()
    expect(saved[0]!.gifUrl).toBe(gifUrl)
  })

  it('returns no discussions when comments are disabled', async () => {
    site.commentsEnabled = false

    expect(await run()).toEqual([])
    expect(db.comment.findMany).not.toHaveBeenCalled()
  })
})
