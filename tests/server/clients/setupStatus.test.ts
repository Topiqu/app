// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  clientSite: { findUnique: vi.fn() },
  knowledgeSource: { findMany: vi.fn() },
  article: { findFirst: vi.fn() },
  tenantMembership: { count: vi.fn() },
  tenantInvitation: { count: vi.fn() },
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
  db.tenantMembership.count.mockResolvedValue(1)
  db.tenantInvitation.count.mockResolvedValue(0)
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
    expect(db.tenantMembership.count).toHaveBeenCalledWith({
      where: { clientSiteId: 'own-site', deletedAt: null, user: { deletedAt: null, role: { not: 'ai' } } },
    })
    expect(db.tenantInvitation.count).toHaveBeenCalledWith({
      where: {
        clientSiteId: 'own-site',
        deletedAt: null,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
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
    expect(result?.setup).toMatchObject({
      hasPublishedArticle: false,
      draftArticleSlug: null,
      knowledge: { indexed: 1, processing: 2, failed: 1 },
    })
    expect(result).not.toHaveProperty('stripeSubscriptionId')
  })

  it('reports a publication only when the scoped live-article query finds one', async () => {
    expect((await handler(event()))?.setup.hasPublishedArticle).toBe(false)
    db.article.findFirst.mockResolvedValueOnce({ id: 'published-article' })
    expect((await handler(event()))?.setup.hasPublishedArticle).toBe(true)
  })

  it('selects only the active AI author profile needed to evaluate setup', async () => {
    await handler(event())
    expect(db.clientSite.findUnique.mock.calls[0]![0].select.users).toEqual({
      where: { role: 'ai', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 1,
      select: { username: true, bio: true, avatarUrl: true },
    })
    expect(db.clientSite.findUnique.mock.calls[0]![0].select).not.toHaveProperty('pendingDomainToken')
  })

  it('returns an existing draft only to a member allowed to write articles', async () => {
    requireDb.mockResolvedValueOnce({
      user: { clientSiteId: 'own-site', role: 'admin', scopes: ['ARTICLE_WRITE'] },
      db,
    })
    db.article.findFirst
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({ slug: 'continue-this-draft' }))
    expect((await handler(event()))?.setup.draftArticleSlug).toBe('continue-this-draft')
    expect(db.article.findFirst).toHaveBeenLastCalledWith({
      where: { clientSiteId: 'own-site', deletedAt: null, status: 'draft' },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true },
    })
  })

  it('does not expose a draft through the status endpoint without writing permission', async () => {
    expect((await handler(event()))?.setup.draftArticleSlug).toBeNull()
    expect(db.article.findFirst).toHaveBeenCalledTimes(1)
  })

  it('returns only safe measurement and channel summaries and requires enabled destinations', async () => {
    db.clientSite.findUnique.mockResolvedValueOnce({
      id: 'own-site',
      plan: 'PREMIUM',
      users: [],
      allowGtag: false,
      gtagId: 'G-EXAMPLE',
      features: [{ feature: { code: 'SEARCH_CONSOLE' } }],
      searchConsoleConnection: { status: 'CONNECTED', propertyUrl: 'sc-domain:example.com', deletedAt: null },
      publishToShopify: true,
      shopifyConnection: { status: 'CONNECTED', blogId: 'blog-1', deletedAt: null },
      publishToLinkedIn: false,
      linkedinCompanies: [{ id: 'connected-profile' }],
    })
    const result = await handler(event())
    expect(result?.setup.measurement).toEqual({ analytics: false, searchConsole: true })
    expect(result?.setup.channels).toEqual({ shopify: true, linkedin: false })
    expect(result).not.toHaveProperty('searchConsoleConnection')
    expect(result).not.toHaveProperty('shopifyConnection')
    expect(result).not.toHaveProperty('linkedinCompanies')
    const select = db.clientSite.findUnique.mock.calls[0]![0].select
    expect(select.linkedinCompanies).toEqual({
      where: { deletedAt: null, accessToken: { not: null }, tokenExpiresAt: { gt: expect.any(Date) } },
      select: { id: true },
      take: 1,
    })
    expect(select.shopifyConnection.select).toEqual({ status: true, blogId: true, deletedAt: true })
    expect(select.searchConsoleConnection.select).toEqual({ status: true, propertyUrl: true, deletedAt: true })
  })

  it('does not count revoked connections, an unselected Shopify blog or disabled Search Console', async () => {
    db.clientSite.findUnique.mockResolvedValueOnce({
      id: 'own-site',
      plan: 'PRO',
      users: [],
      features: [],
      allowGtag: true,
      gtagId: ' ',
      searchConsoleConnection: { status: 'CONNECTED', propertyUrl: 'sc-domain:example.com', deletedAt: null },
      publishToShopify: true,
      shopifyConnection: { status: 'CONNECTED', blogId: null, deletedAt: null },
      publishToLinkedIn: true,
      linkedinCompanies: [],
    })
    const result = await handler(event())
    expect(result?.setup.measurement).toEqual({ analytics: false, searchConsole: false })
    expect(result?.setup.channels).toEqual({ shopify: false, linkedin: false })
  })

  it('validates active schedules without treating default manual approval as confirmed', async () => {
    expect((await handler(event()))?.setup.publishing).toEqual({
      automatic: false,
      scheduled: false,
      scheduleValid: true,
    })
    db.clientSite.findUnique.mockResolvedValueOnce({
      id: 'own-site',
      plan: 'PRO',
      users: [],
      features: [{ feature: { code: 'AI' } }, { feature: { code: 'ARTICLE_CRONS' } }],
      autoRelease: true,
      generationFrequency: 'DAILY',
      timeZone: 'Europe/Prague',
      releaseHour: 16,
      releaseWindowStart: 7,
      releaseWindowEnd: 21,
      releaseDays: [],
      intervalMinHours: 24,
      intervalMaxHours: 72,
    })
    expect((await handler(event()))?.setup.publishing).toEqual({
      automatic: true,
      scheduled: true,
      scheduleValid: false,
    })
  })
})
