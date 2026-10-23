// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  article: { findUnique: vi.fn() },
  articleReaction: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}
const notify = vi.fn()
const sessionUser = vi.fn()
let handler: typeof import('../../../server/api/articles/[id]/reaction.post').default

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  handler = (await import('../../../server/api/articles/[id]/reaction.post')).default
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('getSessionUser', sessionUser)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('prisma', { notification: { create: notify } })
  vi.stubGlobal('issueAnonSession', () => 'anonymous-session')
  vi.stubGlobal('ipKey', () => '127.0.0.1')
  vi.stubGlobal('consumeRateLimit', async () => true)
  sessionUser.mockResolvedValue({ id: 'author-1', name: 'Author' })
  db.articleReaction.findFirst.mockResolvedValue(null)
  db.articleReaction.count.mockResolvedValue(1)
  db.article.findUnique.mockResolvedValue({ userId: 'author-1' })
})
afterEach(() => vi.unstubAllGlobals())

describe('article reactions before publication', () => {
  it('lets the signed-in author like their draft without notifying themselves', async () => {
    expect(await handler({} as never)).toEqual({ liked: true, likes: 1 })
    expect(db.article.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'article-1',
        deletedAt: null,
        clientSite: { deletedAt: null },
        OR: [{ status: 'published' }, { status: 'draft', userId: 'author-1' }],
      },
      select: { userId: true },
    })
    expect(db.articleReaction.create).toHaveBeenCalledWith({
      data: { articleId: 'article-1', userId: 'author-1', sessionId: null },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('allows guests to react only to published articles', async () => {
    sessionUser.mockResolvedValue(null)
    await handler({} as never)
    expect(db.article.findUnique.mock.calls[0]![0].where.OR).toEqual([{ status: 'published' }])
  })

  it('does not grant a reader access to another author’s draft', async () => {
    sessionUser.mockResolvedValue({ id: 'reader-1' })
    db.article.findUnique.mockResolvedValue(null)
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(db.article.findUnique.mock.calls[0]![0].where.OR).toEqual([
      { status: 'published' },
      { status: 'draft', userId: 'reader-1' },
    ])
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })

  it('still lets the author take their like back before publication', async () => {
    db.articleReaction.findFirst.mockResolvedValue({ id: 'reaction-1' })
    db.articleReaction.count.mockResolvedValue(0)
    expect(await handler({} as never)).toEqual({ liked: false, likes: 0 })
    expect(db.articleReaction.deleteMany).toHaveBeenCalledWith({
      where: { articleId: 'article-1', userId: 'author-1', sessionId: null },
    })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })
})
