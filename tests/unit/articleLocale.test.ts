import { describe, expect, it } from 'vitest'
import { overlayTranslation, overlayTranslations, type LocalizableArticle } from '~~/shared/utils/articleLocale'

const article = (overrides: Partial<LocalizableArticle> = {}): LocalizableArticle => ({
  id: 'a1',
  slug: 'zdrojovy-clanek',
  title: 'Zdrojový článek',
  excerpt: 'Český perex',
  ...overrides,
})

describe('overlayTranslation', () => {
  it('swaps slug, title and excerpt for a linkable translation', () => {
    expect(
      overlayTranslation(article(), { articleId: 'a1', slug: 'source-article', title: 'Source article', excerpt: 'EN' }),
    ).toEqual({ id: 'a1', slug: 'source-article', title: 'Source article', excerpt: 'EN' })
  })

  it('keeps the source excerpt when the translation has none', () => {
    const result = overlayTranslation(article(), {
      articleId: 'a1',
      slug: 'source-article',
      title: 'Source article',
      excerpt: null,
    })

    expect(result.excerpt).toBe('Český perex')
    expect(result.title).toBe('Source article')
  })

  it('leaves the article untouched without a slug — localized text must never point at the source URL', () => {
    expect(
      overlayTranslation(article(), { articleId: 'a1', slug: null, title: 'Source article', excerpt: 'EN' }),
    ).toEqual(article())
  })

  it('leaves the article untouched without a title', () => {
    expect(overlayTranslation(article(), { articleId: 'a1', slug: 'source-article', title: null, excerpt: 'EN' })).toEqual(
      article(),
    )
  })

  it('leaves the article untouched with no overlay at all', () => {
    expect(overlayTranslation(article(), undefined)).toEqual(article())
  })

  it('does not mutate the input', () => {
    const source = article()
    overlayTranslation(source, { articleId: 'a1', slug: 'source-article', title: 'Source article', excerpt: 'EN' })

    expect(source.title).toBe('Zdrojový článek')
  })
})

describe('overlayTranslations', () => {
  it('localizes only the articles that have a translation, keeping feed order', () => {
    const feed = [article({ id: 'a1' }), article({ id: 'a2', slug: 'druhy', title: 'Druhý' }), article({ id: 'a3' })]

    const result = overlayTranslations(feed, [
      { articleId: 'a3', slug: 'third', title: 'Third', excerpt: 'EN' },
      { articleId: 'a1', slug: 'first', title: 'First', excerpt: 'EN' },
    ])

    expect(result.map((a) => a.title)).toEqual(['First', 'Druhý', 'Third'])
    expect(result.map((a) => a.slug)).toEqual(['first', 'druhy', 'third'])
  })

  it('returns the list untouched when nothing is translated', () => {
    const feed = [article()]

    expect(overlayTranslations(feed, [])).toBe(feed)
  })
})
