import { describe, expect, it, vi } from 'vitest'

import {
  AI_SERIES_MAX_PER_WINDOW,
  applyArticleSeriesDecision,
  articleSeriesDecisionSchema,
  loadAiSeriesContext,
} from '../../../server/utils/ai/articleSeries'

const now = new Date('2026-09-20T12:00:00.000Z')
const dateAt = (index: number) => new Date(now.getTime() - index * 60_000)

const series = (id: string, createdByAi = false, createdAt = dateAt(20)) => ({
  id,
  name: `Series ${id}`,
  description: null,
  createdAt,
  createdByAi,
})

const article = (
  index: number,
  options: {
    series?: ReturnType<typeof series> | null
    aiInvolvement?: 'NONE' | 'ASSIST' | 'FULL'
    status?: 'draft' | 'published' | 'archived'
  } = {},
) => ({
  id: `article-${index}`,
  title: `Article ${index}`,
  excerpt: `Summary ${index}`,
  createdAt: dateAt(index),
  status: options.status ?? 'published',
  aiInvolvement: options.aiInvolvement ?? 'FULL',
  articleSeriesId: options.series?.id ?? null,
  articleSeries: options.series ?? null,
})

const contextDb = (articles: ReturnType<typeof article>[]) =>
  ({
    article: { findMany: vi.fn().mockResolvedValue(articles) },
    articleSeries: {},
    clientSite: {},
  }) as any

describe('AI article-series policy', () => {
  it('offers a recent series only after the two-article cooldown', async () => {
    const candidate = series('a')
    const context = await loadAiSeriesContext(
      contextDb([article(0), article(1), article(2, { series: candidate })]),
      'site',
    )

    expect(context.eligibleSeries.map(({ id }) => id)).toEqual(['a'])

    const coolingDown = await loadAiSeriesContext(
      contextDb([article(0, { series: candidate }), article(1), article(2)]),
      'site',
    )
    expect(coolingDown.eligibleSeries).toEqual([])
  })

  it(`blocks a series after ${AI_SERIES_MAX_PER_WINDOW} appearances in the recent window`, async () => {
    const candidate = series('a')
    const context = await loadAiSeriesContext(
      contextDb([
        article(0),
        article(1),
        article(2, { series: candidate }),
        article(3),
        article(4),
        article(5, { series: candidate }),
        article(6),
        article(7),
        article(8, { series: candidate }),
      ]),
      'site',
    )

    expect(context.eligibleSeries).toEqual([])
  })

  it('allows creation only from a real standalone full-AI article', async () => {
    const allowed = await loadAiSeriesContext(contextDb([article(0)]), 'site')
    expect(allowed.canCreate).toBe(true)
    expect(allowed.standaloneCandidates.map(({ id }) => id)).toEqual(['article-0'])

    const humanArticle = await loadAiSeriesContext(contextDb([article(0, { aiInvolvement: 'NONE' })]), 'site')
    expect(humanArticle.canCreate).toBe(false)
  })

  it('permits at most one newly created AI series in the last ten articles', async () => {
    const recentAiSeries = series('new', true, dateAt(1))
    const context = await loadAiSeriesContext(
      contextDb([article(0), article(1), article(2, { series: recentAiSeries }), article(3)]),
      'site',
    )

    expect(context.aiSeriesCreatedInWindow).toBe(1)
    expect(context.canCreate).toBe(false)
  })

  it('keeps at most three AI-created series active in the recent window', async () => {
    const context = await loadAiSeriesContext(
      contextDb([
        article(0),
        article(1, { series: series('a', true) }),
        article(2, { series: series('b', true) }),
        article(3, { series: series('c', true) }),
      ]),
      'site',
    )

    expect(context.activeAiSeriesCount).toBe(3)
    expect(context.canCreate).toBe(false)
  })

  it('rejects structurally incomplete classifier decisions', () => {
    expect(
      articleSeriesDecisionSchema.safeParse({
        action: 'assign',
        seriesId: null,
        name: null,
        description: null,
        relatedArticleIds: [],
      }).success,
    ).toBe(false)
    expect(
      articleSeriesDecisionSchema.safeParse({
        action: 'create',
        seriesId: null,
        name: 'Focused series',
        description: null,
        relatedArticleIds: ['article-1'],
      }).success,
    ).toBe(true)
  })
})

describe('applying an AI series decision', () => {
  it('does nothing when the tenant disabled automatic series during the run', async () => {
    const findMany = vi.fn()
    const result = await applyArticleSeriesDecision(
      {
        clientSite: { findUnique: vi.fn().mockResolvedValue({ aiSeriesEnabled: false }) },
        article: { findMany },
        articleSeries: {},
      } as any,
      'site',
      {
        action: 'create',
        seriesId: null,
        name: 'A series',
        description: null,
        relatedArticleIds: ['article-0'],
      },
    )

    expect(result.action).toBe('none')
    expect(findMany).not.toHaveBeenCalled()
  })

  it('creates a series and attaches only a server-approved existing article', async () => {
    const existing = article(0)
    const update = vi.fn().mockResolvedValue({})
    const create = vi.fn().mockResolvedValue({ id: 'series-new', name: 'Monitor guide' })
    const db = {
      clientSite: { findUnique: vi.fn().mockResolvedValue({ aiSeriesEnabled: true }) },
      article: { findMany: vi.fn().mockResolvedValue([existing]), update },
      articleSeries: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create,
      },
    } as any

    const result = await applyArticleSeriesDecision(db, 'site', {
      action: 'create',
      seriesId: null,
      name: 'Monitor guide',
      description: 'A focused buying sequence.',
      relatedArticleIds: [existing.id, 'invented-id'],
    })

    expect(result).toMatchObject({
      action: 'create',
      seriesId: 'series-new',
      seriesOrder: 2,
      touchedPublishedArticle: true,
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdByAi: true, name: 'Monitor guide' }) }),
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { articleSeriesId: 'series-new', seriesOrder: 1 },
    })
  })

  it('ignores an invented existing-series ID', async () => {
    const existingSeries = series('real')
    const result = await applyArticleSeriesDecision(
      {
        clientSite: { findUnique: vi.fn().mockResolvedValue({ aiSeriesEnabled: true }) },
        article: {
          findMany: vi.fn().mockResolvedValue([article(0), article(1), article(2, { series: existingSeries })]),
        },
        articleSeries: {},
      } as any,
      'site',
      {
        action: 'assign',
        seriesId: 'invented',
        name: null,
        description: null,
        relatedArticleIds: [],
      },
    )

    expect(result.action).toBe('none')
  })
})
