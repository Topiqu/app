// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../server/utils/database'
import { releaseScheduleSettings } from '../../shared/utils/releaseSchedule'
import { cancelArticleBatch, confirmArticleBatch } from '../../server/utils/articleBatch'
import { planProfile, refillKeywordPlan, refreshKeywordPlan } from '../../server/utils/keywords/plan'
import { creditArticleCredits, getArticleCreditWallet } from '../../server/utils/articleCreditWallet'
import { batchSlots, MAX_BATCH_ITEMS, type ArticleBatchProposalItem } from '../../shared/utils/articleBatch'
import { ARTICLE_CREDIT_POLICY_VERSION, articleCreditCost, articleRolloverCap } from '../../shared/utils/articleCredits'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null

describe.skipIf(!enabled)('article batches on PostgreSQL', () => {
  beforeAll(() => {
    for (const [name, value] of Object.entries({
      prisma: db,
      createError,
      batchSlots,
      MAX_BATCH_ITEMS,
      articleCreditCost,
      articleRolloverCap,
      ARTICLE_CREDIT_POLICY_VERSION,
      releaseScheduleSettings,
      getArticleCreditWallet,
      creditArticleCredits,
      logAction: vi.fn(),
      toDatabaseJson: (value: unknown) => value,
      isUniqueViolation: (error: { cause?: { code?: string }; code?: string }) =>
        (error?.code ?? error?.cause?.code) === '23505',
    }))
      vi.stubGlobal(name, value)
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  const tenant = async (credits = 20) => {
    const id = randomUUID()
    await db!.clientSite.create({ data: { id, name: `article-batch-${id}`, domain: `${id}.test` } })
    await creditArticleCredits({
      clientSiteId: id,
      amount: credits,
      source: 'ADMIN',
      reason: 'test allowance',
      idempotencyKey: randomUUID(),
    })
    return id
  }

  const cluster = (clientSiteId: string, status: 'OPEN' | 'PINNED', keyword = randomUUID()) =>
    db!.keywordCluster.create({
      data: { clientSiteId, keyword, keywords: [], intent: 'informational', questions: [], status },
      select: { id: true },
    })

  const proposed = async (clientSiteId: string, clusterId: string | null) => {
    const row: ArticleBatchProposalItem = {
      id: randomUUID(),
      topic: 'Proposed topic',
      reason: null,
      keyword: null,
      volume: null,
      instructions: null,
      keywordClusterId: clusterId,
      recommended: true,
    }
    const batch = await db!.articleBatch.create({
      data: { clientSiteId, proposal: [row] as never },
      select: { id: true },
    })
    return { id: batch.id, rowId: row.id }
  }

  it('allows one live batch per tenant, with finished ones kept as history', async () => {
    const id = await tenant()
    const first = await proposed(id, null)
    await expect(proposed(id, null)).rejects.toThrow()
    await db!.articleBatch.update({ where: { id: first.id }, data: { status: 'FINISHED' } })
    await expect(proposed(id, null)).resolves.toBeTruthy()
    const other = await tenant()
    await expect(proposed(other, null)).resolves.toBeTruthy()
  })

  it('reserves a topic out of the plan, then returns it pinned on cancel', async () => {
    const id = await tenant()
    const pinned = await cluster(id, 'PINNED')
    const batch = await proposed(id, pinned.id)
    const requester = await db!.user.create({
      data: { username: `u${randomUUID().slice(0, 8)}`, email: `${randomUUID()}@example.test`, role: 'admin' },
      select: { id: true },
    })
    await confirmArticleBatch({
      id: batch.id,
      clientSiteId: id,
      userId: requester.id,
      mode: 'DRAFTS',
      paceHours: 48,
      items: [{ id: batch.rowId, topic: 'Edited topic' }],
      customTopics: ['My own topic'],
    })
    expect(await db!.keywordCluster.findUnique({ where: { id: pinned.id } })).toMatchObject({ status: 'RESERVED' })
    const items = await db!.articleBatchItem.findMany({
      where: { batchId: batch.id },
      orderBy: { scheduledFor: 'asc' },
    })
    expect(items.map((item) => item.topic)).toEqual(['Edited topic', 'My own topic'])
    expect(items[0]).toMatchObject({ keywordClusterId: pinned.id, clusterPinned: true, status: 'QUEUED' })

    await cancelArticleBatch(batch.id, id, requester.id)
    expect(await db!.keywordCluster.findUnique({ where: { id: pinned.id } })).toMatchObject({ status: 'PINNED' })
    expect(await db!.articleBatch.findUnique({ where: { id: batch.id } })).toMatchObject({ status: 'CANCELLED' })
    expect(await db!.articleBatchItem.count({ where: { batchId: batch.id, status: 'CANCELLED' } })).toBe(2)
  })

  it('does not reach into another tenant through a stored proposal', async () => {
    const id = await tenant()
    const other = await tenant()
    const foreign = await cluster(other, 'OPEN')
    const batch = await proposed(id, foreign.id)
    await expect(
      confirmArticleBatch({
        id: batch.id,
        clientSiteId: id,
        userId: randomUUID(),
        mode: 'DRAFTS',
        paceHours: 48,
        items: [{ id: batch.rowId, topic: 'Stolen topic' }],
        customTopics: [],
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(await db!.keywordCluster.findUnique({ where: { id: foreign.id } })).toMatchObject({ status: 'OPEN' })
  })

  it('cannot confirm the batch of another tenant', async () => {
    const id = await tenant()
    const other = await tenant()
    const batch = await proposed(other, null)
    await expect(
      confirmArticleBatch({
        id: batch.id,
        clientSiteId: id,
        userId: randomUUID(),
        mode: 'DRAFTS',
        paceHours: 48,
        items: [{ id: batch.rowId, topic: 'Stolen topic' }],
        customTopics: [],
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  describe('keyword plan', () => {
    const DAY = 86_400_000
    const profile = { language: 'cs' as const, keywords: ['espresso', 'mlýnek', 'pražení'] }
    const dataForSeo = vi.fn()
    const scope = vi.fn()
    const assess = vi.fn()

    beforeAll(() => {
      for (const [name, value] of Object.entries({
        hasDataForSeo: () => true,
        dataForSeo,
        keywordLocation: () => ({ labsLocationCode: 2203, serpLocationCode: 2203, languageCode: 'cs', market: 'CZ' }),
        siteKeywords: (site: { keywords?: string[] }) => site.keywords ?? [],
        inScope: scope,
        assessOpportunities: assess,
        serpSignals: () => ({
          questions: [],
          aiOverview: false,
          domains: ['example.com'],
          urls: [],
          organic: [{ title: 'T', url: 'https://example.com/t', domain: 'example.com', description: 'D' }],
        }),
        suggestExpansions: async () => 0,
        rankHistoryFor: () => [],
      }))
        vi.stubGlobal(name, value)
    })

    const suggest = (keywords: string[]) => {
      dataForSeo.mockReset()
      dataForSeo.mockImplementation(async (path: string) =>
        path.includes('keyword_suggestions')
          ? { cost: 0, result: { items: keywords.map((keyword) => ({ keyword })) } }
          : { cost: 0, result: { items: [] } },
      )
    }
    const serps = () => dataForSeo.mock.calls.filter(([path]) => String(path).includes('/serp/')).length
    const accept = (index: number) => ({
      index,
      intent: 'informational',
      theme: 'káva',
      reason: 'Důvod',
      angle: 'Úhel',
      articleFit: 'strong',
      specificity: 'focused',
    })

    it('remembers rejected candidates, keeps checked topics, and forgets both when the profile changes', async () => {
      const id = await tenant()
      const site = { id, ...profile }
      const now = new Date()
      suggest(['dobrá otázka', 'slabá otázka', 'mimo blog'])
      scope.mockImplementation(async (_site: unknown, items: string[]) =>
        items.flatMap((item, index) => (item === 'mimo blog' ? [] : [index])),
      )
      assess.mockImplementation(async (_site: unknown, candidates: { keyword: string }[]) => ({
        accepted: candidates.flatMap((c, index) => (c.keyword === 'dobrá otázka' ? [accept(index)] : [])),
        rejected: candidates.flatMap((c, index) =>
          c.keyword === 'slabá otázka' ? [{ index, reason: 'poor' as const }] : [],
        ),
        expansions: [],
        covered: [],
      }))

      await expect(refreshKeywordPlan(site, now)).resolves.toBe(1)
      const reasons = async () =>
        Object.fromEntries(
          (
            await db!.keywordRejection.findMany({
              where: { clientSiteId: id },
              select: { keyword: true, reason: true },
            })
          ).map((row) => [row.keyword, row.reason]),
        )
      expect(await reasons()).toEqual({ 'slabá otázka': 'poor' })
      const first = serps()
      expect(first).toBe(2)

      await expect(refreshKeywordPlan(site, new Date(now.getTime() + DAY))).resolves.toBe(0)
      expect(serps()).toBe(first)
      await expect(
        db!.keywordCluster.count({ where: { clientSiteId: id, keyword: 'dobrá otázka', status: 'OPEN' } }),
      ).resolves.toBe(1)

      const changed = { ...site, audience: 'Jiní čtenáři' }
      expect(planProfile(changed)).not.toBe(planProfile(site))
      suggest(['dobrá otázka', 'slabá otázka', 'mimo blog'])
      scope.mockImplementation(async (_site: unknown, items: string[]) => items.map((_, index) => index))
      assess.mockImplementation(async (_site: unknown, candidates: unknown[]) => ({
        accepted: candidates.map((_, index) => accept(index)),
        rejected: [],
        expansions: [],
        covered: [],
      }))
      await expect(refreshKeywordPlan(changed, new Date(now.getTime() + 2 * DAY))).resolves.toBe(3)
      expect(await reasons()).toEqual({})
    })

    it('lets the old rows expire after ninety days', async () => {
      const id = await tenant()
      const site = { id, ...profile }
      const now = new Date()
      await db!.keywordRejection.createMany({
        data: [
          {
            clientSiteId: id,
            keyword: 'prošlá',
            profile: planProfile(site),
            reason: 'poor',
            rejectedAt: new Date(now.getTime() - 91 * DAY),
          },
          { clientSiteId: id, keyword: 'platná', profile: planProfile(site), reason: 'poor', rejectedAt: now },
        ],
      })
      suggest([])
      scope.mockResolvedValue([])
      assess.mockResolvedValue({ accepted: [], rejected: [], expansions: [], covered: [] })
      await refreshKeywordPlan(site, now)
      const rows = await db!.keywordRejection.findMany({ where: { clientSiteId: id }, select: { keyword: true } })
      expect(rows.map((row) => row.keyword)).toEqual(['platná'])
    })

    it('treats a topic a batch reserved after the last rebuild as used', async () => {
      const id = await tenant()
      const site = {
        id,
        ...profile,
        keywordPlanProfile: planProfile({ id, ...profile }),
        keywordPlanRefreshedAt: new Date(Date.now() - 2 * DAY),
        keywordPlanAttemptedAt: new Date(Date.now() - 2 * DAY),
      }
      await db!.clientSite.update({
        where: { id },
        data: { keywordPlanAttemptedAt: site.keywordPlanAttemptedAt },
      })
      const { id: clusterId } = await cluster(id, 'OPEN')
      const batch = await proposed(id, clusterId)
      const requester = await db!.user.create({
        data: { username: `u${randomUUID().slice(0, 8)}`, email: `${randomUUID()}@example.test`, role: 'admin' },
        select: { id: true },
      })
      await confirmArticleBatch({
        id: batch.id,
        clientSiteId: id,
        userId: requester.id,
        mode: 'DRAFTS',
        paceHours: 48,
        items: [{ id: batch.rowId, topic: 'Topic' }],
        customTopics: [],
      })
      suggest([])
      scope.mockResolvedValue([])
      assess.mockResolvedValue({ accepted: [], rejected: [], expansions: [], covered: [] })

      // One reserved topic does not explain a shortage of five: the niche waits out its cooldown.
      await expect(refillKeywordPlan(site, 5)).resolves.toMatchObject({ attempted: false })
      await expect(refillKeywordPlan(site, 1)).resolves.toMatchObject({ attempted: true })
    })
  })
})
