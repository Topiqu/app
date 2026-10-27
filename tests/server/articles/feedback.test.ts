// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { canSeeUnreleasedArticle, isArticleLive } from '../../../server/utils/articleViewerAccess'

const db = {
  article: { findUnique: vi.fn() },
  articleFeedback: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}
const sessionUser = vi.fn()
let handler: typeof import('../../../server/api/articles/[id]/feedback.post').default

const article = (overrides: Record<string, unknown> = {}) => ({
  id: 'article-1',
  userId: 'ai-author',
  clientSiteId: 'site-1',
  status: 'published',
  releaseAt: null,
  ...overrides,
})
const admin = { id: 'admin-1', role: 'admin', clientSiteId: 'site-1' }

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  handler = (await import('../../../server/api/articles/[id]/feedback.post')).default
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('readValidatedBody', async () => ({ isHelpful: true, reason: null }))
  vi.stubGlobal('getSessionUser', sessionUser)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('issueAnonSession', () => 'anonymous-session')
  vi.stubGlobal('isUniqueViolation', () => false)
  vi.stubGlobal('isArticleLive', isArticleLive)
  vi.stubGlobal('canSeeUnreleasedArticle', canSeeUnreleasedArticle)
  sessionUser.mockResolvedValue(null)
  db.articleFeedback.findFirst.mockResolvedValue(null)
  db.articleFeedback.create.mockResolvedValue({ id: 'feedback-1' })
})
afterEach(() => vi.unstubAllGlobals())

describe('article feedback', () => {
  it('records feedback on a live article', async () => {
    db.article.findUnique.mockResolvedValue(article())
    expect(await handler({} as never)).toEqual({ success: true, feedback: { id: 'feedback-1' } })
  })

  it('tells an admin previewing a draft that rating opens with publication', async () => {
    sessionUser.mockResolvedValue(admin)
    db.article.findUnique.mockResolvedValue(article({ status: 'draft' }))
    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 409,
      message: 'common.errors.engagementNotOpen',
    })
    expect(db.articleFeedback.create).not.toHaveBeenCalled()
  })

  it('reveals nothing about a scheduled article to a guest', async () => {
    db.article.findUnique.mockResolvedValue(article({ releaseAt: new Date(Date.now() + 60 * 60 * 1000) }))
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(db.articleFeedback.create).not.toHaveBeenCalled()
  })
})
