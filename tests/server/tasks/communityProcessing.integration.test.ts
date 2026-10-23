// @vitest-environment node
import { generateText } from 'ai'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'
import { activeFeatureFilter } from '../../../server/utils/planFeatures'

vi.mock('ai', async (original) => ({ ...(await original<typeof import('ai')>()), generateText: vi.fn() }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const users: string[] = []
const sentiment = { label: 'positive', score: 0.4, confidence: 0.9 }
const detected = { object: sentiment, usage: { totalTokens: 10 } }
const insight = {
  summary: 'A helpful discussion among readers.',
  avgScore: 0.4,
  topEmotion: null,
  toxicity: 0,
  helpfulness: 0,
  sarcasm: 0,
  suggestion: null,
}
const signal = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const fixture = async (options: { processed?: boolean; count?: number; enabled?: boolean } = {}) => {
  const clientSiteId = randomUUID()
  const userId = randomUUID()
  sites.push(clientSiteId)
  users.push(userId)
  await db!.clientSite.create({
    data: { id: clientSiteId, name: `community-${clientSiteId}`, domain: `${clientSiteId}.test`, plan: 'PREMIUM' },
  })
  await db!.user.create({ data: { id: userId, email: `${userId}@example.invalid`, username: `community-${userId}` } })
  for (const code of ['AI', 'SENTIMENT'] as const) {
    const feature = await db!.feature.upsert({
      where: { code },
      create: { code, name: code, priceMonthly: 0 },
      update: {},
    })
    await db!.clientFeature.create({
      data: { clientSiteId, featureId: feature.id, billingLockedUntil: new Date(), isActive: options.enabled ?? true },
    })
  }
  const article = await db!.article.create({
    data: {
      clientSiteId,
      userId,
      slug: randomUUID(),
      language: 'en',
      title: 'Community task test',
      content: 'An article.',
      status: 'published',
    },
  })
  await db!.comment.createMany({
    data: Array.from({ length: options.count ?? 12 }, (_, index) => ({
      articleId: article.id,
      userId,
      content: `Comment ${index}`,
      sentimentStatus: options.processed ? 'PROCESSED' : 'PENDING',
      sentiment: options.processed ? sentiment : undefined,
    })),
  })
  return { clientSiteId, articleId: article.id, userId }
}

describe.skipIf(!enabled)('community paid processing on PostgreSQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
    vi.stubGlobal('activeFeatureFilter', activeFeatureFilter)
    vi.stubGlobal('detectSentiment', vi.fn().mockResolvedValue(detected))
    vi.stubGlobal('recordAiUsage', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('aiModel', () => 'test-model')
    vi.mocked(generateText)
      .mockReset()
      .mockResolvedValue({ output: insight, usage: { totalTokens: 20 } } as never)
  })
  afterEach(async () => {
    if (db) {
      await db.clientSite.deleteMany({ where: { id: { in: sites } } })
      await db.user.deleteMany({ where: { id: { in: users } } })
    }
    sites.length = 0
    users.length = 0
    vi.unstubAllGlobals()
  })
  afterAll(async () => db?.$disconnect())

  it('does not pay twice for comments selected by overlapping workers', async () => {
    const f = await fixture()
    const started = signal()
    const secondRead = signal()
    const release = signal()
    vi.mocked(detectSentiment).mockImplementation(async () => {
      started.resolve()
      await release.promise
      return detected
    })
    const comments = db!.comment
    let reads = 0
    vi.stubGlobal('prisma', {
      $transaction: db!.$transaction.bind(db),
      comment: {
        findMany: async (...args: Parameters<typeof comments.findMany>) => {
          const rows = await comments.findMany(...args)
          if (++reads === 2) secondRead.resolve()
          return rows
        },
        update: comments.update.bind(comments),
        updateMany: comments.updateMany.bind(comments),
        findFirst: comments.findFirst.bind(comments),
        findUnique: comments.findUnique.bind(comments),
      },
    })
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    const first = task.run({} as never)
    await started.promise
    const second = task.run({} as never)
    await secondRead.promise
    release.resolve()
    await Promise.all([first, second])
    expect(detectSentiment).toHaveBeenCalledTimes(12)
    expect(await db!.comment.count({ where: { articleId: f.articleId, sentimentStatus: 'PROCESSED' } })).toBe(12)
    expect(recordAiUsage).toHaveBeenCalledTimes(12)
  })

  it('bounds provider concurrency for one batch instead of starting every comment at once', async () => {
    await fixture()
    let running = 0
    let peak = 0
    vi.mocked(detectSentiment).mockImplementation(async () => {
      peak = Math.max(peak, ++running)
      await new Promise((resolve) => setTimeout(resolve, 10))
      running--
      return detected
    })
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    const result = await task.run({} as never)
    expect(result).toMatchObject({ result: { failed: 0 } })
    expect(peak).toBeLessThanOrEqual(4)
    expect(detectSentiment).toHaveBeenCalledTimes(12)
  })

  it('does not commit sentiment for a comment deleted while its provider call is running', async () => {
    const f = await fixture({ count: 1 })
    const started = signal()
    const release = signal()
    vi.mocked(detectSentiment).mockImplementation(async () => {
      started.resolve()
      await release.promise
      return detected
    })
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    const running = task.run({} as never)
    await started.promise
    await db!.comment.updateMany({ where: { articleId: f.articleId }, data: { deletedAt: new Date() } })
    release.resolve()
    expect(await running).toMatchObject({ result: { processed: 0, skipped: 1, failed: 0 } })
    expect(await db!.comment.findFirstOrThrow({ where: { articleId: f.articleId } })).toMatchObject({
      sentiment: null,
      sentimentStatus: 'PENDING',
      sentimentAttempts: 0,
    })
    expect(recordAiUsage).toHaveBeenCalledOnce()
  })

  it('reclaims an expired sentiment lease and rejects its obsolete completion', async () => {
    const f = await fixture({ count: 1 })
    const started = signal()
    const release = signal()
    vi.mocked(detectSentiment)
      .mockImplementationOnce(async () => {
        started.resolve()
        await release.promise
        return detected
      })
      .mockResolvedValueOnce({ ...detected, object: { ...sentiment, score: -0.4 } } as never)
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    const old = task.run({} as never)
    await started.promise
    await db!.comment.updateMany({
      where: { articleId: f.articleId },
      data: { sentimentClaimedAt: new Date(Date.now() - 6 * 60_000) },
    })
    expect(await task.run({} as never)).toMatchObject({ result: { processed: 1, failed: 0 } })
    release.resolve()
    expect(await old).toMatchObject({ result: { processed: 0, skipped: 1 } })
    expect(await db!.comment.findFirstOrThrow({ where: { articleId: f.articleId } })).toMatchObject({
      sentiment: { score: -0.4 },
      sentimentStatus: 'PROCESSED',
    })
    expect(recordAiUsage).toHaveBeenCalledTimes(2)
  })

  it('isolates a partial provider failure and does not retry it before its backoff', async () => {
    const f = await fixture({ count: 2 })
    vi.mocked(detectSentiment).mockRejectedValueOnce(new Error('Synthetic provider failure'))
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    expect(await task.run({} as never)).toMatchObject({ result: { processed: 1, failed: 1 } })
    expect(await task.run({} as never)).toMatchObject({ result: { processed: 0, total: 0 } })
    expect(detectSentiment).toHaveBeenCalledTimes(2)
    expect(await db!.comment.count({ where: { articleId: f.articleId, sentimentStatus: 'PROCESSED' } })).toBe(1)
    expect(recordAiUsage).toHaveBeenCalledOnce()
  })

  it('terminates exhausted stale sentiment claims without another paid call', async () => {
    const f = await fixture({ count: 1 })
    await db!.comment.updateMany({
      where: { articleId: f.articleId },
      data: {
        sentimentAttempts: 3,
        sentimentClaimToken: 'abandoned',
        sentimentClaimedAt: new Date(Date.now() - 6 * 60_000),
      },
    })
    const task = (await import('../../../server/tasks/sentiment-analysis')).default
    expect(await task.run({} as never)).toMatchObject({ result: { failed: 1, processed: 0 } })
    expect(detectSentiment).not.toHaveBeenCalled()
    expect(await db!.comment.findFirstOrThrow({ where: { articleId: f.articleId } })).toMatchObject({
      sentimentStatus: 'ERROR',
    })
  })

  it('ignores deleted and feature-disabled sites when generating insights', async () => {
    const disabled = await fixture({ processed: true, enabled: false })
    const deleted = await fixture({ processed: true })
    await db!.clientSite.update({ where: { id: deleted.clientSiteId }, data: { deletedAt: new Date() } })
    const task = (await import('../../../server/tasks/community-insights')).default
    await task.run({} as never)
    expect(generateText).not.toHaveBeenCalled()
    for (const clientSiteId of [disabled.clientSiteId, deleted.clientSiteId])
      expect(await db!.clientSite.findUniqueOrThrow({ where: { id: clientSiteId } })).toMatchObject({
        communityInsight: null,
      })
  })

  it('creates one daily insight across overlapping replicas and describes the actual seven-day period', async () => {
    const f = await fixture({ processed: true })
    const started = signal()
    const release = signal()
    vi.mocked(generateText).mockImplementation((async () => {
      started.resolve()
      await release.promise
      return { output: insight, usage: { totalTokens: 20 } }
    }) as never)
    const task = (await import('../../../server/tasks/community-insights')).default
    const first = task.run({} as never)
    await Promise.race([
      started.promise,
      first.then((result) => {
        throw new Error(`Insight task ended before invoking the provider: ${JSON.stringify(result)}`)
      }),
    ])
    const second = task.run({} as never)
    // The second run either loses the claim or waits on the same synthetic provider barrier.
    await new Promise((resolve) => setTimeout(resolve, 30))
    release.resolve()
    await Promise.all([first, second])
    expect(generateText).toHaveBeenCalledOnce()
    expect(vi.mocked(generateText).mock.calls[0]![0].prompt).toContain('7 days')
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })).toMatchObject({
      communityInsight: { summary: insight.summary },
    })
  })

  it('clears a stale report explicitly when undeleted recent scored comments are insufficient', async () => {
    const f = await fixture({ processed: true })
    await db!.clientSite.update({ where: { id: f.clientSiteId }, data: { communityInsight: insight } })
    const deleted = await db!.comment.findMany({ where: { articleId: f.articleId }, select: { id: true }, take: 3 })
    await db!.comment.updateMany({
      where: { id: { in: deleted.map((comment) => comment.id) } },
      data: { deletedAt: new Date() },
    })
    const task = (await import('../../../server/tasks/community-insights')).default
    await task.run({} as never)
    expect(generateText).not.toHaveBeenCalled()
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })).toMatchObject({
      communityInsight: null,
    })
  })

  it('retains the last success through a failed report, backs off, and retries without nesting errors', async () => {
    const f = await fixture({ processed: true })
    const previousTime = new Date(Date.now() - 86_400_000)
    await db!.clientSite.update({
      where: { id: f.clientSiteId },
      data: { communityInsight: { ...insight, avgScore: 0 }, insightUpdatedAt: previousTime },
    })
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Synthetic provider failure'))
    const task = (await import('../../../server/tasks/community-insights')).default
    expect(await task.run({} as never)).toMatchObject({ result: { failed: 1, updated: 0 } })
    const failed = await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })
    expect(failed).toMatchObject({
      communityInsight: { ...insight, avgScore: 0 },
      insightUpdatedAt: previousTime,
      insightAttempts: 1,
      insightError: 'REPORT_FAILED',
    })
    expect(failed.insightNextAttemptAt!.getTime()).toBeGreaterThan(Date.now() + 50 * 60_000)
    await task.run({} as never)
    expect(generateText).toHaveBeenCalledOnce()
    await db!.clientSite.update({
      where: { id: f.clientSiteId },
      data: { insightNextAttemptAt: new Date(Date.now() - 1) },
    })
    expect(await task.run({} as never)).toMatchObject({ result: { updated: 1, failed: 0 } })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })).toMatchObject({
      communityInsight: { avgScore: expect.closeTo(0.4), trend: 'up' },
      insightError: null,
      insightAttempts: 2,
    })
  })

  it('rejects an obsolete community report after a replacement owns and completes the lease', async () => {
    const f = await fixture({ processed: true })
    const started = signal()
    const release = signal()
    vi.mocked(generateText)
      .mockImplementationOnce((async () => {
        started.resolve()
        await release.promise
        return {
          output: { ...insight, summary: 'Obsolete community report from old worker.' },
          usage: { totalTokens: 20 },
        }
      }) as never)
      .mockResolvedValueOnce({ output: insight, usage: { totalTokens: 20 } } as never)
    const task = (await import('../../../server/tasks/community-insights')).default
    const old = task.run({} as never)
    await started.promise
    await db!.clientSite.update({
      where: { id: f.clientSiteId },
      data: { insightClaimedAt: new Date(Date.now() - 6 * 60_000) },
    })
    expect(await task.run({} as never)).toMatchObject({ result: { updated: 1 } })
    release.resolve()
    expect(await old).toMatchObject({ result: { updated: 0, skipped: 1 } })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })).toMatchObject({
      communityInsight: { summary: insight.summary },
    })
    expect(recordAiUsage).toHaveBeenCalledTimes(2)
  })

  it('reports an exhausted crashed insight lease and preserves the last successful report', async () => {
    const f = await fixture({ processed: true })
    await db!.clientSite.update({
      where: { id: f.clientSiteId },
      data: {
        communityInsight: insight,
        insightUpdatedAt: new Date(Date.now() - 86_400_000),
        insightAttemptedAt: new Date(),
        insightAttempts: 3,
        insightClaimToken: 'abandoned',
        insightClaimedAt: new Date(Date.now() - 6 * 60_000),
      },
    })
    const task = (await import('../../../server/tasks/community-insights')).default
    expect(await task.run({} as never)).toMatchObject({ result: { failed: 1, updated: 0 } })
    expect(generateText).not.toHaveBeenCalled()
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: f.clientSiteId } })).toMatchObject({
      communityInsight: insight,
      insightError: 'LEASE_EXPIRED',
    })
  })
})
