import { describe, expect, it } from 'vitest'

import { scrubDomainTelemetry } from '../../server/utils/domainTelemetry'

describe('certificate request telemetry', () => {
  it('removes bodies, headers, cookies, extras and HTTP breadcrumbs while retaining safe error identity', () => {
    const event = {
      request: {
        url: 'https://app.example.com/api/domain/certificate',
        data: { privateKey: 'fixture' },
        cookies: 'fixture',
        headers: { authorization: 'fixture' },
      },
      extra: { body: 'fixture' },
      breadcrumbs: [{ message: 'fixture' }],
      message: 'CERTIFICATE_INVALID',
    }
    expect(scrubDomainTelemetry(event)).toBe(true)
    expect(event).toEqual({
      request: { url: 'https://app.example.com/api/domain/certificate' },
      breadcrumbs: [],
      message: 'CERTIFICATE_INVALID',
    })
  })
  it('leaves unrelated requests unchanged', () => {
    const event = { request: { url: 'https://app.example.com/api/domain', data: 'fixture' } }
    expect(scrubDomainTelemetry(event)).toBe(false)
    expect(event.request.data).toBe('fixture')
  })
})
