import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubAiFunding } from '../../helpers/aiFunding'
import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  stubAiFunding()
  await stubNitroImports(import('../../../server/utils/ai/translationRow'), 'nextTranslationVersion')
  await stubNitroImports(import('../../../shared/utils/articleTranslations'), 'readMarketFit')
}

beforeEach(async () => {
  vi.resetModules()
  await stubImports()
})
afterEach(() => vi.unstubAllGlobals())

type Row = { content: string | null; marketFit: unknown; selection: 'SMART' | 'ALL' }

const setup = async ({ content = null, marketFit = null, selection = 'SMART' }: Partial<Row> = {}) => {
  let status = 'PENDING'
  let version = new Date('2020-01-01T00:00:00Z')
  const saved: Record<string, unknown>[] = []
  const updateMany = vi.fn(async ({ where, data }) => {
    if (!where.id) return { count: 0 }
    const expected = typeof where.status === 'string' ? [where.status] : where.status.in
    if (!expected.includes(status) || version.getTime() !== where.updatedAt.getTime()) return { count: 0 }
    saved.push(data)
    status = data.status ?? status
    version = data.updatedAt ?? version
    return { count: 1 }
  })
  const db = {
    articleTranslation: {
      updateMany,
      findMany: async () => [{ id: 'translation-1', updatedAt: version }],
      count: async () => 0,
      findUnique: async () => ({
        id: 'translation-1',
        language: 'es',
        clientSiteId: 'site-1',
        content,
        marketFit,
        article: { id: 'article-1', language: 'cs', title: 'Zdroj', content: '<p>Zdroj.</p>', editVersion: 1 },
        clientSite: { translationMode: 'HYBRID', publishToWeb: true, translationSelection: selection },
      }),
    },
    $queryRaw: async () => [{ editVersion: 1 }],
    $transaction: async (run: (tx: unknown) => unknown) => run(db),
  }
  const generate = vi.fn(async () => ({
    title: 'Traducido',
    excerpt: null,
    content: '<p>Traducido.</p>',
    slug: 'traducido',
    answer: null,
    keyTakeaways: [],
    faq: [],
    usage: { totalTokens: 10 },
  }))
  const assess = vi.fn()
  const report = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('activeFeatureFilter', () => ({}))
  vi.stubGlobal('generateTranslation', generate)
  vi.stubGlobal('assessMarketFit', assess)
  vi.stubGlobal('recordAiUsage', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('dedupeTranslationSlug', async () => 'traducido')
  vi.stubGlobal('sanitizeHtml', (html: string) => html)
  vi.stubGlobal('aiModelId', () => 'translation-model')
  vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
  vi.stubGlobal('syncArticleMediaUsages', vi.fn())
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('announceArticle', vi.fn())
  vi.stubGlobal('reportCaughtError', report)
  vi.stubGlobal('getAiAllowance', async () => ({ renewsAt: new Date(Date.now() + 86400000).toISOString() }))
  const task = (await import('../../../server/tasks/translate-pending')).default as {
    run: () => Promise<{ result: Record<string, number> }>
  }
  return { run: () => task.run(), generate, assess, report, saved, status: () => status }
}

const skip = { verdict: 'SKIP', reason: 'Český stavební zákon.', localPassages: [] }
const adapt = { verdict: 'ADAPT', reason: 'Zmiňuje české dotace.', localPassages: ['Nová zelená úsporám'] }

describe('smart translation selection', () => {
  it('defers assessment when funding is exhausted without falling through to translation', async () => {
    const fixture = await setup()
    fixture.assess.mockRejectedValueOnce({ data: { code: 'AI_ALLOWANCE_EXHAUSTED' } })
    await fixture.run()
    expect(fixture.generate).not.toHaveBeenCalled()
    expect(fixture.status()).toBe('PENDING')
    expect(fixture.saved.at(-1)).toMatchObject({ error: 'AI_ALLOWANCE_EXHAUSTED', aiRetryAt: expect.any(Date) })
  })
  it('holds back an article that does not suit the target market', async () => {
    const fixture = await setup()
    fixture.assess.mockResolvedValueOnce(skip)
    const { result } = await fixture.run()
    expect(fixture.status()).toBe('SKIPPED')
    expect(fixture.saved.at(-1)).toMatchObject({ status: 'SKIPPED', marketFit: skip, translationStartedAt: null })
    expect(fixture.generate).not.toHaveBeenCalled()
    expect(result).toMatchObject({ processed: 0, held: 1, failed: 0 })
  })

  it('passes local passages to the translator and keeps the verdict for review', async () => {
    const fixture = await setup()
    fixture.assess.mockResolvedValueOnce(adapt)
    await fixture.run()
    expect(fixture.generate).toHaveBeenCalledWith(expect.anything(), 'es', ['Nová zelená úsporám'])
    expect(fixture.status()).toBe('READY')
    expect(fixture.saved.at(-1)).toMatchObject({ status: 'READY', marketFit: adapt })
  })

  it('translates when the assessment fails, and reports it', async () => {
    const fixture = await setup()
    fixture.assess.mockRejectedValueOnce(new Error('overloaded'))
    await fixture.run()
    expect(fixture.generate).toHaveBeenCalledWith(expect.anything(), 'es', [])
    expect(fixture.status()).toBe('READY')
    expect(fixture.report).toHaveBeenCalled()
  })

  it('does not judge a language that already has text', async () => {
    const fixture = await setup({ content: '<p>Starý překlad.</p>' })
    await fixture.run()
    expect(fixture.assess).not.toHaveBeenCalled()
    expect(fixture.generate).toHaveBeenCalled()
  })

  it('translates everything, a previous SKIP included, when the site translates all', async () => {
    const fixture = await setup({ selection: 'ALL', marketFit: skip })
    await fixture.run()
    expect(fixture.assess).not.toHaveBeenCalled()
    expect(fixture.generate).toHaveBeenCalledWith(expect.anything(), 'es', [])
    expect(fixture.status()).toBe('READY')
  })
})
