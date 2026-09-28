import { describe, expect, it } from 'vitest'

import { tenantAdminUrl } from '../../app/utils/tenantAdminUrl'

describe('tenant admin navigation', () => {
  it('opens the selected subdomain dashboard instead of carrying over an editor URL', () => {
    expect(
      tenantAdminUrl(
        { domain: 'second.topiqu.com', domainVerified: true },
        'https://first.topiqu.com/cs/admin/editor/old-article?tab=seo',
        '/cs/admin',
        'topiqu.com',
      ),
    ).toBe('https://second.topiqu.com/cs/admin')
  })

  it('opens a verified custom domain', () => {
    expect(
      tenantAdminUrl(
        { domain: 'blog.example.cz', domainVerified: true },
        'https://first.topiqu.com/en/settings',
        '/en/admin',
        'topiqu.com',
      ),
    ).toBe('https://blog.example.cz/en/admin')
  })

  it('uses the app host until a custom domain is verified', () => {
    expect(
      tenantAdminUrl(
        { domain: 'unverified.example.cz', domainVerified: false },
        'https://first.topiqu.com/de/admin',
        '/de/admin',
        'topiqu.com',
      ),
    ).toBe('https://app.topiqu.com/de/admin')
  })

  it('keeps the local development port', () => {
    expect(
      tenantAdminUrl(
        { domain: 'localhost', domainVerified: true },
        'http://localhost:3000/cs/admin',
        '/cs/admin',
        'topiqu.com',
      ),
    ).toBe('http://localhost:3000/cs/admin')
  })
})
