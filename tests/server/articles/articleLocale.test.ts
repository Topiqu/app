import { describe, expect, it, vi } from 'vitest'

import { localizeArticles } from '../../../server/utils/articleLocale'

describe('localizeArticles', () => {
  it('keeps a Czech source article on an English-first site when Czech is requested', async () => {
    const findMany = vi.fn()
    const article = { id: 'article-1', slug: 'cesky-clanek', title: 'Český článek', excerpt: null, language: 'cs' }

    const result = await localizeArticles({ articleTranslation: { findMany } }, [article], {
      clientSiteId: 'site-1',
      locale: 'cs',
      primaryLanguage: 'en',
    })

    expect(result).toEqual([article])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('uses the published English translation when the article source is Czech', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ articleId: 'article-1', slug: 'english-article', title: 'English article', excerpt: null }])

    const result = await localizeArticles(
      { articleTranslation: { findMany } },
      [{ id: 'article-1', slug: 'cesky-clanek', title: 'Český článek', excerpt: null, language: 'cs' }],
      { clientSiteId: 'site-1', locale: 'en', primaryLanguage: 'en' },
    )

    expect(result[0]).toMatchObject({ slug: 'english-article', language: 'en' })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ articleId: { in: ['article-1'] }, language: 'en', status: 'PUBLISHED' }),
      }),
    )
  })
})
