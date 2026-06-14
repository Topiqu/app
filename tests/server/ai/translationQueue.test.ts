import { beforeEach, describe, expect, it, vi } from 'vitest'

import { syncArticleTranslationQueue } from '../../../server/utils/ai/translationQueue'

const makeDb = (
  clientSite: { language: string; translationMode: string; translationLanguages: string[] } | null,
  existing: Array<{ language: string }> = [],
) => ({
  clientSite: { findUnique: vi.fn(async () => clientSite) },
  articleTranslation: {
    findMany: vi.fn(async () => existing),
    createMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
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

  it('enqueues PENDING rows for missing target languages (empty config = all others)', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: [] })
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).toHaveBeenCalledWith({
      data: [{ articleId: 'a1', clientSiteId: 'cs1', language: 'en', status: 'PENDING', source: 'AI' }],
      skipDuplicates: true,
    })
  })

  it('does not enqueue a language that already has a row', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: ['en'] }, [{ language: 'en' }])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1')
    expect(db.articleTranslation.createMany).not.toHaveBeenCalled()
  })

  it('marks existing translations STALE only when content changed', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'HYBRID', translationLanguages: [] }, [{ language: 'en' }])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: true })
    expect(db.articleTranslation.updateMany).toHaveBeenCalledWith({
      where: { articleId: 'a1', language: { in: ['en'] }, status: { in: ['READY', 'PUBLISHED'] } },
      data: { status: 'STALE' },
    })
  })

  it('does not mark STALE when content did not change', async () => {
    const db = makeDb({ language: 'cs', translationMode: 'AUTO', translationLanguages: [] }, [{ language: 'en' }])
    await syncArticleTranslationQueue(db as any, 'a1', 'cs1', { contentChanged: false })
    expect(db.articleTranslation.updateMany).not.toHaveBeenCalled()
  })
})
