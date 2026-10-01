import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveTargetLanguages } from '../../../server/utils/ai/translationQueue'

describe('editor article translations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns translated summary, takeaways and FAQ for each language', async () => {
    const translation = {
      id: 'translation-de',
      language: 'de',
      title: 'Deutscher Titel',
      content: '<p>Deutscher Inhalt</p>',
      answer: 'Deutsche Zusammenfassung',
      keyTakeaways: ['Erster wichtiger Punkt', 'Zweiter wichtiger Punkt'],
      faq: [{ question: 'Ist das kostenlos?', answer: 'Ja.' }],
      status: 'READY',
    }
    // Apply the actual select so accidentally omitting a field reproduces the bug.
    const findMany = vi.fn(async ({ select }: { select: Record<string, boolean> }) => [
      Object.fromEntries(Object.entries(translation).filter(([key]) => select[key])),
    ])
    const db = {
      article: { findFirst: vi.fn().mockResolvedValue({ id: 'article-1', language: 'cs' }) },
      clientSite: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ language: 'cs', translationMode: 'HYBRID', translationLanguages: ['de'] }),
      },
      articleTranslation: { findMany },
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getRouterParam', () => 'article-1')
    vi.stubGlobal('requireDb', async () => ({ user: { clientSiteId: 'site-1' }, db }))
    vi.stubGlobal('requireArticleAccess', vi.fn())
    vi.stubGlobal('resolveTargetLanguages', resolveTargetLanguages)

    const handler = (await import('../../../server/api/articles/[id]/translations.get')).default
    const result = await handler({} as never)

    expect(result.translations).toEqual([translation])
    expect(result.targetLanguages).toEqual(['de'])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { articleId: 'article-1', clientSiteId: 'site-1' } }),
    )
  })
})
