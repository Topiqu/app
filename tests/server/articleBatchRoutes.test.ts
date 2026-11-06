// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAiPlan } from '../../shared/utils/plans'
import { articleQualityOf } from '../../shared/utils/articleQuality'
import { releaseScheduleSettings } from '../../shared/utils/releaseSchedule'
import { affordableArticleCount, articleCreditCost } from '../../shared/utils/articleCredits'
import { articleCreditOverview, batchSlots, MAX_BATCH_ITEMS } from '../../shared/utils/articleBatch'

const CLUSTER_ID = 'cluster-1'
const ROW_ID = '5b6a3c1e-8f0d-4a7b-9c2e-1d3f5a7b9c0d'
const site = {
  id: 'site-1',
  plan: 'PRO',
  focus: 'Garden ponds',
  keywords: [],
  articleQuality: 'STANDARD',
  publishToWeb: true,
  generationFrequency: 'NONE',
  timeZone: 'UTC',
  releaseHour: 16,
  releaseWindowStart: 0,
  releaseWindowEnd: 24,
  releaseDays: [1, 2, 3, 4, 5, 6, 7],
  intervalMinHours: 24,
  intervalMaxHours: 72,
}

const mocks = {
  member: vi.fn(),
  wallet: vi.fn(),
  batchFindFirst: vi.fn(),
  batchUpdate: vi.fn(),
  batchUpdateMany: vi.fn(),
  batchCreate: vi.fn(),
  siteFindFirst: vi.fn(),
  clusterFindFirst: vi.fn(),
  clusterUpdateMany: vi.fn(),
  itemCreateMany: vi.fn(),
  itemFindMany: vi.fn(),
  itemUpdateMany: vi.fn(),
  log: vi.fn(),
  planTopics: vi.fn(),
  rateLimit: vi.fn(),
  feature: vi.fn(),
  refill: vi.fn(),
  aiTopics: vi.fn(),
  articles: vi.fn(),
  schedule: vi.fn(),
}

const tx = {
  $queryRaw: vi.fn(),
  articleBatch: {
    findFirst: mocks.batchFindFirst,
    findFirstOrThrow: mocks.batchFindFirst,
    update: mocks.batchUpdate,
    updateMany: mocks.batchUpdateMany,
    create: mocks.batchCreate,
  },
  clientSite: { findFirstOrThrow: mocks.siteFindFirst },
  keywordCluster: { findFirst: mocks.clusterFindFirst, updateMany: mocks.clusterUpdateMany },
  article: { findMany: mocks.articles },
  articleBatchItem: {
    count: async () => 0,
    createMany: mocks.itemCreateMany,
    findMany: mocks.itemFindMany,
    updateMany: mocks.itemUpdateMany,
  },
}

