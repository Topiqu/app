import { describe, expect, it } from 'vitest'

import { resolveTenantHostname } from '../../app/composables/useClientSite'

const preview = { widgetPreview: '1', widgetPreviewSite: 'journal.example.com' }

describe('resolveTenantHostname', () => {
  it('serves the request host on a tenant domain', () => {
    expect(resolveTenantHostname('www.blog.example.com', {})).toBe('blog.example.com')
  })

  it('serves no tenant on a platform host', () => {
    expect(resolveTenantHostname('app.topiqu.com', {})).toBeNull()
  })

  it('previews the requested tenant on a platform host', () => {
    expect(resolveTenantHostname('app.topiqu.com', preview)).toBe('journal.example.com')
  })

  it('ignores the preview query on a tenant domain', () => {
    expect(resolveTenantHostname('blog.example.com', preview)).toBe('blog.example.com')
  })

  it('ignores an invalid preview domain', () => {
    expect(
      resolveTenantHostname('app.topiqu.com', { widgetPreview: '1', widgetPreviewSite: 'not a domain' }),
    ).toBeNull()
  })
})
