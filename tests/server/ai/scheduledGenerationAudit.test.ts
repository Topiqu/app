import type { JsonValue } from '@zenstackhq/orm'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/articleUsage'), 'withArticleUsageStage', 'bindArticleUsage')
  await stubNitroImports(import('../../../server/utils/keywords/plan'), 'themeKey', 'themeOf')
  await stubNitroImports(import('../../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../../server/utils/keywords/rank'), 'firstRankCheck')
  await stubNitroImports(import('../../../server/utils/ai/insight'), 'insightSchema')
  await stubNitroImports(import('../../../server/utils/community'), 'readCommunityInsight')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../server/utils/keywords/scope'), 'inScope')
  await stubNitroImports(import('../../../server/utils/keywords/news'), 'fetchNews', 'newsSignal')
  await stubNitroImports(import('../../../server/utils/searchConsole/autopilot'), 'isExistingArticleOpportunity')
  await stubNitroImports(
    import('../../../server/utils/articleGenerationAudit'),
    'auditArticleStep',
    'createArticleGenerationAudit',
  )
  await stubNitroImports(
    import('../../../server/utils/searchConsole/opportunities'),
    'getSearchOpportunities',
    'getSearchTrends',
    'searchOpportunitySignal',
    'searchTrendSignal',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/articleSeries'),
    'applyArticleSeriesDecision',
    'chooseArticleSeries',
    'loadAiSeriesContext',
  )
  await stubNitroImports(import('../../../server/utils/keywords/dataforseo'), 'hasDataForSeo', 'dataForSeo')
  await stubNitroImports(import('../../../server/utils/keywords/plan'), 'keywordPlanFor', 'planSignal', 'sameKeyword')
}

