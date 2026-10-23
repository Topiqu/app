// @vitest-environment node
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

const initialization = vi.hoisted(() => vi.fn())
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { sentry: { dsn: '', environment: 'test' } } }))
vi.mock('@sentry/nuxt', async (original) => ({
  ...(await original<typeof import('@sentry/nuxt')>()),
  init: initialization,
}))

const sdk = await vi.importActual<typeof import('@sentry/nuxt')>('@sentry/nuxt')

afterEach(async () => {
  await sdk.close()
  initialization.mockClear()
  vi.unstubAllGlobals()
})

describe.each(['server', 'client'] as const)('%s telemetry SDK transport', (side) => {
  const initialize = async () => {
    if (side === 'server') await import('../../sentry.server.config')
    else await import('../../sentry.client.config')
    const options = initialization.mock.calls.at(-1)?.[0] as Parameters<typeof sdk.init>[0]
    expect(options).toBeDefined()
    const envelopes: unknown[] = []
    sdk.init({
      ...options,
      dsn: 'https://public@telemetry.invalid/1',
      enabled: true,
      tracesSampleRate: 1,
      sendClientReports: false,
      defaultIntegrations: false,
      transport: () => ({
        send: async (envelope) => {
          envelopes.push(envelope)
          return { statusCode: 200 }
        },
        flush: async () => true,
      }),
    })
    return envelopes
  }

  it('does not export automatic account, cookie, header, query or body data', async () => {
    const envelopes = await initialize()
    sdk.withScope((scope) => {
      scope.setSDKProcessingMetadata({
        normalizedRequest: {
          method: 'POST',
          url: 'https://tenant.invalid/api/articles?search=private-query',
          headers: { authorization: 'private-header', cookie: 'session=private-cookie' },
          cookies: { session: 'private-cookie' },
          data: { article: 'private-body' },
        },
        ipAddress: '192.0.2.123',
      })
      sdk.captureException(new Error('Article operation failed'))
    })
    expect(await sdk.flush()).toBe(true)
    const serialized = JSON.stringify(envelopes)
    expect(serialized).toContain('Article operation failed')
    for (const secret of ['private-query', 'private-header', 'private-cookie', 'private-body', '192.0.2.123'])
      expect(serialized).not.toContain(secret)
  })

  it('keeps transaction redaction active before envelopes leave the SDK', async () => {
    // Reuse this side's config module while retaining its original initialization options.
    vi.resetModules()
    const envelopes = await initialize()
    sdk.startSpanManual(
      { name: 'GET /api/auth/transfer/consume?request=private-transfer', op: 'http.server' },
      (span) => {
        span.setAttribute('auth.response', 'private-transfer')
        span.end()
      },
    )
    expect(await sdk.flush()).toBe(true)
    const serialized = JSON.stringify(envelopes)
    expect(serialized).toContain('transaction')
    expect(serialized).toContain('/api/auth/transfer/consume')
    expect(serialized).not.toContain('private-transfer')
  })
})
