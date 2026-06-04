import { describe, expect, it, vi } from 'vitest'

import { dedupeTranslationSlug } from '../../../server/utils/ai/translationSlug'

const makeDb = (existing: Array<{ slug: string | null }>) => ({
  articleTranslation: {
    findMany: vi.fn(async () => existing),
  },
})

describe('dedupeTranslationSlug', () => {
  it('returns the base slug when free', async () => {
    const db = makeDb([])
    expect(await dedupeTranslationSlug(db, 'my-article', 'cs1', 'en', 'a1')).toBe('my-article')
  })

  it('appends a counter when the base is taken', async () => {
    const db = makeDb([{ slug: 'my-article' }])
    expect(await dedupeTranslationSlug(db, 'my-article', 'cs1', 'en', 'a1')).toBe('my-article-2')
  })

  it('skips over consecutive taken suffixes', async () => {
    const db = makeDb([{ slug: 'my-article' }, { slug: 'my-article-2' }, { slug: 'my-article-3' }])
    expect(await dedupeTranslationSlug(db, 'my-article', 'cs1', 'en', 'a1')).toBe('my-article-4')
  })

  it('scopes the lookup to (clientSiteId, language) and excludes the same article', async () => {
    const db = makeDb([])
    await dedupeTranslationSlug(db, 'my-article', 'cs1', 'en', 'a1')
    expect(db.articleTranslation.findMany).toHaveBeenCalledWith({
      where: { clientSiteId: 'cs1', language: 'en', slug: { startsWith: 'my-article' }, articleId: { not: 'a1' } },
      select: { slug: true },
    })
  })
})
