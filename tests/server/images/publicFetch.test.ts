import { gzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { lookup } from 'node:dns/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assertPublicHttpsUrl, fetchPublicUrl, readLimitedBody } from '../../../server/utils/images/publicFetch'

const { lookupMock, requestMock } = vi.hoisted(() => ({ lookupMock: vi.fn(), requestMock: vi.fn() }))
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }))
vi.mock('node:https', () => ({ default: { request: requestMock }, request: requestMock }))

type Reply = { status: number; headers?: Record<string, string>; body?: Uint8Array }

/** Answers each https.request with the next reply and records the pinned lookup it was given. */
const serve = (...replies: Reply[]) => {
  const pinned: string[] = []
  requestMock.mockImplementation((_url, options, callback) => {
    const reply = replies.shift()!
    const request = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() })
    options.lookup('ignored.example', {}, (_error: unknown, address: string) => pinned.push(address))
    queueMicrotask(() => {
      const message = Object.assign(Readable.from(reply.body ? [Buffer.from(reply.body)] : []), {
        statusCode: reply.status,
        headers: reply.headers ?? {},
      })
      callback(message)
    })
    return request
  })
  return pinned
}

describe('official media network guard', () => {
  beforeEach(() => vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never))
  afterEach(() => vi.resetAllMocks())

  it('accepts a public HTTPS domain', async () => {
    await expect(assertPublicHttpsUrl('https://media.example.org/press/image.jpg')).resolves.toMatchObject({
      hostname: 'media.example.org',
    })
  })

  it.each([
    'http://media.example.org/image.jpg',
    'https://localhost/image.jpg',
    'https://127.0.0.1/image.jpg',
    'https://metadata.internal/image.jpg',
    'https://user:password@media.example.org/image.jpg',
  ])('rejects unsafe target %s', async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow()
  })

  it('rejects domains resolving to private space', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
    await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
  })

  it('revalidates every redirect target before following it', async () => {
    serve({ status: 302, headers: { location: 'https://cdn.example.org/a.jpg' } }, { status: 200, body: new Uint8Array([1]) })
    await expect(fetchPublicUrl('https://press.example.org/asset')).resolves.toMatchObject({ status: 200 })
    expect(lookup).toHaveBeenCalledWith('press.example.org', { all: true })
    expect(lookup).toHaveBeenCalledWith('cdn.example.org', { all: true })
  })

  it('blocks a redirect when its destination resolves privately', async () => {
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }] as never)
    serve({ status: 302, headers: { location: 'https://private.example.org/a' } })
    await expect(fetchPublicUrl('https://press.example.org/asset')).rejects.toThrow('non-public')
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  it('connects to the validated address even if DNS rebinds after the check', async () => {
    const pinned = serve({ status: 200, body: new Uint8Array([1]) })
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as never)
      .mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
    await fetchPublicUrl('https://press.example.org/asset')
    expect(pinned).toEqual(['93.184.216.34'])
  })

  it('decompresses gzip bodies and drops the compressed length', async () => {
    const text = 'Compressed press page body'
    const compressed = gzipSync(text)
    serve({
      status: 200,
      headers: { 'content-encoding': 'gzip', 'content-length': String(compressed.byteLength) },
      body: compressed,
    })
    const response = await fetchPublicUrl('https://press.example.org/asset')
    expect(response.headers.get('content-length')).toBeNull()
    expect(new TextDecoder().decode(await readLimitedBody(response, 1000))).toBe(text)
  })

  it('stops streaming bodies above the byte limit', async () => {
    const response = new Response(new Uint8Array(12))
    await expect(readLimitedBody(response, 10)).rejects.toThrow('too large')
  })
})
