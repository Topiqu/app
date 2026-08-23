import { describe, expect, it } from 'vitest'

import { linkableSources } from '../../shared/utils/articleSources'

describe('linkableSources', () => {
  it('keeps http(s) URLs in the order the model returned them', () => {
    expect(linkableSources(['https://example.com/a', 'http://example.org/b'])).toEqual([
      'https://example.com/a',
      'http://example.org/b',
    ])
  })

  it('drops the free-form references the prompt still invites', () => {
    // Ungrounded runs return prose here; the article page would render it as a dead link.
    expect(linkableSources(['Český statistický úřad, 2025', 'https://example.com/a', 'see the docs'])).toEqual([
      'https://example.com/a',
    ])
  })

  it('drops non-http schemes', () => {
    expect(linkableSources(['javascript:alert(1)', 'mailto:a@b.cz', 'data:text/html,x'])).toEqual([])
  })

  it('trims and dedupes — one page cited twice is one source', () => {
    expect(linkableSources(['  https://example.com/a  ', 'https://example.com/a'])).toEqual(['https://example.com/a'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 9 }, (_, i) => `https://example.com/${i}`)
    expect(linkableSources(many)).toHaveLength(5)
    expect(linkableSources(many, 2)).toEqual(['https://example.com/0', 'https://example.com/1'])
  })

  it('returns an empty array for anything that is not a list of strings', () => {
    expect(linkableSources(undefined)).toEqual([])
    expect(linkableSources(null)).toEqual([])
    expect(linkableSources('https://example.com')).toEqual([])
    expect(linkableSources([null, 42, { url: 'https://example.com' }])).toEqual([])
  })
})
