import { describe, expect, it, vi } from 'vitest'

import { resolveArticleBySlug } from '../../../server/utils/articleBySlug'

const SELECT = { id: true }

const makeDb = (opts: { article?: unknown; translation?: unknown } = {}) => ({
  article: { findUnique: vi.fn(async () => opts.article ?? null) },
  articleTranslation: { findUnique: vi.fn(async () => opts.translation ?? null) },
})

describe('resolveArticleBySlug', () => {
  it('reads Article on the primary locale', async () => {
    const db = makeDb({ article: { id: 'a1', language: 'cs' } })

    const found = await resolveArticleBySlug(db, { slug: 'cz-slug', clientSiteId: 'cs1', locale: 'cs' }, SELECT)

    expect(found).toEqual({ id: 'a1', language: 'cs' })
    expect(db.articleTranslation.findUnique).not.toHaveBeenCalled()
    expect(db.article.findUnique).toHaveBeenCalledWith({
      where: { slug_clientSiteId: { slug: 'cz-slug', clientSiteId: 'cs1' } },
      select: SELECT,
    })
  })

  it('reads the translation on a non-primary locale', async () => {
    const db = makeDb({ translation: { status: 'PUBLISHED', article: { id: 'a1' } } })

    const found = await resolveArticleBySlug(db, { slug: 'en-slug', clientSiteId: 'cs1', locale: 'en' }, SELECT)

    expect(found).toEqual({ id: 'a1' })
    expect(db.article.findUnique).toHaveBeenCalled()
    expect(db.articleTranslation.findUnique).toHaveBeenCalledWith({
      where: { slug_clientSiteId_language: { slug: 'en-slug', clientSiteId: 'cs1', language: 'en' } },
      select: { status: true, article: { select: SELECT } },
    })
  })

  it('falls back to the source row when the locale has no translation', async () => {
    const db = makeDb({ article: { id: 'a1' } })

    const found = await resolveArticleBySlug(db, { slug: 'cz-slug', clientSiteId: 'cs1', locale: 'en' }, SELECT)

    expect(found).toEqual({ id: 'a1' })
    expect(db.article.findUnique).toHaveBeenCalled()
  })

  it('resolves a Czech source on an English-first site without mistaking it for a translation', async () => {
    const db = makeDb({ article: { id: 'a1', language: 'cs' } })

    const found = await resolveArticleBySlug(
      db,
      { slug: 'cesky-clanek', clientSiteId: 'site-en', locale: 'cs' },
      { id: true, language: true },
    )

    expect(found).toEqual({ id: 'a1', language: 'cs' })
    expect(db.articleTranslation.findUnique).not.toHaveBeenCalled()
  })

  it('hides an unpublished translation from a visitor', async () => {
    const db = makeDb({ translation: { status: 'PENDING', article: { id: 'a1' } } })

    expect(await resolveArticleBySlug(db, { slug: 'en-slug', clientSiteId: 'cs1', locale: 'en' }, SELECT)).toBeNull()
  })

  it('hides an unpublished public translation from an admin too', async () => {
    const db = makeDb({ translation: { status: 'PENDING', article: { id: 'a1' } } })

    const found = await resolveArticleBySlug(
      db,
      { slug: 'en-slug', clientSiteId: 'cs1', locale: 'en', isAdmin: true },
      SELECT,
    )

    expect(found).toBeNull()
  })

  it('returns null for an unknown slug', async () => {
    const db = makeDb()

    expect(await resolveArticleBySlug(db, { slug: 'nope', clientSiteId: 'cs1' }, SELECT)).toBeNull()
  })
})
