import { describe, expect, it } from 'vitest'

import { publicationUrl } from '../../app/utils/publicationUrl'

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
})
