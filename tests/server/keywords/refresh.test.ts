import { load } from 'cheerio'
import { createError } from 'h3'
import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DatabaseClient } from '../../../server/utils/database'

import { sanitizeHtml } from '../../../server/utils/sanitize'
import { keywordLocation } from '../../../shared/utils/keywordPlan'
import { stampHeadingIds } from '../../../server/utils/articleBlocks'
import { calculateArticleMetrics } from '../../../server/utils/metrics'

const providers = vi.hoisted(() => ({ dataForSeo: vi.fn(), researchTopic: vi.fn() }))
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo: providers.dataForSeo }))
vi.mock('../../../server/utils/ai/researchEvidence', () => ({ researchTopic: providers.researchTopic }))
vi.mock('ai', async (original) => ({ ...(await original<typeof import('ai')>()), generateText: vi.fn() }))

const {
  applyContentAction,
  applySectionEdits,
  articleHash,
  articleSections,
  changeRatio,
  dismissContentAction,
  draftContentEdit,
  measureApplied,
  measureContentActions,
  processQueuedActions,
  queueContentAction,
  refreshAllowance,
  refreshesThisMonth,
  rollbackContentAction,
  suggestExpansions,
  suggestRefresh,
} = await import('../../../server/utils/keywords/refresh')

const NOW = new Date('2026-10-04T12:00:00Z')
const DAY = 86_400_000
const old = (days: number) => new Date(NOW.getTime() - days * DAY)
const text = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(' ')
const original = {
  title: 'Káva doma',
  excerpt: 'Praktický průvodce.',
  language: 'cs' as const,
  content: [1, 2, 3, 4].map((n) => `<h2>Část ${n}</h2><p>${text(`part${n}-`, 100)}</p>`).join(''),
}
const edit = { op: 'replace' as const, target: 'cast-1', heading: 'Lepší příprava', html: `<p>${text('new-', 45)}</p>` }
const modelOutput = { summary: ['Doplnění postupu.'], title: '', excerpt: '', edits: [edit] }
const action = {
  id: 'action1',
  clientSiteId: 'site1',
  status: 'SUGGESTED',
  type: 'REFRESH' as const,
  keyword: 'káva doma',
  angle: null,
}
const operation = { id: 'credit1', clientSiteId: 'site1' }
const prepared = {
  ...original,
  title: 'Lepší káva doma',
  content: stampHeadingIds(
    `<h2>${edit.heading}</h2>${edit.html}${[2, 3, 4].map((n) => `<h2>Část ${n}</h2><p>${text(`part${n}-`, 100)}</p>`).join('')}`,
  ),
  baseHash: articleHash(original),
}
const snapshot = {
  title: original.title,
  excerpt: original.excerpt,
  content: original.content,
  totalWords: 400,
  readingTime: 2,
  sources: ['https://example.com/original'],
  savedAmount: 20,
  savedTimeMinutes: 60,
}

