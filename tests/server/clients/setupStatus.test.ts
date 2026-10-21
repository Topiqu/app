// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  clientSite: { findUnique: vi.fn() },
  knowledgeSource: { findMany: vi.fn() },
  article: { findFirst: vi.fn() },
  log: { count: vi.fn() },
}
const requireDb = vi.fn()
const requireMember = vi.fn()
let handler: typeof import('../../../server/api/clients/status.get').default

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  vi.stubGlobal('requireDb', requireDb)
  vi.stubGlobal('requireTenantMember', requireMember)
  vi.stubGlobal('trialState', () => 'NONE')
  vi.stubGlobal('getArticleCreditWallet', async () => ({ available: 5, reserved: 0, balance: 5, grants: [] }))
  handler = (await import('../../../server/api/clients/status.get')).default
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.clearAllMocks()
  requireDb.mockResolvedValue({ user: { clientSiteId: 'own-site', role: 'admin' }, db })
  requireMember.mockResolvedValue(undefined)
  db.clientSite.findUnique.mockResolvedValue({
    id: 'own-site',
    name: 'My blog',
    plan: 'PRO',
    description: 'About our work',
    logoUrl: null,
    users: [],
    trialStartedAt: null,
    trialEndsAt: null,
    trialAcknowledgedAt: null,
    stripeSubscriptionId: null,
  })
  db.knowledgeSource.findMany.mockResolvedValue([])
  db.article.findFirst.mockResolvedValue(null)
})

describe('dashboard setup status', () => {
  const event = () => ({ query: { clientSiteId: 'foreign-site' } }) as never

  it('returns no setup without an active session tenant', async () => {
    requireDb.mockResolvedValueOnce({ user: { clientSiteId: null, role: 'admin' }, db })
    expect(await handler(event())).toBeNull()
    expect(requireMember).not.toHaveBeenCalled()
    expect(db.clientSite.findUnique).not.toHaveBeenCalled()
  })

  it('checks membership before reading setup facts', async () => {
    requireMember.mockRejectedValueOnce(new Error('Not a member'))
    await expect(handler(event())).rejects.toThrow('Not a member')
    expect(db.clientSite.findUnique).not.toHaveBeenCalled()
    expect(db.article.findFirst).not.toHaveBeenCalled()
  })

  it('scopes publication and knowledge checks to the session tenant with safe projections', async () => {
    await handler(event())
    expect(requireDb).toHaveBeenCalledWith(expect.anything(), { minRole: 'admin' })
    expect(requireMember).toHaveBeenCalledWith(expect.anything(), 'own-site')
    expect(db.knowledgeSource.findMany).toHaveBeenCalledWith({
      where: { clientSiteId: 'own-site', deletedAt: null },
      select: { status: true, useInArticles: true },
    })
    expect(db.article.findFirst).toHaveBeenCalledWith({
      where: {
        clientSiteId: 'own-site',
        deletedAt: null,
        status: 'published',
        OR: [{ releaseAt: null }, { releaseAt: { lte: expect.any(Date) } }],
      },
      select: { id: true },
    })
  })

  it('distinguishes indexed sources from processing, failed and disabled sources', async () => {
    db.knowledgeSource.findMany.mockResolvedValueOnce([
      { status: 'INDEXED', useInArticles: true },
      { status: 'INDEXED', useInArticles: false },
      { status: 'PENDING', useInArticles: true },
      { status: 'PROCESSING', useInArticles: true },
      { status: 'FAILED', useInArticles: true },
      { status: 'FAILED', useInArticles: false },
    ])
    const result = await handler(event())
    expect(result?.knowledgeSources).toBe(6)
    expect(result?.setup).toEqual({ hasPublishedArticle: false, knowledge: { indexed: 1, processing: 2, failed: 1 } })
    expect(result).not.toHaveProperty('stripeSubscriptionId')
  })

  it('reports a publication only when the scoped live-article query finds one', async () => {
    expect((await handler(event()))?.setup.hasPublishedArticle).toBe(false)
    db.article.findFirst.mockResolvedValueOnce({ id: 'published-article' })
    expect((await handler(event()))?.setup.hasPublishedArticle).toBe(true)
  })
})
