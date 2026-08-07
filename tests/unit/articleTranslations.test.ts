import { describe, expect, it } from 'vitest'
import {
  countAwaitingReview,
  isTranslationDirty,
  resolveActiveLanguage,
  translationDraft,
  translationHasBody,
  type ArticleTranslationRow,
} from '~~/shared/utils/articleTranslations'

const row = (overrides: Partial<ArticleTranslationRow> = {}): ArticleTranslationRow => ({
  id: 'tr-1',
  language: 'en',
  slug: 'title',
  title: 'Title',
  excerpt: 'Excerpt',
  content: '<p>Body</p>',
  status: 'READY',
  source: 'AI',
  error: null,
  translatedAt: null,
  ...overrides,
})

describe('translation body', () => {
  it('is present only when both title and content came back', () => {
    expect(translationHasBody(row())).toBe(true)
    expect(translationHasBody(row({ content: null }))).toBe(false)
    expect(translationHasBody(row({ title: null }))).toBe(false)
    expect(translationHasBody(row({ title: '', content: '' }))).toBe(false)
    expect(translationHasBody(undefined)).toBe(false)
  })

  it('gives an empty draft for a row that has no text yet, so the fields never bind to null', () => {
    expect(translationDraft(row({ title: null, excerpt: null, content: null }))).toEqual({
      title: '',
      excerpt: '',
      content: '',
    })
    expect(translationDraft(undefined)).toEqual({ title: '', excerpt: '', content: '' })
  })
})

describe('dirty tracking', () => {
  const pristine = { title: 'Title', excerpt: 'Excerpt', content: '<p>Body</p>' }

  it('stays clean for an untouched draft', () => {
    expect(isTranslationDirty({ ...pristine }, pristine)).toBe(false)
  })

  it('reports every editable field, excerpt included', () => {
    expect(isTranslationDirty({ ...pristine, title: 'Other' }, pristine)).toBe(true)
    expect(isTranslationDirty({ ...pristine, excerpt: 'Other' }, pristine)).toBe(true)
    expect(isTranslationDirty({ ...pristine, content: '<p>Other</p>' }, pristine)).toBe(true)
  })

  it('is the only thing that disables Save — a body always keeps the action on screen', () => {
    // Save renders on `translationHasBody` and is merely disabled while clean, so an
    // author never has to guess whether the panel can be saved at all.
    const clean = { ...pristine }

    expect(translationHasBody(row())).toBe(true)
    expect(isTranslationDirty(clean, pristine)).toBe(false)
  })
})

describe('awaiting review count', () => {
  it('counts only READY rows — the ones a human still has to approve', () => {
    expect(
      countAwaitingReview([
        row({ language: 'en', status: 'READY' }),
        row({ language: 'de', status: 'READY' }),
        row({ language: 'pl', status: 'PUBLISHED' }),
        row({ language: 'sk', status: 'PENDING' }),
        row({ language: 'hu', status: 'FAILED' }),
      ]),
    ).toBe(2)
    expect(countAwaitingReview([])).toBe(0)
  })
})

describe('active language', () => {
  const targets = ['en', 'de']

  it('keeps the tab the author is on', () => {
    expect(resolveActiveLanguage([row({ language: 'de', status: 'READY' })], targets, 'en')).toBe('en')
  })

  it('opens on the language awaiting review when the current tab is gone', () => {
    expect(resolveActiveLanguage([row({ language: 'de', status: 'READY' })], targets, 'fr')).toBe('de')
  })

  it('ignores a READY translation for a language that is no longer a target', () => {
    // Dropping a language in settings leaves its rows behind; selecting one would point
    // the panel at a tab that is not rendered.
    expect(resolveActiveLanguage([row({ language: 'fr', status: 'READY' })], targets, '')).toBe('en')
  })

  it('falls back to the first target when nothing is awaiting review', () => {
    expect(resolveActiveLanguage([row({ language: 'de', status: 'PUBLISHED' })], targets, '')).toBe('en')
  })

  it('returns nothing when the site has no target languages', () => {
    expect(resolveActiveLanguage([], [], 'en')).toBe('')
  })
})
