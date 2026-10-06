import { describe, expect, it } from 'vitest'

import { articleModifiedAt, changesReaderText } from '../../../server/utils/articleModified'

const previous = {
  title: 'Kompost',
  excerpt: null,
  content: '<h2 id="a">Úvod</h2><p>Kompost zlepší půdu.</p>',
  answer: null,
  keyTakeaways: [],
  faq: null,
}

describe('changesReaderText', () => {
  it('ignores a re-save of the same text, including markup-only differences', () => {
    expect(changesReaderText(previous, { ...previous })).toBe(false)
    expect(changesReaderText(previous, { content: '<h2>Úvod</h2>\n<p>Kompost   zlepší půdu.</p>' })).toBe(false)
    expect(changesReaderText(previous, { excerpt: '', answer: '' })).toBe(false)
    expect(changesReaderText(previous, {})).toBe(false)
  })

  it('detects a change to any field a reader sees', () => {
    expect(changesReaderText(previous, { content: '<p>Kompost zlepší půdu i výnos.</p>' })).toBe(true)
    expect(changesReaderText(previous, { title: 'Kompostování' })).toBe(true)
    expect(changesReaderText(previous, { faq: [{ question: 'Kdy?', answer: 'Na jaře.' }] })).toBe(true)
  })
})

describe('articleModifiedAt', () => {
  const createdAt = new Date('2026-01-01')
  const publishedAt = new Date('2026-02-01')

  it('falls back to publication, never to the row timestamp', () => {
    expect(articleModifiedAt({ contentUpdatedAt: null, publishedAt, createdAt })).toBe(publishedAt)
    expect(articleModifiedAt({ contentUpdatedAt: null, publishedAt: null, createdAt })).toBe(createdAt)
    const edited = new Date('2026-03-01')
    expect(articleModifiedAt({ contentUpdatedAt: edited, publishedAt, createdAt })).toBe(edited)
  })
})
