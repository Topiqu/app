import { describe, expect, it } from 'vitest'
import {
  localeRedirectSlug,
  overlayTranslation,
  overlayTranslations,
  type LocalizableArticle,
} from '~~/shared/utils/articleLocale'

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
      overlayTranslation(article(), {
        articleId: 'a1',
        slug: 'source-article',
        title: 'Source article',
        excerpt: 'EN',
      }),
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
    expect(
      overlayTranslation(article(), { articleId: 'a1', slug: 'source-article', title: null, excerpt: 'EN' }),
    ).toEqual(article())
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

describe('localeRedirectSlug', () => {
  const alternates = [
    { language: 'cs', slug: 'aaaaaaa-zkratka-vykrik' },
    { language: 'en', slug: 'aaaaaaa-an-abbreviation-a-scream' },
  ]

  it('sends /en on the source slug to the published translation', () => {
    // The reported bug: locale is en, but the fallback resolved the Czech source.
    expect(localeRedirectSlug('en', 'cs', alternates)).toBe('aaaaaaa-an-abbreviation-a-scream')
  })

  it('stays put once the translation actually resolved', () => {
    expect(localeRedirectSlug('en', 'en', alternates)).toBeNull()
  })

  it('stays put on the source locale', () => {
    expect(localeRedirectSlug('cs', 'cs', alternates)).toBeNull()
  })

  it('keeps the fallback when the locale has no published translation', () => {
    // Only the source is an alternate, so /en has nowhere better to go than the source body.
    expect(localeRedirectSlug('en', 'cs', [{ language: 'cs', slug: 'zdroj' }])).toBeNull()
    expect(localeRedirectSlug('en', 'cs', [])).toBeNull()
  })

  it('does nothing without a resolved language', () => {
    expect(localeRedirectSlug('en', undefined, alternates)).toBeNull()
    expect(localeRedirectSlug(undefined, 'cs', alternates)).toBeNull()
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
