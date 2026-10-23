// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPost,
  getAccessToken,
  getPersonalUrn,
  getPostMetrics,
  refreshAccessToken,
} from '../../../server/utils/linkedin/api'

const request = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.stubGlobal('fetch', request)
  request.mockReset()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LinkedIn create outcome', () => {
  it('never repeats an accepted response without an ID', async () => {
    request.mockImplementation(async () => new Response(null, { status: 201 }))
    const pending = createPost('offline-token', 'urn:li:person:offline', 'Offline content').catch(
      (error: unknown) => error,
    )
    await vi.runAllTimersAsync()
    const error = await pending
    expect(request).toHaveBeenCalledTimes(1)
    expect(error).toMatchObject({ outcome: 'unknown' })
  })

  it.each([
    [400, 'rejected'],
    [401, 'rejected'],
    [403, 'rejected'],
    [408, 'unknown'],
    [409, 'unknown'],
    [422, 'unknown'],
    [429, 'unknown'],
    [500, 'unknown'],
    [503, 'unknown'],
  ])('classifies HTTP %s without retrying or exposing provider bodies', async (status, outcome) => {
    const response = new Response('synthetic confidential provider body', { status })
    const cancel = vi.spyOn(response.body!, 'cancel')
    request.mockResolvedValue(response)
    await expect(createPost('offline-token', 'urn:li:person:offline', 'Offline content')).rejects.toMatchObject({
      outcome,
      httpStatus: status,
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('returns a confirmed URN and releases an unused response body', async () => {
    const response = new Response('unused', { status: 201, headers: { 'x-restli-id': 'urn:li:ugcPost:12345' } })
    const cancel = vi.spyOn(response.body!, 'cancel')
    request.mockResolvedValue(response)
    await expect(createPost('offline-token', 'urn:li:person:offline', 'Offline content')).resolves.toBe(
      'urn:li:ugcPost:12345',
    )
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('retains an interrupted request as unknown without a second POST', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    request.mockImplementation(
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('synthetic lost acknowledgement')), {
            once: true,
          })
        }),
    )
    const pending = createPost('offline-token', 'urn:li:person:offline', 'Offline content').catch(
      (error: unknown) => error,
    )
    deadline.abort()
    expect(await pending).toMatchObject({ outcome: 'unknown' })
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('LinkedIn read and token deadlines', () => {
  it.each([
    [
      'code exchange',
      () => getAccessToken('offline-code', 'https://example.invalid/callback', 'offline-id', 'offline-secret'),
      { access_token: 'offline', expires_in: 3600 },
    ],
    [
      'refresh',
      () => refreshAccessToken('offline-refresh', 'offline-id', 'offline-secret'),
      { access_token: 'offline', expires_in: 3600 },
    ],
    ['identity', () => getPersonalUrn('offline-token'), { sub: 'offline-person' }],
    ['metrics', () => getPostMetrics('offline-token', 'urn:li:share:123'), {}],
  ])('bounds %s without following redirects', async (_name, run, body) => {
    request.mockResolvedValue(Response.json(body))
    await run()
    expect(request.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal), redirect: 'error' })
  })

  it('rejects an oversized token body and cancels its stream', async () => {
    const response = new Response(JSON.stringify({ access_token: 'x'.repeat(70_000), expires_in: 3600 }), {
      headers: { 'content-length': '70000' },
    })
    const cancel = vi.spyOn(response.body!, 'cancel')
    request.mockResolvedValue(response)
    await expect(
      getAccessToken('offline-code', 'https://example.invalid/callback', 'offline-id', 'offline-secret'),
    ).rejects.toThrow()
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('includes identity-body consumption in its deadline and releases the reader', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    let response!: Response
    request.mockImplementation(async (_url, init) => {
      response = new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener('abort', () => controller.error(new Error('synthetic stalled body')), {
              once: true,
            })
          },
        }),
      )
      return response
    })
    const pending = getPersonalUrn('offline-token').catch((error: unknown) => error)
    await Promise.resolve()
    deadline.abort()
    expect(await pending).toBeInstanceOf(Error)
    expect(response.body?.locked).toBe(false)
  })

  it('rejects malformed token data without returning credentials or raw body details', async () => {
    request.mockResolvedValue(Response.json({ access_token: 'offline-secret-token', expires_in: 'invalid' }))
    await expect(refreshAccessToken('offline-refresh', 'offline-id', 'offline-secret')).rejects.toThrow(
      'LINKEDIN_TOKEN_INVALID',
    )
  })
})
