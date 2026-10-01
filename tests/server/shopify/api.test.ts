// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shopifyGraphql, shopifyTokenRequest } from '../../../server/utils/shopify/api'

describe('Shopify API transport', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('SHOPIFY_CLIENT_ID', 'client')
    vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('requests expiring offline tokens and sends credentials only to the store host', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
          refresh_token_expires_in: 86400,
          scope: 'write_content',
        }),
      ),
    )
    await shopifyTokenRequest('store.myshopify.com', { code: 'code', expiring: '1' })
    expect(fetchMock.mock.calls[0]![0]).toBe('https://store.myshopify.com/admin/oauth/access_token')
    const request = fetchMock.mock.calls[0]![1]
    expect(request.redirect).toBe('error')
    expect(request.body.get('expiring')).toBe('1')
    expect(request.body.get('client_secret')).toBe('secret')
    await expect(shopifyTokenRequest('store.myshopify.com.evil.test', {})).rejects.toThrow('Invalid Shopify shop')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('distinguishes recoverable reads from an ambiguous mutation timeout', async () => {
    fetchMock.mockRejectedValue(new Error('token must not appear in errors'))
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'query {}')).rejects.toMatchObject({ code: 'RETRY' })
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'mutation {}', {}, true)).rejects.toMatchObject({
      code: 'UNCERTAIN',
      message: 'Shopify request could not be completed',
    })
  })

  it.each([401, 403])('requires reconnection for %s', async (status) => {
    fetchMock.mockResolvedValue(new Response('', { status }))
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'query {}')).rejects.toMatchObject({
      code: 'REAUTH_REQUIRED',
    })
  })

  it('retries throttling but never blindly retries a server failure after a mutation', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'mutation {}', {}, true)).rejects.toMatchObject({
      code: 'RETRY',
    })
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'mutation {}', {}, true)).rejects.toMatchObject({
      code: 'UNCERTAIN',
    })
  })

  it('does not assume a partially failed GraphQL mutation had no effect', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'internal server error' }] })))
    await expect(shopifyGraphql('store.myshopify.com', 'token', 'mutation {}', {}, true)).rejects.toMatchObject({
      code: 'UNCERTAIN',
    })
  })

  it('paces catalog pages using the store API budget', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ok: true },
          extensions: {
            cost: { requestedQueryCost: 300, throttleStatus: { currentlyAvailable: 100, restoreRate: 50 } },
          },
        }),
      ),
    )
    let completed = false
    const pending = shopifyGraphql('store.myshopify.com', 'token', 'query {}', {}, false, true).then((result) => {
      completed = true
      return result
    })
    await vi.advanceTimersByTimeAsync(3999)
    expect(completed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ ok: true })
  })
})
