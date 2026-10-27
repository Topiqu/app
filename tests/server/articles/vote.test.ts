// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { articleAccessSelect, canReadArticle, isArticleLive } from '../../../server/utils/articleViewerAccess'

const db = {
  poll: { findFirst: vi.fn() },
  pollOption: { findFirst: vi.fn() },
  pollResult: { create: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
}
const sessionUser = vi.fn()
let castVote: typeof import('../../../server/api/articles/[id]/vote.post').default
let readVotes: typeof import('../../../server/api/articles/[id]/vote').default

const article = (overrides: Record<string, unknown> = {}) => ({
  clientSiteId: 'site-1',
  status: 'published',
  deletedAt: null,
  releaseAt: null,
  clientSite: { deletedAt: null },
  ...overrides,
})
const admin = { id: 'admin-1', role: 'admin', clientSiteId: 'site-1' }
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000)

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  castVote = (await import('../../../server/api/articles/[id]/vote.post')).default
  readVotes = (await import('../../../server/api/articles/[id]/vote')).default
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', sessionUser)
  vi.stubGlobal('getRouterParams', () => ({ id: 'article-1' }))
  vi.stubGlobal('readBody', async () => ({ pollId: 'poll-1', optionId: 'option-1' }))
  vi.stubGlobal('getQuery', () => ({ pollId: 'poll-1' }))
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('issueAnonSession', () => 'anonymous-session')
  vi.stubGlobal('readAnonSession', () => 'anonymous-session')
  vi.stubGlobal('isUniqueViolation', () => false)
  vi.stubGlobal('canReadArticle', canReadArticle)
  vi.stubGlobal('isArticleLive', isArticleLive)
  vi.stubGlobal('articleAccessSelect', articleAccessSelect)
  sessionUser.mockResolvedValue(null)
  db.pollResult.groupBy.mockResolvedValue([{ optionId: 'option-1', _count: { optionId: 2 } }])
  db.pollResult.findFirst.mockResolvedValue(null)
})
afterEach(() => vi.unstubAllGlobals())

const optionOf = (overrides?: Record<string, unknown>) => ({ poll: { article: article(overrides) } })

describe('casting a poll vote', () => {
  it('records a vote on a live article', async () => {
    db.pollOption.findFirst.mockResolvedValue(optionOf())
    expect(await castVote({} as never)).toEqual({ pollResult: 'option-1', voteCounts: { 'option-1': 2 } })
    expect(db.pollResult.create).toHaveBeenCalledWith({
      data: { articleId: 'article-1', pollId: 'poll-1', optionId: 'option-1', userId: null, sessionId: 'anonymous-session' },
    })
  })

  it('tells an admin previewing a draft that the poll opens on publication', async () => {
    sessionUser.mockResolvedValue(admin)
    db.pollOption.findFirst.mockResolvedValue(optionOf({ status: 'draft' }))
    await expect(castVote({} as never)).rejects.toMatchObject({ statusCode: 409, message: 'common.errors.pollNotOpen' })
    expect(db.pollResult.create).not.toHaveBeenCalled()
  })

  it('keeps a scheduled article closed, even though its status is published', async () => {
    sessionUser.mockResolvedValue(admin)
    db.pollOption.findFirst.mockResolvedValue(optionOf({ releaseAt: tomorrow() }))
    await expect(castVote({} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(db.pollResult.create).not.toHaveBeenCalled()
  })

  it.each([
    ['a draft', { status: 'draft' }],
    ['a scheduled article', { releaseAt: tomorrow() }],
  ])('reveals nothing about %s to a reader who cannot see it', async (_, overrides) => {
    db.pollOption.findFirst.mockResolvedValue(optionOf(overrides))
    await expect(castVote({} as never)).rejects.toMatchObject({ statusCode: 404, message: 'common.errors.articleNotFound' })
    expect(db.pollResult.create).not.toHaveBeenCalled()
  })

  it("does not open another publication's draft to a foreign admin", async () => {
    sessionUser.mockResolvedValue({ ...admin, clientSiteId: 'site-2' })
    db.pollOption.findFirst.mockResolvedValue(optionOf({ status: 'draft' }))
    await expect(castVote({} as never)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('reading poll results', () => {
  it('shows an admin the draft poll as closed instead of failing', async () => {
    sessionUser.mockResolvedValue(admin)
    db.poll.findFirst.mockResolvedValue({ article: article({ status: 'draft' }) })
    expect(await readVotes({} as never)).toEqual({ pollResult: null, voteCounts: { 'option-1': 2 }, open: false })
  })

  it('reports a live poll as open', async () => {
    db.poll.findFirst.mockResolvedValue({ article: article() })
    expect(await readVotes({} as never)).toMatchObject({ open: true })
  })

  it('hides a draft poll from a public reader', async () => {
    db.poll.findFirst.mockResolvedValue({ article: article({ status: 'draft' }) })
    await expect(readVotes({} as never)).rejects.toMatchObject({ statusCode: 404 })
  })
})