const makeDb = () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'site1' }]),
    contentAction: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    article: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    articleCreditOperation: { findFirst: vi.fn().mockResolvedValue({ id: 'credit1' }) },
    keywordCluster: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  const db = {
    $transaction: vi.fn(async (work: (db: typeof tx) => Promise<unknown>) => work(tx)),
    contentAction: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'action1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirstOrThrow: vi.fn().mockResolvedValue({
        articleId: 'article1',
        article: { ...snapshot, status: 'published' },
        clientSite: { humanHourlyRateUsd: 20, humanWordsPerHour: 400 },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    articleCreditOperation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  return { db, tx, scoped: db as unknown as DatabaseClient }
}
let mocks: ReturnType<typeof makeDb>
let reserve: ReturnType<typeof vi.fn>
let settle: ReturnType<typeof vi.fn>
let usage: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetAllMocks()
  mocks = makeDb()
  reserve = vi.fn().mockResolvedValue(operation)
  settle = vi.fn().mockResolvedValue({ available: 4 })
  usage = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('prisma', mocks.db)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('sanitizeHtml', sanitizeHtml)
  vi.stubGlobal('stampHeadingIds', stampHeadingIds)
  vi.stubGlobal('calculateArticleMetrics', calculateArticleMetrics)
  vi.stubGlobal('reserveArticleCredit', reserve)
  vi.stubGlobal('settleArticleCredit', settle)
  vi.stubGlobal('recordAiUsage', usage)
  vi.stubGlobal('aiModel', (task: string) => task)
  vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('syncArticleTranslationQueue', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('invalidateFeed', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('enqueueArticleWebhook', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('announceArticle', vi.fn().mockResolvedValue(undefined))
  providers.dataForSeo.mockResolvedValue({
    cost: 0.002,
    result: {
      items: [{ type: 'organic', title: 'Postup přípravy', url: 'https://example.com/coffee', domain: 'example.com' }],
    },
  })
  providers.researchTopic.mockResolvedValue({
    brief: 'Ověřený postup https://example.com/research',
    sources: ['https://example.com/research'],
    tokens: 80,
  })
  vi.mocked(generateText).mockResolvedValue({ output: modelOutput, usage: { totalTokens: 120 } } as never)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('section edits', () => {
  it('replaces one section and preserves the introduction and other sections', () => {
    const content = applySectionEdits(`<p>Úvod.</p>${original.content}`, [edit])
    const $ = load(content)
    expect(
      $('h2')
        .map((_, el) => $(el).text())
        .get(),
    ).toEqual(['Lepší příprava', 'Část 2', 'Část 3', 'Část 4'])
    expect(content).toContain('Úvod.')
    expect(content).toContain(text('part2-', 100))
    expect(content).not.toContain('part1-0')
    expect(articleSections(content)[0]?.id).toBe('lepsi-priprava')
  })
  it('inserts after a whole section and appends to an article without headings', () => {
    const content = applySectionEdits(original.content, [{ ...edit, op: 'insert_after' }])
    expect(articleSections(content).map((section) => section.heading)).toEqual([
      'Část 1',
      'Lepší příprava',
      'Část 2',
      'Část 3',
      'Část 4',
    ])
    expect(applySectionEdits('<p>Úvod.</p>', [{ ...edit, op: 'insert_after', target: 'end' }])).toContain(
      'Lepší příprava',
    )
  })
  it('keeps existing media and polls when replacing their section', () => {
    const content = applySectionEdits(
      `<h2>Část 1</h2><p>Old text.</p><figure><img src="/coffee.jpg"><figcaption>Autor fotografie</figcaption></figure><div data-poll-id="poll1">Poll</div><h2>Část 2</h2><p>Keep.</p>`,
      [edit],
    )
    const $ = load(content)
    expect($('img')).toHaveLength(1)
    expect($('figure').text()).toBe('Autor fotografie')
    expect($('[data-poll-id="poll1"]')).toHaveLength(1)
    expect(articleSections(content).map((section) => section.heading)).toEqual(['Lepší příprava', 'Část 2'])
  })
  it('rejects an unknown or repeated target and nested section headings', () => {
    expect(() => applySectionEdits(original.content, [{ ...edit, target: 'missing' }])).toThrow('Unknown section')
    expect(() => applySectionEdits(original.content, [edit, edit])).toThrow('Repeated section')
    expect(() => applySectionEdits(original.content, [{ ...edit, html: '<h2>Další</h2><p>Body</p>' }])).toThrow(
      'section body',
    )
  })
  it('sanitizes generated markup and escapes the heading', () => {
    const content = applySectionEdits(original.content, [
      {
        ...edit,
        heading: '<script>bad</script>',
        html: '<script>alert(1)</script><p onclick="bad()">Safe <a href="javascript:bad()">link</a></p>',
      },
    ])
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('onclick')
    expect(content).not.toContain('javascript:')
    expect(content).toContain('&lt;script&gt;')
  })
  it('counts deletions as changes and limits repeated word occurrences', () => {
    expect(changeRatio('<p>a b c d e</p>', '<p>a b</p>')).toBeCloseTo(0.6)
    expect(changeRatio('<p>a a b</p>', '<p>a a a a b</p>')).toBeCloseTo(0.4)
    expect(changeRatio('<p>a b</p>', '')).toBe(1)
    expect(changeRatio(original.content, original.content)).toBe(0)
  })
})

describe('suggestions', () => {
  const cluster = { id: 'cluster1', clientSiteId: 'site1', keyword: 'káva doma', articleId: 'article1' }
  it('suggests a settled article only after two positions between 8 and 20', async () => {
    await suggestRefresh(cluster, [9, 12], old(30), NOW)
    expect(mocks.db.contentAction.create).toHaveBeenCalledWith({
      data: {
        clientSiteId: 'site1',
        articleId: 'article1',
        keywordClusterId: 'cluster1',
        type: 'REFRESH',
        keyword: 'káva doma',
        positionBefore: 12,
      },
    })
  })
  it.each([[9], [7, 9], [9, 21], [null, 9]].map((positions) => [positions]))(
    'does not suggest insufficient or unsuitable readings %j',
    async (positions) => {
      await expect(suggestRefresh(cluster, positions, old(60), NOW)).resolves.toBeNull()
      expect(mocks.db.contentAction.create).not.toHaveBeenCalled()
    },
  )
  it('does not disturb a new article, an open suggestion or a recently dismissed one', async () => {
    await expect(suggestRefresh(cluster, [9, 12], old(29), NOW)).resolves.toBeNull()
    mocks.db.contentAction.count.mockResolvedValue(1)
    await expect(suggestRefresh(cluster, [9, 12], old(60), NOW)).resolves.toBeNull()
    expect(mocks.db.contentAction.count.mock.calls[0]![0].where.OR).toContainEqual({ createdAt: { gte: old(60) } })
    expect(mocks.db.contentAction.create).not.toHaveBeenCalled()
  })
  it('creates an expansion for its covering article and skips a duplicate', async () => {
    mocks.db.contentAction.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    const expansion = {
      articleId: 'article1',
      keyword: 'kyselé espresso',
      angle: 'Jak upravit mletí',
      reason: 'Chybí konkrétní postup.',
    }
    expect(await suggestExpansions('site1', [expansion, expansion], NOW)).toBe(1)
    expect(mocks.db.contentAction.create).toHaveBeenCalledWith({
      data: { clientSiteId: 'site1', type: 'EXPAND', ...expansion },
    })
  })
})

describe('credit reservation and limits', () => {
  it('allows Premium 25 preparations monthly and Custom 15', () => {
    expect(refreshAllowance('PREMIUM')).toEqual({ allowed: true, monthly: 25 })
    expect(refreshAllowance('CUSTOM')).toEqual({ allowed: true, monthly: 15 })
    expect(refreshAllowance('PRO')).toEqual({ allowed: false, monthly: 0 })
  })
  it('queues a suggestion with a reserved credit under a tenant lock', async () => {
    await queueContentAction(mocks.scoped, action, 'PREMIUM', NOW)
    expect(reserve).toHaveBeenCalledWith('site1', 'CONTENT_REFRESH', expect.any(String), { contentActionId: 'action1' })
    expect(mocks.tx.$queryRaw).toHaveBeenCalled()
    expect(mocks.tx.contentAction.updateMany).toHaveBeenCalledWith({
      where: { id: 'action1', clientSiteId: 'site1', status: { in: ['SUGGESTED', 'FAILED'] } },
      data: { status: 'QUEUED', queuedAt: NOW, processingUntil: null, creditOperationId: 'credit1', error: null },
    })
    expect(settle).not.toHaveBeenCalled()
  })
  it('rejects a plan or state that cannot prepare before reserving', async () => {
    await expect(queueContentAction(mocks.scoped, action, 'PRO', NOW)).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      queueContentAction(mocks.scoped, { ...action, status: 'READY' }, 'PREMIUM', NOW),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(reserve).not.toHaveBeenCalled()
  })
  it('checks the allowance again while holding the lock and releases a losing reservation', async () => {
    mocks.tx.contentAction.count.mockResolvedValue(25)
    await expect(queueContentAction(mocks.scoped, action, 'PREMIUM', NOW)).rejects.toMatchObject({ statusCode: 429 })
    expect(settle).toHaveBeenCalledWith(operation, false, { contentActionId: 'action1' })
  })
  it.each(['conflict', 'database failure'])('returns the credit after %s while queuing', async (failure) => {
    if (failure === 'conflict') mocks.tx.contentAction.updateMany.mockResolvedValue({ count: 0 })
    else mocks.tx.contentAction.updateMany.mockRejectedValue(new Error('database failure'))
    await expect(queueContentAction(mocks.scoped, action, 'PREMIUM', NOW)).rejects.toThrow()
    expect(settle).toHaveBeenCalledWith(operation, false, { contentActionId: 'action1' })
  })
  it('does not count refunded failures or move an allowance into another month with a worker lease', async () => {
    await refreshesThisMonth('site1', NOW, mocks.scoped)
    expect(mocks.db.contentAction.count).toHaveBeenCalledWith({
      where: {
        clientSiteId: 'site1',
        creditOperationId: { not: null },
        queuedAt: { gte: new Date('2026-10-01T00:00:00Z') },
        status: { in: ['QUEUED', 'READY', 'APPLIED', 'DISMISSED', 'ROLLED_BACK'] },
      },
    })
  })
})

describe('grounded preparation', () => {
  it('uses current search results and research, keeps unedited sections and fingerprints all written fields', async () => {
    const result = await draftContentEdit(action, original, keywordLocation('cs', null))
    expect(result.tokens).toBe(200)
    expect(result.proposal).toMatchObject({
      title: original.title,
      excerpt: original.excerpt,
      baseHash: articleHash(original),
      sources: ['https://example.com/research'],
    })
    expect(result.proposal.content).toContain(text('part2-', 100))
    expect(vi.mocked(generateText).mock.calls[0]![0].prompt).toContain('Ověřený postup')
    expect(providers.researchTopic).toHaveBeenCalledWith('káva doma', 'standard', false)
  })
  it('refuses missing SERP or unsupported research before writing', async () => {
    providers.dataForSeo.mockResolvedValueOnce({ cost: 0.002, result: { items: [] } })
    await expect(draftContentEdit(action, original, keywordLocation('cs', null))).rejects.toThrow('search results')
    providers.researchTopic.mockResolvedValueOnce({ brief: null, sources: [], tokens: 0 })
    await expect(draftContentEdit(action, original, keywordLocation('cs', null))).rejects.toThrow('supported research')
    expect(generateText).not.toHaveBeenCalled()
  })
  it('refuses an edit deleting most of the existing article', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      output: { ...modelOutput, edits: [1, 2, 3].map((n) => ({ ...edit, target: `cast-${n}` })) },
      usage: {},
    } as never)
    await expect(draftContentEdit(action, original, keywordLocation('cs', null))).rejects.toThrow('rewrote')
  })
  it('returns no proposal for an edit that leaves the page unchanged', async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      output: { ...modelOutput, edits: [{ ...edit, heading: 'Část 1', html: `<p>${text('part1-', 100)}</p>` }] },
      usage: {},
    } as never)
    await expect(draftContentEdit(action, original, keywordLocation('cs', null))).rejects.toThrow('does not improve')
  })
})

