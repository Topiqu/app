// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { canSeeUnreleasedArticle, isArticleLive } from '../../../server/utils/articleViewerAccess'

const db = {
  article: { findUnique: vi.fn() },
  articleReaction: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}
const notify = vi.fn()
const sessionUser = vi.fn()
let handler: typeof import('../../../server/api/articles/[id]/reaction.post').default

const article = (overrides: Record<string, unknown> = {}) => ({
  userId: 'author-1',
  clientSiteId: 'site-1',
  status: 'published',
  releaseAt: null,
  ...overrides,
})
const draft = () => article({ status: 'draft' })
const scheduled = () => article({ releaseAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })

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
  vi.stubGlobal('isArticleLive', isArticleLive)
  vi.stubGlobal('canSeeUnreleasedArticle', canSeeUnreleasedArticle)
  sessionUser.mockResolvedValue({ id: 'author-1', name: 'Author' })
  db.articleReaction.findFirst.mockResolvedValue(null)
  notify.mockResolvedValue(undefined)
  db.articleReaction.count.mockResolvedValue(1)
  db.article.findUnique.mockResolvedValue(article())
})
afterEach(() => vi.unstubAllGlobals())

describe('article reactions', () => {
  it('lets the author like their live article without notifying themselves', async () => {
    expect(await handler({} as never)).toEqual({ liked: true, likes: 1 })
    expect(db.article.findUnique).toHaveBeenCalledWith({
      where: { id: 'article-1', deletedAt: null, clientSite: { deletedAt: null } },
      select: { userId: true, clientSiteId: true, status: true, releaseAt: true },
    })
    expect(db.articleReaction.create).toHaveBeenCalledWith({
      data: { articleId: 'article-1', userId: 'author-1', sessionId: null },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies the author when a guest likes a live article', async () => {
    sessionUser.mockResolvedValue(null)
    expect(await handler({} as never)).toEqual({ liked: true, likes: 1 })
    expect(notify).toHaveBeenCalledTimes(1)
  })
})

describe('article reactions before publication', () => {
  it.each([
    ['their draft', draft],
    ['their scheduled article', scheduled],
  ])('tells the author that likes on %s open with publication', async (_, unreleased) => {
    db.article.findUnique.mockResolvedValue(unreleased())
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 409,
      message: 'common.errors.engagementNotOpen',
    })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })

  it('tells an admin previewing an AI author’s draft the same', async () => {
    sessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin', clientSiteId: 'site-1' })
    db.article.findUnique.mockResolvedValue(article({ status: 'draft', userId: 'ai-author' }))
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })

  it.each([
    ['a guest', null],
    ['another reader', { id: 'reader-1' }],
    ['a foreign admin', { id: 'admin-2', role: 'admin', clientSiteId: 'site-2' }],
  ])('reveals nothing about a scheduled article to %s', async (_, viewer) => {
    sessionUser.mockResolvedValue(viewer)
    // The read policy returns published rows before their release; the route must not.
    db.article.findUnique.mockResolvedValue(scheduled())
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 404,
      message: 'common.errors.articleNotFound',
    })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })

  it('does not grant a reader access to another author’s draft', async () => {
    sessionUser.mockResolvedValue({ id: 'reader-1' })
    db.article.findUnique.mockResolvedValue(null)
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })

  it('still lets the author take their like back before publication', async () => {
    db.article.findUnique.mockResolvedValue(draft())
    db.articleReaction.findFirst.mockResolvedValue({ id: 'reaction-1' })
    db.articleReaction.count.mockResolvedValue(0)
    expect(await handler({} as never)).toEqual({ liked: false, likes: 0 })
    expect(db.articleReaction.deleteMany).toHaveBeenCalledWith({
      where: { articleId: 'article-1', userId: 'author-1', sessionId: null },
    })
    expect(db.articleReaction.create).not.toHaveBeenCalled()
  })
})
