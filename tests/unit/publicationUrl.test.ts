import { describe, expect, it } from 'vitest'

import { publicationNavigationUrl, publicationUrl } from '../../app/utils/publicationUrl'

describe('dashboard publication links', () => {
  const site = { domain: 'gamingnewsbigjohn.topiqu.com', domainVerified: true, language: 'cs' }

  it('uses the active publication domain and language independently of the app locale', () => {
    expect(publicationUrl(site)).toBe('https://gamingnewsbigjohn.topiqu.com/cs')
    expect(publicationUrl({ ...site, domain: 'pixbo.topiqu.com', language: 'en' })).toBe('https://pixbo.topiqu.com/en')
  })

  it('preserves localized article paths', () => {
    expect(publicationUrl(site, '/en/articles/nintendo')).toBe(
      'https://gamingnewsbigjohn.topiqu.com/en/articles/nintendo',
    )
  })

  it('does not link back to the app when no publication is available', () => {
    expect(publicationUrl(null)).toBeUndefined()
    expect(publicationUrl({ ...site, domainVerified: false })).toBeUndefined()
    expect(publicationUrl({ ...site, domain: 'javascript:alert(1)' })).toBeUndefined()
  })

  it('preserves the development protocol and port for local tenant links', () => {
    const local = { ...site, domain: 'viky.localhost' }
    expect(publicationUrl(local, '/cs/clanky/test', new URL('http://viky.localhost:3001/cs/admin'))).toBe(
      'http://viky.localhost:3001/cs/clanky/test',
    )
    expect(publicationUrl(local, undefined, new URL('http://localhost:3001'))).toBe('http://viky.localhost:3001/cs')
  })

  it('never carries development ports or HTTP to a production publication', () => {
    expect(publicationUrl(site, undefined, new URL('http://localhost:3001'))).toBe(
      'https://gamingnewsbigjohn.topiqu.com/cs',
    )
    expect(publicationUrl({ ...site, domain: 'viky.localhost' }, undefined, new URL('https://app.topiqu.com'))).toBe(
      'https://viky.localhost/cs',
    )
  })

  it.each(['gamingnewsbigjohn.topiqu.com', 'blog.example.com'])(
    'uses an internal localized home path on the same publication origin: %s',
    (domain) => {
      expect(publicationNavigationUrl({ ...site, domain }, '/en', new URL(`https://${domain}/en/admin`))).toBe('/en')
    },
  )

  it('keeps the verified publication origin and its primary language when leaving the central app', () => {
    expect(publicationNavigationUrl(site, '/en', new URL('https://app.topiqu.com/en/admin'))).toBe(
      'https://gamingnewsbigjohn.topiqu.com/cs',
    )
    expect(
      publicationNavigationUrl(
        { ...site, domain: 'blog.example.com' },
        '/en',
        new URL('https://app.topiqu.com/en/admin'),
      ),
    ).toBe('https://blog.example.com/cs')
  })

  it('retains same-tab router navigation locally without leaking a different port or insecure origin', () => {
    const local = { ...site, domain: 'localhost' }
    expect(publicationNavigationUrl(local, '/en', new URL('http://localhost:3001/en/admin'))).toBe('/en')
    expect(publicationNavigationUrl(local, '/en', new URL('http://127.0.0.1:3001/en/admin'))).toBe(
      'http://localhost:3001/cs',
    )
    expect(publicationNavigationUrl(site, '/en', new URL('http://gamingnewsbigjohn.topiqu.com/en/admin'))).toBe(
      'https://gamingnewsbigjohn.topiqu.com/cs',
    )
  })

  it('leaves Web unavailable when the selected publication is missing, unverified or invalid', () => {
    const current = new URL('https://app.topiqu.com/en/admin')
    expect(publicationNavigationUrl(null, '/en', current)).toBeUndefined()
    expect(publicationNavigationUrl({ ...site, domainVerified: false }, '/en', current)).toBeUndefined()
    expect(publicationNavigationUrl({ ...site, domain: 'javascript:alert(1)' }, '/en', current)).toBeUndefined()
  })
})
