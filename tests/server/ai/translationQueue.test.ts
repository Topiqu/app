import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/translationRow'), 'nextTranslationVersion')
}

await stubImports()

const { resolveTargetLanguages, syncArticleTranslationQueue } =
  await import('../../../server/utils/ai/translationQueue')

// `features` mirrors the `isActive AI` probe in the real select — a non-empty array means
// the tenant currently holds the AI feature.
const makeDb = (
  clientSite: {
    language: string
    translationMode: string
    translationLanguages: string[]
    features?: { id: string }[]
  } | null,
  existing: Array<{ language: string; id?: string; status?: string; updatedAt?: Date }> = [],
) => ({
  clientSite: {
    findUnique: vi.fn(
      async () =>
        clientSite && { features: [{ id: 'f1' }], plan: 'PREMIUM', extraTranslationLanguages: 0, ...clientSite },
    ),
  },
  articleTranslation: {
    findMany: vi.fn(async () => existing),
    createMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
})

describe('resolveTargetLanguages', () => {
  const pro = { plan: 'PRO' as const, extraTranslationLanguages: 0 }

  // With ten content languages, "empty means all" would hand out nine free translations per article.
  it('treats an empty config as "none"', () => {
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: [] })).toEqual([])
  })

  it('honours an explicit config', () => {
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: ['en'] })).toEqual(['en'])
    expect(resolveTargetLanguages({ ...pro, language: 'en', translationLanguages: ['cs'] }, 'cs')).toEqual(['en'])
  })

  it('never targets the site’s own primary language', () => {
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: ['cs'] })).toEqual([])
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: ['cs', 'en'] })).toEqual(['en'])
  })

  it('translates only the languages the plan pays for', () => {
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: ['en', 'de', 'es'] })).toEqual([
      'en',
      'de',
    ])
    expect(
      resolveTargetLanguages({
        ...pro,
        extraTranslationLanguages: 1,
        language: 'cs',
        translationLanguages: ['en', 'de', 'es'],
      }),
    ).toEqual(['en', 'de', 'es'])
  })

  it('still targets the site language for an article written in another one', () => {
    expect(resolveTargetLanguages({ ...pro, language: 'cs', translationLanguages: [] }, 'es')).toEqual(['cs'])
  })
})

describe('syncArticleTranslationQueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is a no-op for OFF tenants', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'OFF', translationLanguages: [] })
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).not.toHaveBeenCalled()
    expect(db.articleTranslation.updateMany).not.toHaveBeenCalled()
  })

  it('is a no-op for MANUAL tenants', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'MANUAL', translationLanguages: [] })
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).not.toHaveBeenCalled()
  })

  it('enqueues PENDING rows for missing target languages', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: ['en', 'de', 'fr'] })
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).toHaveBeenCalledWith({
      data: ['en', 'de', 'fr'].map((language) => ({
        articleId: 'a1',
        clientSiteId: 'cs1',
        language,
        status: 'PENDING',
        source: 'AI',
      })),
      skipDuplicates: true,
    })
  })

  it('does not enqueue a language that already has a row', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: ['en'] }, [{ language: 'en' }])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).not.toHaveBeenCalled()
  })

  it('marks existing translations STALE only when content changed', async () => {
    const observed = new Date('2090-01-01T00:00:00Z')
    const db = makeDb({ language: 'cs', translationMode: 'HYBRID', translationLanguages: ['en'] }, [
      { id: 'translation-1', language: 'en', status: 'PUBLISHED', updatedAt: observed },
    ])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: true })
    expect(db.articleTranslation.updateMany).toHaveBeenCalledWith({
      where: { id: 'translation-1', articleId: 'a1', clientSiteId: 'cs1', status: 'PUBLISHED', updatedAt: observed },
      data: { status: 'STALE', translationStartedAt: null, updatedAt: new Date(observed.getTime() + 1) },
    })
  })

  it('invalidates a running worker claim when the article content changes', async () => {
    const observed = new Date('2090-01-01T00:00:00Z')
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: ['en'] }, [
      { id: 'translation-1', language: 'en', status: 'TRANSLATING', updatedAt: observed },
    ])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: true })
    expect(db.articleTranslation.updateMany).toHaveBeenCalledWith({
      where: { id: 'translation-1', articleId: 'a1', clientSiteId: 'cs1', status: 'TRANSLATING', updatedAt: observed },
      data: { status: 'STALE', translationStartedAt: null, updatedAt: new Date(observed.getTime() + 1) },
    })
  })

  it('does not mark STALE when content did not change', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: [] }, [{ language: 'en' }])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: false })
    expect(db.articleTranslation.updateMany).not.toHaveBeenCalled()
  })

  // `translate-pending` refuses to drain the queue without the AI feature, so enqueuing
  // anyway just accumulates PENDING rows a later re-subscribe would flush in one burst.
  it('is a no-op once the AI feature is revoked, even on an AUTO tenant', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: [], features: [] })
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: true })

    expect(db.articleTranslation.createMany).not.toHaveBeenCalled()
    expect(db.articleTranslation.updateMany).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)