describe('queued worker', () => {
  const queued = () => ({
    ...action,
    status: 'QUEUED',
    queuedAt: NOW,
    processingUntil: null,
    creditOperationId: 'credit1',
    article: { ...original, status: 'published' },
    clientSite: { language: 'cs', keywordMarket: null },
  })
  it('charges a prepared proposal in the same transaction that marks it ready', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([queued()])
    expect(await processQueuedActions(NOW)).toEqual({ ready: 1, failed: 0 })
    expect(mocks.tx.contentAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'READY', processingUntil: null }) }),
    )
    expect(settle).toHaveBeenCalledExactlyOnceWith(operation, true, { contentActionId: 'action1' }, mocks.tx)
    expect(mocks.db.contentAction.updateMany.mock.calls[0]![0].data).not.toHaveProperty('queuedAt')
  })
  it('refunds a provider failure and leaves the article untouched', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([queued()])
    providers.dataForSeo.mockRejectedValue(new Error('provider down'))
    expect(await processQueuedActions(NOW)).toEqual({ ready: 0, failed: 1 })
    expect(settle).toHaveBeenCalledExactlyOnceWith(
      operation,
      false,
      { contentActionId: 'action1', error: 'provider down' },
      mocks.tx,
    )
    expect(mocks.tx.article.updateMany).not.toHaveBeenCalled()
  })
  it('does not spend on an expired reservation or a claim taken by another worker', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([queued()])
    mocks.db.articleCreditOperation.updateMany.mockResolvedValue({ count: 0 })
    expect(await processQueuedActions(NOW)).toEqual({ ready: 0, failed: 1 })
    expect(providers.dataForSeo).not.toHaveBeenCalled()
    mocks.db.contentAction.updateMany.mockResolvedValue({ count: 0 })
    expect(await processQueuedActions(NOW)).toEqual({ ready: 0, failed: 0 })
    expect(providers.dataForSeo).not.toHaveBeenCalled()
  })
  it('keeps the ready status when usage logging fails after charging', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.db.contentAction.findMany.mockResolvedValue([queued()])
    usage.mockRejectedValue(new Error('log unavailable'))
    expect(await processQueuedActions(NOW)).toEqual({ ready: 1, failed: 0 })
    expect(settle).toHaveBeenCalledTimes(1)
    expect(mocks.tx.contentAction.updateMany).toHaveBeenCalledTimes(1)
  })
  it('cannot refund or replace the proposal after losing its lease', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([queued()])
    mocks.tx.contentAction.updateMany.mockResolvedValue({ count: 0 })
    expect(await processQueuedActions(NOW)).toEqual({ ready: 0, failed: 0 })
    expect(settle).not.toHaveBeenCalled()
  })
})