vi.mock('../../../server/utils/keywords/plan', () => ({
  keywordPlanFor: async () => [],
  planSignal: vi.fn(),
  sameKeyword: vi.fn(),
  themeKey: (value?: string | null) => value?.trim().toLocaleLowerCase() || null,
  themeOf: () => null,
}))
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ hasDataForSeo: () => false, dataForSeo: vi.fn() }))

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const setup = async (
  failure?: 'reservation' | 'author' | 'generation' | 'persistence' | 'publication' | 'settlement',
  communityInsight: JsonValue = null,
  articleQuality = 'STANDARD',
  options: {
    autoRelease?: boolean
    editorialReview?: unknown
    request?: Parameters<typeof import('../../../server/tasks/generate-article').processClient>[2]
    slot?: Date
    writerError?: unknown
    reservationError?: unknown
  } = {},
) => {
  const log = vi.fn().mockResolvedValue({})
  const client = {
    id: 'tenant-1',
    language: 'cs',
    articles: [],
    users: [{ id: 'author-1' }],
    keywords: [],
    autoRelease: options.autoRelease ?? failure === 'publication',
    publishToWeb: true,
    aiSeriesEnabled: false,
    communityInsight,
    articleQuality,
  }
  const generated = {
    title: 'Generated article',
    perex: 'An introduction',
    content: '<p>A useful article.</p>',
    tags: [],
    sources: [],
    answer: '',
    keyTakeaways: [],
    faq: [],
    articleImageUrl: 'https://images.test/cover',
    editorialReview: options.editorialReview ?? { approved: true },
    research: { status: 'skipped' },
    usage: { totalTokens: 42 },
  }
  const createArticle = vi.fn(async ({ data }) => ({ ...data, id: 'article-1', user: { role: 'ai' } }))
  const linkCluster = vi.fn(async () => ({ count: 1 }))
  const linkBatchItem = vi.fn(async () => ({ count: 1 }))
  const transaction = vi.fn(async (run) => {
    if (failure === 'persistence') throw new Error('Article persistence failed')
    return run({
      article: {
        findMany: async () => [],
        create: createArticle,
      },
      articleBatchItem: { updateMany: linkBatchItem },
      keywordCluster: { updateMany: linkCluster },
      articleTag: { createMany: async () => ({ count: 0 }) },
      mediaRightsPublicationSnapshot: { create: async () => ({}) },
    })
  })
  const reservation = vi.fn(async (_tenant, _action, run, _options) => {
    if (failure === 'reservation') throw new Error('No article credits')
    if (options.reservationError) throw options.reservationError
    const outcome = await run({ id: 'operation-1' })
    if (failure === 'settlement') throw new Error('Settlement failed')
    return outcome
  })
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('reportCaughtError', vi.fn())
  vi.stubGlobal('withArticleCreditReservation', reservation)
  vi.stubGlobal(
    'ensureAiAuthor',
    vi.fn(async () => {
      if (failure === 'author') throw new Error('Author unavailable')
      return { id: 'editorial-ai' }
    }),
  )
  vi.stubGlobal('aiModelId', () => 'gpt-6-luna')
  vi.stubGlobal('prisma', {
    article: { findMany: async () => [] },
    articleTranslation: { findMany: async () => [] },
    clientSite: { update: async () => ({}) },
    $transaction: transaction,
  })
  vi.stubGlobal(
    'pickArticleTopic',
    vi.fn(async () => ({
      topic: { topic: 'A topic', angle: 'Practical advice', format: 'guide', needsResearch: false },
      usage: { totalTokens: 3 },
    })),
  )
  vi.stubGlobal('selectedModulesFor', () => [])
  vi.stubGlobal('autopilotModules', (_format: string, picked: string[]) => picked)
  vi.stubGlobal('researchRequest', () => false)
  const writer = vi.fn(async () => {
    if (failure === 'generation') throw new Error('Writer unavailable')
    if (options.writerError) throw options.writerError
    return generated
  })
  vi.stubGlobal('generateArticle', writer)
  vi.stubGlobal('recordAiUsage', vi.fn())
  vi.stubGlobal('calculateArticleMetrics', () => ({ totalWords: 4, savedAmount: 1, savedTimeMinutes: 1 }))
  vi.stubGlobal('evaluateMediaRights', async () => ({
    counts: { needsAttention: 0 },
    fingerprint: 'fingerprint',
    items: [],
  }))
  vi.stubGlobal('mediaRightsSnapshotItems', () => [])
  vi.stubGlobal('sanitizeHtml', (html: string) => html)
  vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
  const notifyHeld = vi.fn().mockResolvedValue({ sent: 1 })
  vi.stubGlobal('notifyArticleHeld', notifyHeld)
  vi.stubGlobal('stampHeadingIds', (html: string) => html)
  vi.stubGlobal('syncArticlePolls', async (_db, _id, content) => content)
  vi.stubGlobal('syncArticleTranslationQueue', async () => {
    if (failure === 'publication') throw new Error('Publication failed')
  })
  vi.stubGlobal('invalidateFeed', vi.fn())
  const reservedTopic = vi.fn(async (id: string) => ({
    id,
    keyword: 'pond care',
    intent: 'informational',
    keywords: [{ keyword: 'pond care' }],
    questions: [],
    opportunity: { angle: 'Winter', reason: 'Readers ask', organic: [] },
  }))
  vi.stubGlobal('reservedPlanTopic', reservedTopic)
  const { processClient } = await import('../../../server/tasks/generate-article')
  return {
    run: () => processClient(client as never, options.slot ?? new Date('2020-01-01T12:00:00Z'), options.request),
    log,
    transaction,
    reservation,
    writer,
    createArticle,
    notifyHeld,
    linkCluster,
    linkBatchItem,
    reservedTopic,
  }
}

describe('generation client', () => {
  it('loads the saved quality, or the autopilot would always write and charge Standard', async () => {
    await setup()
    const findFirst = vi.fn().mockResolvedValue(null)
    vi.stubGlobal('prisma', { clientSite: { findFirst } })
    const { loadGenerationClient } = await import('../../../server/tasks/generate-article')
    await loadGenerationClient('tenant-1')
    expect(findFirst.mock.calls[0]![0].select).toMatchObject({ articleQuality: true })
  })
})

