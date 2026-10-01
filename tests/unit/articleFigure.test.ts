import { describe, expect, it } from 'vitest'

import { normalizeImageHref, parseFigureAlign, parseImageWidth, snapImageWidth } from '../../app/utils/articleFigure'

describe('image width', () => {
  it('snaps to 5 % steps between 10 % and full width', () => {
    expect(snapImageWidth(48)).toBe(50)
    expect(snapImageWidth(2)).toBe(10)
    expect(snapImageWidth(140)).toBeNull()
    expect(snapImageWidth(Number.NaN)).toBeNull()
  })

  it('reads back only a bare percentage', () => {
    expect(parseImageWidth('50%')).toBe(50)
    expect(parseImageWidth(' 33.3% ')).toBe(35)
    expect(parseImageWidth('100%')).toBeNull()
    expect(parseImageWidth('400px')).toBeNull()
    expect(parseImageWidth('calc(100% + 9999px)')).toBeNull()
    expect(parseImageWidth(null)).toBeNull()
  })
})

describe('figure alignment', () => {
  it('falls back to centre for anything unknown', () => {
    expect(parseFigureAlign('float-left')).toBe('float-left')
    expect(parseFigureAlign('justify')).toBe('center')
    expect(parseFigureAlign(null)).toBe('center')
  })
})

describe('image link', () => {
  it('adds https to a bare domain and keeps site paths', () => {
    expect(normalizeImageHref('example.com/a')).toBe('https://example.com/a')
    expect(normalizeImageHref('/cs/clanek')).toBe('/cs/clanek')
    expect(normalizeImageHref('mailto:a@b.cz')).toBe('mailto:a@b.cz')
    expect(normalizeImageHref('  ')).toBeNull()
  })

  it('refuses script and protocol-relative links', () => {
    expect(normalizeImageHref('javascript:alert(1)')).toBeNull()
    expect(normalizeImageHref('data:text/html,x')).toBeNull()
    expect(normalizeImageHref('//evil.test')).toBeNull()
  })
})