describe('apply and rollback', () => {
  it('applies once, saves a rollback snapshot and schedules measurement', async () => {
    await applyContentAction(mocks.scoped, { ...action, status: 'READY', proposal: prepared }, 'user1', NOW)
    expect(mocks.tx.contentAction.updateMany).toHaveBeenCalledWith({
      where: { id: 'action1', clientSiteId: 'site1', status: 'READY' },
      data: { status: 'APPLIED', appliedAt: NOW, snapshot },
    })
    expect(mocks.tx.article.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: original.title,
          excerpt: original.excerpt,
          content: original.content,
          status: 'published',
        }),
        data: expect.objectContaining({ title: prepared.title, content: prepared.content }),
      }),
    )
    expect(mocks.tx.keywordCluster.updateMany).toHaveBeenCalledWith({
      where: { articleId: 'article1', status: 'USED' },
      data: { nextRankCheckAt: new Date(NOW.getTime() + 30 * DAY) },
    })
    expect(enqueueArticleWebhook).toHaveBeenCalledWith('ARTICLE_UPDATED', { id: 'article1', clientSiteId: 'site1' })
  })
  it.each(['title', 'excerpt', 'content'])('protects a manually changed %s', async (field) => {
    mocks.db.contentAction.findFirstOrThrow.mockResolvedValue({
      articleId: 'article1',
      article: { ...snapshot, [field]: 'Manual change', status: 'published' },
      clientSite: {},
    })
    await expect(
      applyContentAction(mocks.scoped, { ...action, status: 'READY', proposal: prepared }, 'user1'),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })
  it('refuses a change arriving between the read and the transaction', async () => {
    mocks.tx.article.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      applyContentAction(mocks.scoped, { ...action, status: 'READY', proposal: prepared }, 'user1'),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(enqueueArticleWebhook).not.toHaveBeenCalled()
  })
  it('rolls back the complete saved article when the proposed version is still current', async () => {
    mocks.db.contentAction.findFirstOrThrow.mockResolvedValue({
      articleId: 'article1',
      article: { ...prepared, sources: snapshot.sources, status: 'published' },
    })
    await rollbackContentAction(mocks.scoped, { ...action, status: 'APPLIED', proposal: prepared, snapshot }, 'user1')
    expect(mocks.tx.article.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...snapshot, contentUpdatedAt: expect.any(Date) } }),
    )
    expect(mocks.tx.contentAction.updateMany).toHaveBeenCalledWith({
      where: { id: 'action1', clientSiteId: 'site1', status: 'APPLIED' },
      data: { status: 'ROLLED_BACK' },
    })
  })
  it.each(['title', 'excerpt', 'content'])('does not roll back a subsequent manual %s edit', async (field) => {
    mocks.db.contentAction.findFirstOrThrow.mockResolvedValue({
      articleId: 'article1',
      article: { ...prepared, [field]: 'Manual change', status: 'published' },
    })
    await expect(
      rollbackContentAction(mocks.scoped, { ...action, status: 'APPLIED', proposal: prepared, snapshot }, 'user1'),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })
  it('preserves a source the editor added after applying an update', async () => {
    mocks.db.contentAction.findFirstOrThrow.mockResolvedValue({
      articleId: 'article1',
      article: { ...prepared, sources: [...snapshot.sources, 'https://example.com/manual'], status: 'published' },
    })
    await expect(
      rollbackContentAction(mocks.scoped, { ...action, status: 'APPLIED', proposal: prepared, snapshot }, 'user1'),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })
  it('does not dismiss a queued action that still owns a credit', async () => {
    mocks.db.contentAction.updateMany.mockResolvedValue({ count: 0 })
    await expect(dismissContentAction(mocks.scoped, { ...action, status: 'QUEUED' })).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(settle).not.toHaveBeenCalled()
  })
  it('measures only applied edits older than a month and records a missing rank explicitly', async () => {
    await measureApplied('article1', 'káva doma', null, NOW)
    expect(mocks.db.contentAction.updateMany).toHaveBeenCalledWith({
      where: {
        articleId: 'article1',
        keyword: 'káva doma',
        status: 'APPLIED',
        measuredAt: null,
        appliedAt: { lte: old(30) },
      },
      data: { positionAfter: null, measuredAt: NOW, processingUntil: null },
    })
  })
})

