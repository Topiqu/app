import { describe, expect, it } from 'vitest'

import { scrubAuthEvent, scrubAuthTransferBreadcrumb } from '../../shared/utils/authTelemetry'

describe('authentication telemetry redaction', () => {
  it.each([
    '/en/integrations-connect?request=secret#secret',
    '/cs/auth-transfer?request=secret#secret',
    '/api/integrations/authorize?request=secret#secret',
    '/api/linkedin/callback?state=secret&code=secret#secret',
    '/api/search-console/callback?state=secret&code=secret#secret',
    '/api/auth/transfer/complete?request=secret&code=secret#secret',
  ])('removes credentials from navigation and HTTP breadcrumbs: %s', (url) => {
    const result = scrubAuthTransferBreadcrumb({
      message: `POST ${url}`,
      data: { url, from: '/en/settings?code=secret', body: { request: 'secret' }, response: 'secret' },
    })
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(result.data.url).toBe(url.split('?')[0])
  })

  it('scrubs bodies, extras, contexts, fetch errors and trace descriptions while keeping safe diagnostic codes', () => {
    const callback = 'https://app.topiqu.com/api/linkedin/callback?code=secret&state=secret#secret'
    const event = {
      request: {
        url: callback,
        data: { code: 'secret' },
        headers: { authorization: 'secret' },
        cookies: 'secret',
        query_string: 'code=secret&state=secret',
      },
      transaction: `GET ${callback}`,
      message: `Fetch failed for ${callback}`,
      logentry: { message: `Error ${callback}`, params: ['secret'] },
      extra: { request: 'secret', code: 'OAUTH_STATE_INVALID' },
      tags: { code: 'OAUTH_STATE_INVALID', currentUrl: callback },
      contexts: {
        currentPage: { url: callback },
        trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { body: 'secret' } },
      },
      breadcrumbs: [{ message: `GET ${callback}` }],
      exception: {
        values: [
          {
            type: 'FetchError',
            value: `Fetch failed ${callback}`,
            stacktrace: { frames: [{ vars: { state: 'secret' } }] },
          },
        ],
      },
      spans: [{ description: callback, data: { code: 'secret' } }],
      user: { session: 'secret' },
    }
    scrubAuthEvent(event)
    expect(JSON.stringify(event)).not.toContain('secret')
    expect(event.request).toEqual({ url: 'https://app.topiqu.com/api/linkedin/callback' })
    expect(event.transaction).toBe('GET https://app.topiqu.com/api/linkedin/callback')
    expect(event.extra).toEqual({ code: 'OAUTH_STATE_INVALID' })
    expect(event.contexts).toEqual({ trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) } })
  })

  it('recognizes sensitive URLs in error/context data even without a request URL', () => {
    const event = {
      message: 'INTEGRATION_FAILED',
      extra: { response: { url: '/api/integrations/authorize?request=secret' }, diagnosticCode: 'INTEGRATION_FAILED' },
      contexts: { url: '/fr/integrations-connect?request=secret' },
    }
    scrubAuthEvent(event)
    expect(JSON.stringify(event)).not.toContain('secret')
    expect(event.message).toBe('INTEGRATION_FAILED')
    expect(event.extra).toEqual({ diagnosticCode: 'INTEGRATION_FAILED' })
  })

  it('leaves unrelated events and their useful context intact', () => {
    const event = {
      request: { url: '/api/articles?offset=20', data: { title: 'Article' } },
      message: 'Article validation failed',
      extra: { field: 'title' },
      spans: [{ description: 'article query' }],
    }
    expect(scrubAuthEvent(event)).toEqual(event)
    expect(event.extra).toEqual({ field: 'title' })
  })
})
