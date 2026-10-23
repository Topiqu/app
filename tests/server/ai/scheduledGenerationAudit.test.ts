import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../server/utils/keywords/plan', () => ({
  keywordPlanFor: async () => [],
  planSignal: vi.fn(),
  sameKeyword: vi.fn(),
  themeKey: (value?: string | null) => value?.trim().toLocaleLowerCase() || null,
  themeOf: () => null,
}))
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ hasDataForSeo: () => false }))

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const setup = async (
  failure?: 'reservation' | 'author' | 'generation' | 'persistence' | 'publication' | 'settlement',
  articleQuality = 'STANDARD',
) => {
  const log = vi.fn().mockResolvedValue({})
  const client = {
    id: 'tenant-1',
    language: 'cs',
    articles: [],
    users: [{ id: 'author-1' }],
    keywords: [],
    autoRelease: failure === 'publication',
    publishToWeb: true,
    aiSeriesEnabled: false,
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
    editorialReview: { approved: true },
    research: { status: 'skipped' },
    usage: { totalTokens: 42 },
  }
  const createArticle = vi.fn(async ({ data }) => ({ ...data, id: 'article-1', user: { role: 'ai' } }))
  const transaction = vi.fn(async (run) => {
    if (failure === 'persistence') throw new Error('Article persistence failed')
    return run({
      article: {
        findMany: async () => [],
        create: createArticle,
      },
      articleTag: { createMany: async () => ({ count: 0 }) },
      mediaRightsPublicationSnapshot: { create: async () => ({}) },
    })
  })
  const reservation = vi.fn(async (_tenant, _action, run, _options) => {
    if (failure === 'reservation') throw new Error('No article credits')
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
  vi.stubGlobal('pickArticleTopic', async () => ({
    topic: { topic: 'A topic', angle: 'Practical advice', format: 'guide', needsResearch: false },
    usage: { totalTokens: 3 },
  }))
  vi.stubGlobal('selectedModulesFor', () => [])
  vi.stubGlobal('researchRequest', () => false)
  const writer = vi.fn(async () => {
    if (failure === 'generation') throw new Error('Writer unavailable')
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
  vi.stubGlobal('stampHeadingIds', (html: string) => html)
  vi.stubGlobal('syncArticlePolls', async (_db, _id, content) => content)
  vi.stubGlobal('syncArticleTranslationQueue', async () => {
    if (failure === 'publication') throw new Error('Publication failed')
  })
  vi.stubGlobal('invalidateFeed', vi.fn())
  const { processClient } = await import('../../../server/tasks/generate-article')
  return {
    run: () => processClient(client, new Date('2020-01-01T12:00:00Z')),
    log,
    transaction,
    reservation,
    writer,
    createArticle,
  }
}

describe('scheduled generation audit', () => {
  it.each([
    ['STANDARD', 'high', 1],
    ['HIGH', 'xhigh', 2],
    ['ULTRA', 'max', 3],
  ] as const)(
    'uses the editorial author and saved %s quality for a scheduled article',
    async (quality, effort, amount) => {
      const { run, writer, createArticle, reservation } = await setup(undefined, quality)
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
        writerModel: 'gpt-6-luna',
        writerEffort: effort,
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
