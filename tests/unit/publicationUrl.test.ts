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
})