describe('measurement without a keyword plan cluster', () => {
  const due = {
    ...action,
    processingUntil: null,
    article: { language: 'cs', slug: 'a' },
    clientSite: { domain: 'kava.cz', language: 'cs', keywordMarket: null },
  }
  it('measures the actual edited page for the action query even when another page ranks better', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([due])
    providers.dataForSeo.mockResolvedValue({
      cost: 0.006,
      result: {
        items: [
          { type: 'organic', rank_group: 4, domain: 'kava.cz', url: 'https://kava.cz/cs/clanky/other' },
          { type: 'organic', rank_group: 7, domain: 'kava.cz', url: 'https://kava.cz/cs/clanky/a' },
        ],
      },
    })
    expect(await measureContentActions(NOW)).toEqual({ measured: 1, failed: 0, costUsd: 0.006 })
    expect(mocks.db.contentAction.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { positionAfter: 7, measuredAt: NOW, processingUntil: null } }),
    )
  })
  it('reports a missing page and retries provider failures tomorrow', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.db.contentAction.findMany.mockResolvedValue([due])
    expect(await measureContentActions(NOW)).toMatchObject({ measured: 1 })
    expect(mocks.db.contentAction.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ positionAfter: null, measuredAt: NOW }) }),
    )
    providers.dataForSeo.mockRejectedValue(new Error('provider down'))
    expect(await measureContentActions(NOW)).toMatchObject({ measured: 0, failed: 1 })
    expect(mocks.db.contentAction.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { processingUntil: new Date(NOW.getTime() + DAY) } }),
    )
  })
  it('does not pay for a reading another worker already claimed', async () => {
    mocks.db.contentAction.findMany.mockResolvedValue([due])
    mocks.db.contentAction.updateMany.mockResolvedValue({ count: 0 })
    expect(await measureContentActions(NOW)).toEqual({ measured: 0, failed: 0, costUsd: 0 })
    expect(providers.dataForSeo).not.toHaveBeenCalled()
  })
})
