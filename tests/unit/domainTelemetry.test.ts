import { describe, expect, it } from 'vitest'

import { scrubDomainTelemetry } from '../../server/utils/domainTelemetry'
import { scrubAuthTransferBreadcrumb } from '../../shared/utils/authTelemetry'

describe('certificate request telemetry', () => {
  it('redacts handoff navigation URLs and HTTP payloads in browser breadcrumbs', () => {
    expect(
      scrubAuthTransferBreadcrumb({
        data: {
          to: 'https://blog.example.test/api/auth/transfer/complete?code=fixture',
          from: 'https://app.topiqu.com/en/auth-transfer',
          body: { proof: 'fixture' },
        },
      }),
    ).toEqual({
      data: {
        to: 'https://blog.example.test/api/auth/transfer/complete',
        from: 'https://app.topiqu.com/en/auth-transfer',
      },
    })
  })
  it('removes authentication handoff codes and browser proofs from telemetry', () => {
    const event = {
      request: {
        url: 'https://blog.example.test/api/auth/transfer/complete?code=fixture&request=fixture',
        data: { proof: 'fixture' },
      },
      breadcrumbs: [{ message: 'fixture' }],
    }
    expect(scrubDomainTelemetry(event)).toBe(true)
    expect(event).toEqual({ request: { url: 'https://blog.example.test/api/auth/transfer/complete' }, breadcrumbs: [] })
  })
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
