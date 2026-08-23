import { describe, expect, it } from 'vitest'

import { externalArticleWhere, flattenExternalArticle, parseExternalTagFilter } from '../../server/utils/externalApi'

describe('external API helpers', () => {
  it('normalizes and deduplicates comma-separated tag filters', () => {
    expect(parseExternalTagFilter(' seo,news,seo, , product ')).toEqual(['seo', 'news', 'product'])
    expect(parseExternalTagFilter(['seo'])).toEqual([])
  })

  it('builds an AND filter scoped to published tenant articles', () => {
    expect(externalArticleWhere('site-1', ['seo', 'news'])).toEqual({
      clientSiteId: 'site-1',
      status: 'published',
      AND: [{ tags: { some: { tag: { slug: 'seo' } } } }, { tags: { some: { tag: { slug: 'news' } } } }],
    })
  })

  it('flattens relation wrappers for new detail responses', () => {
    const result = flattenExternalArticle(
      {
        id: 'article-1',
        tags: [{ tag: { id: 'tag-1', name: 'SEO', slug: 'seo' } }],
        translations: [{ language: 'en', slug: 'hello' }],
      },
      'cs',
    )

    expect(result).toMatchObject({
      id: 'article-1',
      language: 'cs',
      tags: [{ id: 'tag-1', name: 'SEO', slug: 'seo' }],
      availableTranslations: [{ language: 'en', slug: 'hello' }],
    })
    expect(result).not.toHaveProperty('translations')
  })
})
