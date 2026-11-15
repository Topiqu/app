import { describe, it, expect } from 'vitest'

import { brandTitle, buildCanonicalOrigin, withOrigin } from '../../shared/utils/seo'

describe('buildCanonicalOrigin', () => {
  it('forces https and strips www by default', () => {
    expect(buildCanonicalOrigin('http:', 'www.pixbo.topiqu.com')).toBe('https://pixbo.topiqu.com')
  })

  it('keeps the request protocol when asked (dev over http)', () => {
    expect(buildCanonicalOrigin('http:', 'localhost:3000', true)).toBe('http://localhost:3000')
  })

  it('tolerates a protocol without the trailing colon', () => {
    expect(buildCanonicalOrigin('http', 'localhost:3000', true)).toBe('http://localhost:3000')
  })

  it('only strips a leading www, not one inside the host', () => {
    expect(buildCanonicalOrigin('https:', 'wwwx.topiqu.com')).toBe('https://wwwx.topiqu.com')
  })
})

describe('withOrigin', () => {
  const origin = 'https://pixbo.topiqu.com'

  it('absolutises the relative hreflang hrefs emitted by useLocaleHead', () => {
    expect(withOrigin('/en/articles/foo', origin)).toBe('https://pixbo.topiqu.com/en/articles/foo')
    expect(withOrigin('/', origin)).toBe('https://pixbo.topiqu.com/')
  })

  it("moves the platform-based canonical and alternates onto the blog's origin", () => {
    expect(withOrigin('https://topiqu.com/cs', origin)).toBe('https://pixbo.topiqu.com/cs')
    expect(withOrigin('https://topiqu.com/en/tags/a%20b?page=2', origin)).toBe(
      'https://pixbo.topiqu.com/en/tags/a%20b?page=2',
    )
  })

  it('passes empty values through instead of resolving them to the origin', () => {
    expect(withOrigin('', origin)).toBe('')
  })

  it('falls back to the input when the origin is unusable', () => {
    expect(withOrigin('/en', '')).toBe('/en')
  })
})

describe('brandTitle', () => {
  it('joins the publication name and its tagline for og:title', () => {
    expect(brandTitle('Pixbo', 'Nezávislý deník o městě')).toBe('Pixbo — Nezávislý deník o městě')
  })

  it('leaves no dangling dash when the tenant never wrote a tagline', () => {
    expect(brandTitle('Pixbo', null)).toBe('Pixbo')
    expect(brandTitle('Pixbo', '')).toBe('Pixbo')
  })

  it('returns an empty string the caller can fall back from', () => {
    expect(brandTitle(null, null)).toBe('')
  })
})