describe('article batch items', () => {
  const batchItem = (overrides = {}) => ({
    topic: 'Pond care in winter',
    batchItem: {
      id: 'item-1',
      attempts: 1,
      creditKey: 'article-batch:item-1:1',
      keywordClusterId: null,
      autoRelease: false,
      plannedTopics: ['Pond care in spring'],
      stillActive: async () => true,
      ...overrides,
    },
  })
  const blocking = { code: 'missing_specifics', note: 'Name a change.', blocking: true }
  const future = new Date(Date.now() + 60 * 60_000)

  it('writes the fixed topic under its own credit key and tells the picker about its siblings', async () => {
    const { run, reservation, writer } = await setup(undefined, null, 'STANDARD', { request: batchItem() })
    await expect(run()).resolves.toMatchObject({ status: 'draft' })
    expect(reservation.mock.calls[0]![3].key).toBe('article-batch:item-1:1')
    expect(reservation.mock.calls[0]![3].metadata).toMatchObject({ articleBatchItemId: 'item-1' })
    expect(pickArticleTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        requested: expect.objectContaining({ topic: 'Pond care in winter' }),
        plannedTopics: ['Pond care in spring'],
      }),
    )
    expect(writer).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(String),
      expect.objectContaining({ requireClearRights: true }),
    )
  })

  it('explains a held draft without an email per article', async () => {
    const { run, createArticle, notifyHeld } = await setup(undefined, null, 'STANDARD', {
      request: batchItem(),
      editorialReview: { approved: false, issues: [blocking] },
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({
      status: 'draft',
      releaseAt: null,
      releaseHold: { reasons: ['review'] },
    })
    expect(notifyHeld).not.toHaveBeenCalled()
  })

  it('never releases a draft batch item, even on a site with auto-release', async () => {
    const { run, createArticle } = await setup(undefined, null, 'STANDARD', {
      autoRelease: true,
      request: batchItem(),
      slot: future,
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({ status: 'draft', releaseAt: null })
  })

  it('schedules an approved spread item for its slot, on a site without auto-release too', async () => {
    const { run, createArticle } = await setup(undefined, null, 'STANDARD', {
      autoRelease: false,
      request: batchItem({ autoRelease: true }),
      slot: future,
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({ status: 'draft', releaseAt: future })
  })

  it('finishes a spread item as a draft when its plan was cancelled during the run', async () => {
    const { run, createArticle } = await setup(undefined, null, 'STANDARD', {
      request: batchItem({ autoRelease: true, stillActive: async () => false }),
      slot: future,
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({ status: 'draft', releaseAt: null })
  })

  it('saves the article and its item link in one transaction, so a dead worker leaves proof', async () => {
    const { run, linkBatchItem } = await setup(undefined, null, 'STANDARD', { request: batchItem() })
    await run()
    expect(linkBatchItem).toHaveBeenCalledWith({
      where: {
        id: 'item-1',
        clientSiteId: 'tenant-1',
        status: 'RUNNING',
        attempts: 1,
        articleId: null,
        leaseUntil: { gt: expect.any(Date) },
      },
      data: { articleId: 'article-1' },
    })
  })

  it('rolls back persistence when a replacement attempt already owns the item', async () => {
    const { run, linkBatchItem, transaction } = await setup(undefined, null, 'STANDARD', { request: batchItem() })
    linkBatchItem.mockResolvedValueOnce({ count: 0 })
    let rolledBack = false
    const transact = transaction.getMockImplementation()!
    transaction.mockImplementation(async (callback) => {
      try {
        return await transact(callback)
      } catch (error) {
        rolledBack = true
        throw error
      }
    })
    await expect(run()).resolves.toMatchObject({ status: 'failed' })
    expect(rolledBack).toBe(true)
    expect(invalidateFeed).not.toHaveBeenCalled()
  })

  it('holds a spread item that fails review and tells someone the same day', async () => {
    const { run, createArticle, notifyHeld } = await setup(undefined, null, 'STANDARD', {
      request: batchItem({ autoRelease: true }),
      slot: future,
      editorialReview: { approved: false, issues: [blocking] },
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({ status: 'draft', releaseAt: null })
    expect(notifyHeld).toHaveBeenCalled()
  })

  it('links the reserved topic and does not touch the rest of the plan', async () => {
    const { run, linkCluster, reservedTopic } = await setup(undefined, null, 'STANDARD', {
      request: batchItem({ keywordClusterId: 'cluster-1' }),
    })
    await run()
    expect(reservedTopic).toHaveBeenCalledWith('cluster-1', 'tenant-1')
    expect(linkCluster).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cluster-1', clientSiteId: 'tenant-1', status: { in: ['OPEN', 'PINNED', 'RESERVED'] } },
        data: expect.objectContaining({ status: 'USED', articleId: 'article-1' }),
      }),
    )
  })

  it('offers no plan topics to an item without one, so it cannot consume another topic', async () => {
    const { run, linkCluster } = await setup(undefined, null, 'STANDARD', { request: batchItem() })
    vi.mocked(pickArticleTopic).mockResolvedValue({
      topic: { topic: 'A topic', angle: 'Advice', format: 'guide', needsResearch: false, planKeyword: 'pond care' },
      usage: { totalTokens: 3 },
    } as never)
    await run()
    expect(linkCluster).not.toHaveBeenCalled()
    expect(pickArticleTopic).toHaveBeenCalledWith(expect.objectContaining({ plan: [] }))
  })

  it('marks a run that hit the cost guard as worth waiting for', async () => {
    const error = Object.assign(new Error('AI allowance exhausted'), { data: { code: 'AI_ALLOWANCE_EXHAUSTED' } })
    const { run } = await setup(undefined, null, 'STANDARD', { request: batchItem(), writerError: error })
    await expect(run()).resolves.toMatchObject({ status: 'failed', pauseReason: 'allowance' })
  })

  it('marks a run without credits as worth waiting for', async () => {
    const error = Object.assign(new Error('Insufficient article credits'), { statusCode: 402 })
    const { run } = await setup(undefined, null, 'STANDARD', { request: batchItem(), reservationError: error })
    await expect(run()).resolves.toMatchObject({ status: 'failed', pauseReason: 'credits' })
  })

  it('does not wait for an ordinary failure', async () => {
    const { run } = await setup('generation', null, 'STANDARD', { request: batchItem() })
    await expect(run()).resolves.toMatchObject({ status: 'failed', pauseReason: null })
  })
})

describe('autopilot release hold', () => {
  const blocking = { code: 'missing_specifics', note: 'Name at least one change the title promises.', blocking: true }
  const tip = { code: 'hedging', note: 'Delete the advice to check elsewhere.', blocking: false }

  it('keeps a held article as a draft that names the blocking findings', async () => {
    const { run, createArticle, writer, notifyHeld } = await setup(undefined, null, 'STANDARD', {
      autoRelease: true,
      editorialReview: { approved: false, issues: [blocking, tip] },
    })
    await expect(run()).resolves.toMatchObject({ status: 'draft' })
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({
      status: 'draft',
      releaseHold: { reasons: ['review'], issues: [{ code: blocking.code, note: blocking.note }] },
    })
    expect(notifyHeld).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ id: 'article-1' }))
    // Review notes are written in the site's interface language.
    expect(writer).toHaveBeenCalledWith('tenant-1', expect.any(String), expect.objectContaining({ noteLanguage: 'cs' }))
  })

  it('publishes an approved article despite non-blocking tips', async () => {
    const { run, createArticle, notifyHeld } = await setup(undefined, null, 'STANDARD', {
      autoRelease: true,
      editorialReview: { approved: true, issues: [tip] },
    })
    await run()
    expect(notifyHeld).not.toHaveBeenCalled()
    expect(createArticle.mock.calls[0]![0].data).toMatchObject({ status: 'published', releaseHold: undefined })
  })

  it('records no hold when the autopilot is not publishing', async () => {
    const { run, createArticle } = await setup(undefined, null, 'STANDARD', {
      editorialReview: { approved: false, issues: [blocking] },
    })
    await run()
    expect(createArticle.mock.calls[0]![0].data.releaseHold).toBeUndefined()
  })
})

describe('scheduled generation audit', () => {
  it('uses the last validated community suggestion retained by a failed historical insight refresh', async () => {
    const insight = {
      summary: 'Readers ask practical questions.',
      avgScore: 0,
      topEmotion: null,
      toxicity: 0,
      helpfulness: 0,
      sarcasm: 0,
      suggestion: 'Explain the setup for beginners.',
    }
    const { run } = await setup(undefined, { error: true, message: 'Previous refresh failed', previous: insight })
    await expect(run()).resolves.toMatchObject({ status: 'draft' })
    expect(pickArticleTopic).toHaveBeenCalledWith(expect.objectContaining({ suggestion: insight.suggestion }))
  })

  it('excludes malformed stored community JSON from the topic prompt', async () => {
    const { run } = await setup(undefined, { suggestion: { privateError: 'This is not a suggestion.' } })
    await expect(run()).resolves.toMatchObject({ status: 'draft' })
    expect(pickArticleTopic).toHaveBeenCalledWith(expect.objectContaining({ suggestion: undefined }))
  })

  it.each([
    ['STANDARD', 'gpt-6-luna', 1],
    ['HIGH', 'gpt-6.1-terra', 2],
    ['ULTRA', 'gpt-6.1-sol', 3],
  ] as const)(
    'uses the editorial author and saved %s quality for a scheduled article',
    async (quality, writerModel, amount) => {
      const { run, writer, createArticle, reservation } = await setup(undefined, null, quality)
      await expect(run()).resolves.toMatchObject({ status: 'draft', articleId: 'article-1' })
      expect(writer).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        expect.objectContaining({ articleQuality: quality }),
      )
      expect(createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'editorial-ai' }) }),
      )
      expect(reservation.mock.calls[0]?.[3].metadata).toMatchObject({
        articleQuality: quality,
        writerModel,
        writerEffort: 'high',
        creditsRequired: amount,
      })
      expect(reservation.mock.calls[0]?.[3].amount).toBe(amount)
    },
  )

  it('does not invoke a paid writer when the editorial author cannot be resolved', async () => {
    const { run, writer } = await setup('author')
    expect(await run()).toMatchObject({ status: 'failed', stage: 'author' })
    expect(writer).not.toHaveBeenCalled()
  })
  it('correlates reservation, topic, persistence, delivery and settlement with one attempt', async () => {
    const { run, log, reservation } = await setup()
    await expect(run()).resolves.toMatchObject({ status: 'draft', articleId: 'article-1' })
    const entries = log.mock.calls.map(([entry]) => entry)
    const started = entries.find((entry) => entry.action === 'CRON_GENERATION_STARTED')
    expect(
      entries
        .filter((entry) => entry.action === 'ARTICLE_GENERATION_STEP_COMPLETED')
        .map((entry) => entry.metadata.stage),
    ).toEqual(['reservation', 'topic', 'publication', 'persistence', 'publication', 'settlement'])
    expect(
      entries
        .filter((entry) => entry.metadata?.attemptId)
        .every((entry) => entry.metadata.attemptId === started.metadata.attemptId),
    ).toBe(true)
    expect(
      entries.find(
        (entry) => entry.action === 'ARTICLE_GENERATION_STEP_COMPLETED' && entry.metadata.stage === 'persistence',
      ).metadata.articleId,
    ).toBe('article-1')
    expect(entries.find((entry) => entry.action === 'CRON_GENERATION_COMPLETED').metadata).toMatchObject({
      articleId: 'article-1',
      mode: 'scheduled',
    })
    expect(reservation.mock.calls[0]![3].metadata).toMatchObject({ attemptId: started.metadata.attemptId })
  })

  it.each(['reservation', 'generation', 'persistence', 'publication', 'settlement'] as const)(
    'records a terminal failure during %s without reporting completion',
    async (stage) => {
      const { run, log } = await setup(stage)
      await expect(run()).resolves.toMatchObject({ status: 'failed', stage })
      const entries = log.mock.calls.map(([entry]) => entry)
      const failure = entries.find((entry) => entry.action === 'CRON_GENERATE_ARTICLE_FAILED')
      expect(failure.metadata).toMatchObject({ stage, attemptId: expect.any(String) })
      if (stage === 'publication' || stage === 'settlement') expect(failure.metadata.articleId).toBe('article-1')
      expect(entries.some((entry) => entry.action === 'CRON_GENERATION_COMPLETED')).toBe(false)
    },
  )
})

beforeEach(stubImports)
