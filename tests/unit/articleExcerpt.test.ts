import { describe, expect, it } from 'vitest'

import { articleExcerpt } from '../../shared/utils/articleBlocks'

describe('articleExcerpt', () => {
  it('keeps the author perex whole, however long', () => {
    const perex = 'slovo '.repeat(80).trim()
    expect(articleExcerpt(perex, '<p>body</p>')).toBe(perex)
  })

  it('falls back to the body as plain text', () => {
    expect(articleExcerpt(null, '<p>Ahoj&nbsp;<b>světe</b> &amp; spol.</p>')).toBe('Ahoj světe & spol.')
    expect(articleExcerpt('   ', '<p>Body</p>')).toBe('Body')
  })

  it('cuts a long body at a word boundary', () => {
    const body = `<p>${'abcdefghi '.repeat(40)}</p>`
    const out = articleExcerpt(null, body, 50)
    expect(out).toBe(`${'abcdefghi '.repeat(5).trim()}…`)
  })

  it('hard-cuts a body without spaces', () => {
    expect(articleExcerpt(null, 'x'.repeat(100), 20)).toBe(`${'x'.repeat(20)}…`)
  })

  it('returns an empty string when there is nothing', () => {
    expect(articleExcerpt(null, null)).toBe('')
  })
})