const stubGlobals = () => {
  for (const [name, value] of Object.entries({
    createError,
    requireTenantMember: mocks.member,
    hasTenantScope: (membership: { role: string; scopes: string[] }, scope: string) =>
      membership.role === 'OWNER' || membership.scopes.includes(scope),
    requireAiPlan: vi.fn().mockResolvedValue({ plan: 'PRO' }),
    hasAiPlan,
    getArticleCreditWallet: mocks.wallet,
    hasActiveFeature: mocks.feature,
    articleQualityOf,
    articleCreditCost,
    affordableArticleCount,
    articleCreditOverview,
    batchSlots,
    releaseScheduleSettings,
    releaseScheduleOf: mocks.schedule,
    hasPlanProfile: (row: { focus?: string; keywords?: string[] }) =>
      Boolean(row.focus?.trim() || row.keywords?.length),
    refillKeywordPlan: mocks.refill,
    withAiSpend: (_site: string, run: () => unknown) => run(),
    proposeArticleTopics: mocks.aiTopics,
    siteKeywords: (row: { keywords: string[] }) => row.keywords,
    reportCaughtError: vi.fn(),
    MAX_BATCH_ITEMS,
    planTopicsFor: mocks.planTopics,
    consumeRateLimit: mocks.rateLimit,
    logAction: mocks.log,
    toDatabaseJson: (value: unknown) => value,
    isUniqueViolation: (error: { code?: string }) => error?.code === '23505',
    prisma: { ...tx, $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
  }))
    vi.stubGlobal(name, value)
}

stubGlobals()
const batches = await import('../../server/utils/articleBatch')

const proposal = [
  {
    id: ROW_ID,
    topic: 'Plan topic',
    reason: 'Readers ask',
    keyword: 'pond',
    volume: 100,
    instructions: null,
    keywordClusterId: CLUSTER_ID,
    recommended: true,
  },
]

const daily = {
  frequency: 'INTERVAL',
  timeZone: 'UTC',
  releaseHour: 16,
  releaseWindowStart: 0,
  releaseWindowEnd: 24,
  releaseDays: [1, 2, 3, 4, 5, 6, 7],
  intervalMinHours: 24,
  intervalMaxHours: 24,
}

const planTopic = (id: string, opportunity: Record<string, unknown> = {}, status = 'OPEN') => ({
  id,
  status,
  keyword: id,
  volume: 90,
  opportunity: { angle: `Angle ${id}`, reason: 'Why', articleFit: 'strong', specificity: 'focused', ...opportunity },
})

const confirmInput = {
  id: 'batch-1',
  clientSiteId: 'site-1',
  userId: 'user-1',
  mode: 'DRAFTS' as const,
  paceHours: 48 as const,
  items: [{ id: ROW_ID, topic: 'Edited topic' }],
  customTopics: [],
}

describe('article batches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubGlobals()
    mocks.member.mockResolvedValue({
      user: { id: 'user-1', clientSiteId: 'site-1' },
      membership: { role: 'MEMBER', scopes: ['AI_USE', 'ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS'] },
    })
    mocks.wallet.mockResolvedValue({ available: 20, grants: [] })
    mocks.batchFindFirst.mockResolvedValue({ proposal })
    mocks.siteFindFirst.mockResolvedValue(site)
    mocks.clusterFindFirst.mockResolvedValue({ status: 'PINNED' })
    mocks.clusterUpdateMany.mockResolvedValue({ count: 1 })
    mocks.feature.mockResolvedValue(true)
    mocks.rateLimit.mockResolvedValue(true)
    mocks.planTopics.mockResolvedValue([])
    mocks.batchCreate.mockResolvedValue({ id: 'batch-new' })
    mocks.schedule.mockReturnValue(null)
    mocks.refill.mockResolvedValue({ attempted: false })
    mocks.articles.mockResolvedValue([])
    mocks.aiTopics.mockResolvedValue([])
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('requireArticleBatchAccess', () => {
    const member = (scopes: string[]) =>
      mocks.member.mockResolvedValue({
        user: { id: 'user-1', clientSiteId: 'site-1' },
        membership: { role: 'MEMBER', scopes },
      })

    it('requires the scope that lets the requester open the AI-authored drafts', async () => {
      member(['AI_USE', 'ARTICLE_WRITE'])
      await expect(batches.requireArticleBatchAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
    })

    it('requires publishing rights for a batch that publishes itself', async () => {
      member(['AI_USE', 'ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS'])
      await expect(batches.requireArticleBatchAccess({} as never, 'SPREAD')).rejects.toMatchObject({ statusCode: 403 })
      await expect(batches.requireArticleBatchAccess({} as never, 'DRAFTS')).resolves.toMatchObject({
        clientSiteId: 'site-1',
      })
    })

    it('takes the tenant from the session', async () => {
      mocks.member.mockResolvedValue({
        user: { id: 'user-1', clientSiteId: null },
        membership: { role: 'OWNER', scopes: [] },
      })
      await expect(batches.requireArticleBatchAccess({} as never)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('proposeArticleBatch', () => {
    const noLive = () => mocks.batchFindFirst.mockResolvedValue(null)

    it('does not start a second plan next to a running one', async () => {
      mocks.batchFindFirst.mockResolvedValue({ id: 'b', status: 'ACTIVE', createdAt: new Date() })
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'ACTIVE' },
      })
    })

    it('reuses a fresh proposal, so reopening the page costs nothing', async () => {
      mocks.batchFindFirst.mockResolvedValue({ id: 'b', status: 'PROPOSED', createdAt: new Date() })
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).resolves.toEqual({ id: 'b', missing: 0 })
      expect(mocks.planTopics).not.toHaveBeenCalled()
      expect(mocks.batchCreate).not.toHaveBeenCalled()
    })

    it('refuses without credits before any paid work', async () => {
      noLive()
      mocks.wallet.mockResolvedValue({ available: 0, grants: [] })
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).rejects.toMatchObject({
        statusCode: 402,
        data: { code: 'NO_CREDITS' },
      })
      expect(mocks.planTopics).not.toHaveBeenCalled()
    })

    it('refuses a site with no profile before any paid work', async () => {
      noLive()
      mocks.siteFindFirst.mockResolvedValue({ ...site, focus: ' ', keywords: [] })
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'NO_PROFILE' },
      })
      expect(mocks.planTopics).not.toHaveBeenCalled()
      expect(mocks.batchCreate).not.toHaveBeenCalled()
    })

    it("preselects only strong, focused topics and the editor's pins", async () => {
      noLive()
      mocks.planTopics.mockResolvedValue([
        planTopic('strong'),
        planTopic('possible', { articleFit: 'possible' }),
        planTopic('broad', { specificity: 'broad' }),
        planTopic('pinned', { articleFit: 'possible', specificity: 'broad' }, 'PINNED'),
      ])
      await batches.proposeArticleBatch('site-1', 'user-1')
      const stored = mocks.batchCreate.mock.calls[0]![0].data.proposal
      expect(
        Object.fromEntries(
          stored.map((row: { keyword: string; recommended: boolean }) => [row.keyword, row.recommended]),
        ),
      ).toEqual({
        strong: true,
        possible: false,
        broad: false,
        pinned: true,
      })
    })

    it('leaves a week of topics to a running autopilot', async () => {
      noLive()
      mocks.schedule.mockReturnValue(daily)
      mocks.wallet.mockResolvedValue({ available: 500, grants: [] })
      mocks.planTopics.mockResolvedValue(Array.from({ length: 10 }, (_, index) => planTopic(`c${index}`)))
      await batches.proposeArticleBatch('site-1', 'user-1')
      const stored = mocks.batchCreate.mock.calls[0]![0].data.proposal
      expect(stored.map((row: { keyword: string }) => row.keyword)).toEqual(['c0', 'c1', 'c2'])
    })

    it('fills from the keyword plan first and asks the top-up only for the rest', async () => {
      noLive()
      mocks.wallet.mockResolvedValue({ available: 4, grants: [] })
      mocks.planTopics.mockResolvedValue([
        { id: CLUSTER_ID, keyword: 'pond', volume: 90, opportunity: { angle: 'Angle one', reason: 'Why' } },
      ])
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).resolves.toEqual({ id: 'batch-new', missing: 3 })
      const { proposal: stored, proposingUntil } = mocks.batchCreate.mock.calls[0]![0].data
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ topic: 'Angle one', keywordClusterId: CLUSTER_ID, volume: 90 })
      expect(proposingUntil).toBeInstanceOf(Date)
    })

    it('never proposes more topics than the batch limit or the credits', async () => {
      noLive()
      mocks.wallet.mockResolvedValue({ available: 500, grants: [] })
      mocks.planTopics.mockResolvedValue(
        Array.from({ length: 40 }, (_, index) => ({
          id: `c${index}`,
          keyword: `k${index}`,
          volume: 1,
          opportunity: { angle: `Angle ${index}`, reason: 'Why' },
        })),
      )
      const result = await batches.proposeArticleBatch('site-1', 'user-1')
      expect(result.missing).toBe(0)
      expect(mocks.batchCreate.mock.calls[0]![0].data.proposal).toHaveLength(MAX_BATCH_ITEMS)
    })

    it('answers a lost race with the same conflict', async () => {
      noLive()
      mocks.batchCreate.mockRejectedValue({ code: '23505' })
      await expect(batches.proposeArticleBatch('site-1', 'user-1')).rejects.toMatchObject({
        statusCode: 409,
        data: { code: 'ACTIVE' },
      })
    })
  })

  describe('topUpArticleBatchProposal', () => {
    const lastUpdate = () => mocks.batchUpdateMany.mock.calls.at(-1)![0].data

    beforeEach(() => {
      mocks.batchFindFirst.mockResolvedValue({ proposal })
      mocks.batchUpdateMany.mockResolvedValue({ count: 1 })
      mocks.schedule.mockReturnValue(null)
    })

    it('rebuilds the plan first and takes its new topics before asking the model', async () => {
      const order: string[] = []
      mocks.refill.mockImplementation(async () => {
        order.push('rebuild')
        return { attempted: true }
      })
      mocks.planTopics.mockResolvedValue([planTopic(CLUSTER_ID), planTopic('new-1'), planTopic('new-2')])
      mocks.aiTopics.mockImplementation(async () => {
        order.push('model')
        return [{ topic: 'AI topic', reason: 'Fits' }]
      })
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 3)

      expect(order).toEqual(['rebuild', 'model'])
      expect(mocks.refill).toHaveBeenCalledWith(site, 4)
      // Topics from the plan are saved before the model can fail.
      const first = mocks.batchUpdateMany.mock.calls[0]![0].data
      expect(first.proposal.map((row: { keyword: string }) => row.keyword)).toEqual(['pond', 'new-1', 'new-2'])
      expect(first).not.toHaveProperty('proposingUntil')
      expect(mocks.aiTopics.mock.calls[0]![1]).toBe(1)
      expect(lastUpdate().proposingUntil).toBeNull()
      expect(lastUpdate().proposal.at(-1)).toMatchObject({ topic: 'AI topic', recommended: false })
      expect(lastUpdate().proposal[1]).toMatchObject({ keywordClusterId: 'new-1', recommended: true })
    })

    it('replaces a proposed topic the rebuild removed, so confirming does not silently lose it', async () => {
      mocks.planTopics.mockResolvedValue([planTopic('new-1'), planTopic('new-2')])
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 1)
      const first = mocks.batchUpdateMany.mock.calls[0]![0].data
      expect(first.proposal.map((row: { keyword: string }) => row.keyword)).toEqual(['new-1', 'new-2'])
      expect(mocks.aiTopics).not.toHaveBeenCalled()
    })

    it('does not ask the model once the plan has covered the request', async () => {
      mocks.planTopics.mockResolvedValue([planTopic(CLUSTER_ID), planTopic('new-1')])
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 1)
      expect(mocks.rateLimit).not.toHaveBeenCalled()
      expect(mocks.aiTopics).not.toHaveBeenCalled()
      expect(lastUpdate()).toEqual({ proposingUntil: null })
    })

    it('leaves the reserve with a running autopilot when it refills', async () => {
      mocks.schedule.mockReturnValue(daily)
      mocks.planTopics.mockResolvedValue([
        planTopic(CLUSTER_ID),
        ...Array.from({ length: 8 }, (_, index) => planTopic(`c${index}`)),
      ])
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 5)
      expect(mocks.refill).toHaveBeenCalledWith(site, 13)
      const first = mocks.batchUpdateMany.mock.calls[0]![0].data
      expect(first.proposal.map((row: { keyword: string }) => row.keyword)).toEqual(['pond', 'c0'])
    })

    it('neither rebuilds nor reads the plan for a site without ARTICLE_CRONS', async () => {
      mocks.feature.mockResolvedValue(false)
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 2)
      expect(mocks.refill).not.toHaveBeenCalled()
      expect(mocks.planTopics).not.toHaveBeenCalled()
      expect(mocks.aiTopics.mock.calls[0]![1]).toBe(2)
    })

    it('stays within the model limits per proposal and per day', async () => {
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 25)
      expect(mocks.aiTopics.mock.calls[0]![1]).toBe(10)

      mocks.aiTopics.mockClear()
      mocks.rateLimit.mockResolvedValue(false)
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 2)
      expect(mocks.aiTopics).not.toHaveBeenCalled()
      expect(lastUpdate()).toEqual({ proposingUntil: null })
    })

    it('keeps what it has and stops waiting when something fails', async () => {
      mocks.refill.mockRejectedValue(new Error('down'))
      await batches.topUpArticleBatchProposal('batch-1', 'site-1', 2)
      expect(reportCaughtError).toHaveBeenCalled()
      expect(lastUpdate()).toEqual({ proposingUntil: null })
    })
  })

  describe('confirmArticleBatch', () => {
    it('reads the batch through the active tenant', async () => {
      await batches.confirmArticleBatch(confirmInput)
      expect(mocks.batchFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'batch-1', clientSiteId: 'site-1', status: 'PROPOSED', deletedAt: null },
        }),
      )
    })

    it('takes clusters from its stored proposal, never from the request', async () => {
      await expect(
        batches.confirmArticleBatch({
          ...confirmInput,
          items: [{ id: '00000000-0000-4000-8000-000000000000', topic: 'Forged row' }],
        }),
      ).rejects.toMatchObject({ statusCode: 409, data: { code: 'EMPTY' } })
      expect(mocks.clusterUpdateMany).not.toHaveBeenCalled()
    })

    it('reserves the topic within the tenant and remembers it was pinned', async () => {
      await batches.confirmArticleBatch(confirmInput)
      expect(mocks.clusterFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CLUSTER_ID, clientSiteId: 'site-1', status: { in: ['OPEN', 'PINNED'] } },
        }),
      )
      expect(mocks.clusterUpdateMany).toHaveBeenCalledWith({
        where: { id: CLUSTER_ID, status: 'PINNED' },
        data: { status: 'RESERVED' },
      })
      expect(mocks.itemCreateMany.mock.calls[0]![0].data[0]).toMatchObject({
        topic: 'Edited topic',
        keywordClusterId: CLUSTER_ID,
        clusterPinned: true,
        clientSiteId: 'site-1',
      })
    })

    it('drops a topic the autopilot wrote meanwhile rather than competing with it', async () => {
      mocks.clusterFindFirst.mockResolvedValue(null)
      await expect(batches.confirmArticleBatch({ ...confirmInput, customTopics: ['My own topic'] })).resolves.toEqual({
        items: 1,
      })
      expect(mocks.itemCreateMany.mock.calls[0]![0].data[0]).toMatchObject({
        topic: 'My own topic',
        keywordClusterId: null,
      })
    })

    it('rejects a plan the credits cannot pay for, at the current quality', async () => {
      mocks.siteFindFirst.mockResolvedValue({ ...site, articleQuality: 'ULTRA' })
      mocks.wallet.mockResolvedValue({ available: 5, grants: [] })
      await expect(
        batches.confirmArticleBatch({ ...confirmInput, customTopics: ['One more topic'] }),
      ).rejects.toMatchObject({ statusCode: 402, data: { code: 'INSUFFICIENT_CREDITS', required: 6, available: 5 } })
      expect(mocks.itemCreateMany).not.toHaveBeenCalled()
    })

    it('refuses to publish gradually on a site that does not publish to the web', async () => {
      mocks.siteFindFirst.mockResolvedValue({ ...site, publishToWeb: false })
      await expect(batches.confirmArticleBatch({ ...confirmInput, mode: 'SPREAD' })).rejects.toMatchObject({
        statusCode: 400,
        data: { code: 'NO_WEB_PUBLISHING' },
      })
    })

    it('spreads the articles by the chosen pace', async () => {
      await batches.confirmArticleBatch({
        ...confirmInput,
        mode: 'SPREAD',
        customTopics: ['Second topic', 'Third topic'],
      })
      const items = mocks.itemCreateMany.mock.calls[0]![0].data as { scheduledFor: Date }[]
      expect(items).toHaveLength(3)
      expect(items[2]!.scheduledFor.getTime() - items[0]!.scheduledFor.getTime()).toBeGreaterThanOrEqual(
        2 * 48 * 3_600_000 - 120_000,
      )
      expect(mocks.batchUpdate.mock.calls[0]![0].data).toMatchObject({
        status: 'ACTIVE',
        mode: 'SPREAD',
        paceHours: 48,
        requestedById: 'user-1',
      })
    })

    it('answers 404 for a batch of another tenant or one already started', async () => {
      mocks.batchFindFirst.mockResolvedValue(null)
      await expect(batches.confirmArticleBatch(confirmInput)).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('cancelArticleBatch', () => {
    it('frees the topics of articles not yet started and restores their pin', async () => {
      mocks.batchUpdateMany.mockResolvedValue({ count: 1 })
      mocks.itemFindMany.mockResolvedValue([
        { keywordClusterId: 'c-pinned', clusterPinned: true },
        { keywordClusterId: 'c-open', clusterPinned: false },
        { keywordClusterId: null, clusterPinned: false },
      ])
      await batches.cancelArticleBatch('batch-1', 'site-1', 'user-1')
      expect(mocks.batchUpdateMany.mock.calls[0]![0].where).toMatchObject({ id: 'batch-1', clientSiteId: 'site-1' })
      expect(mocks.clusterUpdateMany).toHaveBeenCalledTimes(2)
      expect(mocks.clusterUpdateMany).toHaveBeenCalledWith({
        where: { id: 'c-pinned', status: 'RESERVED' },
        data: { status: 'PINNED' },
      })
      expect(mocks.clusterUpdateMany).toHaveBeenCalledWith({
        where: { id: 'c-open', status: 'RESERVED' },
        data: { status: 'OPEN' },
      })
      expect(mocks.itemUpdateMany.mock.calls[0]![0].where).toEqual({ batchId: 'batch-1', status: 'QUEUED' })
    })

    it('answers 404 outside the tenant', async () => {
      mocks.batchUpdateMany.mockResolvedValue({ count: 0 })
      await expect(batches.cancelArticleBatch('batch-1', 'site-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('serializeArticleBatch', () => {
    it('never sends cluster IDs or internal errors to the browser', () => {
      const view = batches.serializeArticleBatch({
        id: 'b',
        status: 'PROPOSED',
        mode: null,
        paceHours: null,
        proposal,
        proposingUntil: null,
        pauseReason: null,
        pausedUntil: null,
        items: [],
      })
      expect(view.proposal).toEqual([
        { id: ROW_ID, topic: 'Plan topic', reason: 'Readers ask', keyword: 'pond', volume: 100, recommended: true },
      ])
      expect(JSON.stringify(view)).not.toContain(CLUSTER_ID)
    })

    it('reports a pause only while one is set, and an expired top-up as finished', () => {
      const view = batches.serializeArticleBatch(
        {
          id: 'b',
          status: 'ACTIVE',
          mode: 'SPREAD',
          paceHours: 48,
          proposal: [],
          proposingUntil: new Date('2026-11-10T08:00:00.000Z'),
          pauseReason: 'credits',
          pausedUntil: null,
          items: [],
        },
        new Date('2026-11-10T09:00:00.000Z'),
      )
      expect(view).toMatchObject({ proposing: false, pauseReason: null })
    })
  })
})
