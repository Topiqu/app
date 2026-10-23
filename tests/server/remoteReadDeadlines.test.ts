// @vitest-environment node

import { createError } from 'h3'
import { createFetch } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { config } = vi.hoisted(() => ({ config: { turnstile: { secretKey: 'offline-secret' } } }))
mockNuxtImport('useRuntimeConfig', () => () => config)

const resolveGeo = async (ip: string) => (await import('../../server/utils/geo')).resolveGeo(ip)
const verifyTurnstile = async (event: never, token: string) =>
  (await import('../../server/utils/turnstile')).verifyTurnstile(event, token)
const refreshSearchConsoleAccess = async (token: string) =>
  (await import('../../server/utils/searchConsole/api')).refreshSearchConsoleAccess(token)
const listSearchConsoleSites = async (token: string) =>
  (await import('../../server/utils/searchConsole/api')).listSearchConsoleSites(token)

beforeEach(() => {
  vi.resetModules()
  config.turnstile.secretKey = 'offline-secret'
  vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_ID', 'offline-client')
  vi.stubEnv('GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET', 'offline-secret')
  vi.stubGlobal('useRuntimeConfig', () => ({ turnstile: { secretKey: 'offline-secret' } }))
  vi.stubGlobal('getIp', () => '93.184.216.34')
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineCachedEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('defineCachedFunction', (handler: unknown) => handler)
  vi.stubGlobal('getValidatedQuery', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse({ target: 'EUR' }),
  )
  vi.stubGlobal('usdCrossRate', () => 0.92)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getQuery', () => ({}))
  vi.stubGlobal('getPagination', () => ({ skip: 0, take: 10 }))
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('remote read deadlines', () => {
  it.each([
    [
      'Search Console token refresh',
      () => refreshSearchConsoleAccess('offline-refresh'),
      { access_token: 'offline-token' },
    ],
    ['Search Console read', () => listSearchConsoleSites('offline-token'), { siteEntry: [] }],
    [
      'Search Console code exchange',
      async () =>
        (await import('../../server/utils/searchConsole/api')).exchangeSearchConsoleCode(
          'offline-code',
          'https://example.invalid/callback',
        ),
      {},
    ],
    [
      'Search Console identity',
      async () => (await import('../../server/utils/searchConsole/api')).getGoogleIdentity('offline-token'),
      {},
    ],
    [
      'Search Console analytics',
      async () =>
        (await import('../../server/utils/searchConsole/api')).querySearchConsole(
          'offline-token',
          'sc-domain:example.invalid',
          '2026-01-01',
          '2026-01-02',
        ),
      { rows: [] },
    ],
    ['geolocation', () => resolveGeo('93.184.216.34'), { success: true, city: 'Prague' }],
    ['Turnstile', () => verifyTurnstile({} as never, 'offline-token'), { success: true }],
    [
      'CNB rates',
      async () => (await import('../../server/api/currency/index.get')).default({} as never),
      { rates: [] },
    ],
    ['Giphy', async () => (await import('../../server/api/gifs/index.get')).default({} as never), { data: [] }],
    [
      'Giphy categories',
      async () => {
        vi.stubGlobal('getQuery', () => ({ action: 'list-categories' }))
        return (await import('../../server/api/gifs/index.get')).default({} as never)
      },
      { data: [] },
    ],
  ])('sets a body-inclusive abort deadline and disables implicit retries for %s', async (_name, run, result) => {
    const request = vi.fn().mockResolvedValue(result)
    vi.stubGlobal('$fetch', request)
    await run()
    expect(request.mock.calls[0]?.[1]).toMatchObject({ retry: 0, signal: expect.any(AbortSignal) })
  })

  it('fails closed when the Turnstile body stalls after successful response headers', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    const transport = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () => controller.error(init.signal.reason), { once: true })
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    )
    vi.stubGlobal('$fetch', createFetch({ fetch: transport }))
    const verification = verifyTurnstile({} as never, 'offline-token')
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
    expect(transport.mock.calls[0]?.[1]?.signal).toBe(deadline.signal)
    deadline.abort(new DOMException('deadline', 'TimeoutError'))
    await expect(verification).resolves.toBe(false)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('preserves optional Turnstile configuration without making a remote call', async () => {
    config.turnstile.secretKey = ''
    const request = vi.fn()
    vi.stubGlobal('$fetch', request)
    await expect(verifyTurnstile({} as never, 'offline-token')).resolves.toBe(true)
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps geolocation optional and reports failure without retaining request details', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('synthetic-private-request-details')))
    await expect(resolveGeo('93.184.216.34')).resolves.toEqual({ city: null, region: null, country: null })
    expect(reportCaughtError).toHaveBeenCalledWith(
      'Geolocation lookup failed',
      expect.objectContaining({ message: 'GEO_LOOKUP_FAILED' }),
    )
  })
})
