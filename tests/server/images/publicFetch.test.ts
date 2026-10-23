import { gzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { lookup } from 'node:dns/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assertPublicHttpsUrl, fetchPublicUrl, readLimitedBody } from '../../../server/utils/images/publicFetch'

const { lookupMock, requestMock, resolverCancelMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  requestMock: vi.fn(),
  resolverCancelMock: vi.fn(),
}))
vi.mock('node:dns/promises', () => {
  class MockResolver {
    private answer?: Promise<Array<{ address: string; family: number }>>
    private cancelQuery!: (error: Error) => void
    private canceled = new Promise<never>((_resolve, reject) => {
      this.cancelQuery = reject
    })
    private addresses(hostname: string) {
      return (this.answer ??= Promise.race([lookupMock(hostname, { all: true }), this.canceled]))
    }
    resolve4(hostname: string) {
      return this.addresses(hostname).then((addresses) =>
        addresses.filter(({ family }) => family === 4).map(({ address }) => address),
      )
    }
    resolve6(hostname: string) {
      return this.addresses(hostname).then((addresses) =>
        addresses.filter(({ family }) => family === 6).map(({ address }) => address),
      )
    }
    cancel() {
      resolverCancelMock()
      this.cancelQuery(new Error('DNS canceled'))
    }
  }
  return { default: { lookup: lookupMock, Resolver: MockResolver }, lookup: lookupMock, Resolver: MockResolver }
})
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
  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  it('accepts a public HTTPS domain', async () => {
    await expect(assertPublicHttpsUrl('https://media.example.org/press/image.jpg')).resolves.toMatchObject({
      hostname: 'media.example.org',
    })
  })

  it('includes stalled DNS in the request deadline', async () => {
    vi.useFakeTimers()
    lookupMock.mockReturnValue(new Promise(() => {}))
    const rejected = expect(fetchPublicUrl('https://media.example.org/image.jpg', 100)).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(resolverCancelMock).toHaveBeenCalled()
    expect(requestMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }, 1000)

  it('shares one deadline across redirect DNS checks', async () => {
    vi.useFakeTimers()
    lookupMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 80)),
    )
    serve({ status: 302, headers: { location: 'https://cdn.example.org/asset' } })
    const rejected = expect(fetchPublicUrl('https://media.example.org/image.jpg', 100)).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(requestMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(80)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  it('cancels DNS and settles when the caller aborts', async () => {
    vi.useFakeTimers()
    lookupMock.mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()
    const rejected = expect(
      fetchPublicUrl('https://media.example.org/image.jpg', 100, controller.signal),
    ).rejects.toThrow('canceled')
    controller.abort(new Error('caller canceled'))
    await rejected
    expect(resolverCancelMock).toHaveBeenCalled()
    expect(requestMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    'http://media.example.org/image.jpg',
    'https://localhost/image.jpg',
    'https://127.0.0.1/image.jpg',
    'https://[::1]/image.jpg',
    'https://[::ffff:7f00:1]/image.jpg',
    'https://localhost./image.jpg',
    'https://metadata.internal/image.jpg',
    'https://metadata.internal./image.jpg',
    'https://user:password@media.example.org/image.jpg',
  ])('rejects unsafe target %s', async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow()
  })

  it('rejects domains resolving to private space', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
    await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
  })

  it.each(['::ffff:7f00:1', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:a00:1'])(
    'rejects private IPv4-mapped DNS address %s in hexadecimal form',
    async (address) => {
      vi.mocked(lookup).mockResolvedValue([{ address, family: 6 }] as never)
      await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
    },
  )

  it.each([
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '100.127.255.254',
    '127.0.0.1',
    '169.254.169.254',
    '172.31.255.255',
    '192.0.0.8',
    '192.0.0.170',
    '192.0.2.1',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::ffff:127.0.0.1',
    '::ffff:192.168.1.1',
    '::ffff:6440:1',
    '::',
    '0:0:0:0:0:0:0:1',
    'fc00::1',
    'FD12:3456::1',
    'fe80::1',
    'fe80::1%en0',
    'fec0::1',
    'ff02::1',
    '64:ff9b::a9fe:a9fe',
    '64:ff9b:1::1',
    '100::1',
    '2001::1',
    '2001:2::1',
    '2001:db8::1',
    '2002:7f00:1::1',
    '3fff::1',
    '5f00::1',
  ])('rejects a non-public or special-use DNS address %s', async (address) => {
    vi.mocked(lookup).mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }] as never)
    await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
  })

  it.each([
    ['8.8.8.8', 4],
    ['93.184.216.34', 4],
    ['100.128.0.1', 4],
    ['172.32.0.1', 4],
    ['192.0.0.9', 4],
    ['192.0.0.10', 4],
    ['2606:4700:4700::1111', 6],
    ['2001:4860:4860::8888', 6],
    ['::ffff:8.8.8.8', 6],
    ['::ffff:5db8:d822', 6],
  ])('accepts public DNS address %s', async (address, family) => {
    vi.mocked(lookup).mockResolvedValue([{ address, family }] as never)
    await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).resolves.toBeInstanceOf(URL)
  })

  it('rejects a mixed DNS answer before opening any connection', async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '::ffff:a9fe:a9fe', family: 6 },
    ] as never)
    await expect(fetchPublicUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('revalidates every redirect target before following it', async () => {
    serve(
      { status: 302, headers: { location: 'https://cdn.example.org/a.jpg' } },
      { status: 200, body: new Uint8Array([1]) },
    )
    await expect(fetchPublicUrl('https://press.example.org/asset')).resolves.toMatchObject({ status: 200 })
    expect(lookup).toHaveBeenCalledWith('press.example.org', { all: true })
    expect(lookup).toHaveBeenCalledWith('cdn.example.org', { all: true })
  })

  it('can prohibit redirects for a trusted-CDN-only caller', async () => {
    serve({ status: 302, headers: { location: 'https://elsewhere.example.org/image.jpg' } })
    await expect(
      fetchPublicUrl('https://cdn.example.org/image.jpg', 1000, undefined, { redirect: 'error' }),
    ).rejects.toThrow('redirects are not allowed')
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(lookup).not.toHaveBeenCalledWith('elsewhere.example.org', expect.anything())
  })

  it('disposes the deadline and parent-abort listener after a completed body', async () => {
    vi.useFakeTimers()
    const parent = new AbortController()
    serve({ status: 200, body: new Uint8Array([1, 2]) })
    const responsePromise = fetchPublicUrl('https://media.example.org/image.jpg', 1000, parent.signal)
    await vi.advanceTimersByTimeAsync(0)
    await readLimitedBody(await responsePromise, 100)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    const request = requestMock.mock.results[0]!.value
    parent.abort(new Error('late parent cancellation'))
    expect(request.destroy).not.toHaveBeenCalled()
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

  it.each(['constructor', '__proto__', 'toString'])(
    'treats unrecognized content encoding %s as opaque',
    async (encoding) => {
      requestMock.mockImplementation((_url, _options, callback) => {
        const request = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() })
        callback(
          Object.assign(Readable.from([Buffer.from('body')]), {
            statusCode: 200,
            headers: { 'content-encoding': encoding },
          }),
        )
        return request
      })
      const response = await fetchPublicUrl('https://media.example.org/image.jpg')
      expect(new TextDecoder().decode(await readLimitedBody(response, 100))).toBe('body')
    },
  )

  it('caps the decompressed byte count rather than the compressed body size', async () => {
    const compressed = gzipSync('a'.repeat(20_000))
    serve({
      status: 200,
      headers: { 'content-encoding': 'gzip', 'content-length': String(compressed.byteLength) },
      body: compressed,
    })
    const response = await fetchPublicUrl('https://media.example.org/image.jpg')
    await expect(readLimitedBody(response, 1000)).rejects.toThrow('too large')
    expect(response.body?.locked).toBe(false)
  })

  it('releases the reader when decompression fails', async () => {
    serve({ status: 200, headers: { 'content-encoding': 'gzip' }, body: Buffer.from('invalid gzip') })
    const response = await fetchPublicUrl('https://media.example.org/image.jpg')
    await expect(readLimitedBody(response, 1000)).rejects.toThrow()
    expect(response.body?.locked).toBe(false)
  })

  it('aborts a stalled response body and clears its request timeout', async () => {
    vi.useFakeTimers()
    const message = Object.assign(new Readable({ read() {} }), { statusCode: 200, headers: {} })
    const request = Object.assign(new EventEmitter(), {
      end: vi.fn(),
      destroy: vi.fn((error: Error) => {
        message.destroy(error)
        request.emit('error', error)
      }),
    })
    requestMock.mockImplementation((_url, _options, callback) => {
      queueMicrotask(() => callback(message))
      return request
    })
    const responsePromise = fetchPublicUrl('https://media.example.org/image.jpg', 100)
    await vi.advanceTimersByTimeAsync(0)
    const response = await responsePromise
    const rejected = expect(readLimitedBody(response, 1000)).rejects.toThrow('request timeout')

    await vi.advanceTimersByTimeAsync(100)

    await rejected
    expect(request.destroy).toHaveBeenCalledTimes(1)
    expect(message.destroyed).toBe(true)
    expect(response.body?.locked).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies byte-based backpressure before the caller starts consuming the body', async () => {
    let produced = 0
    const message = Object.assign(
      new Readable({
        highWaterMark: 1024,
        read() {
          if (produced < 20) {
            produced += 1
            this.push(Buffer.alloc(1024))
          }
        },
      }),
      { statusCode: 200, headers: {} },
    )
    requestMock.mockImplementation((_url, _options, callback) => {
      queueMicrotask(() => callback(message))
      return Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() })
    })
    const response = await fetchPublicUrl('https://media.example.org/image.jpg')
    try {
      await new Promise((resolve) => setImmediate(resolve))
      expect(produced).toBeGreaterThan(0)
      expect(produced).toBeLessThanOrEqual(4)
    } finally {
      await response.body?.cancel()
    }
    expect(message.destroyed).toBe(true)
  })

  it('stops streaming bodies above the byte limit', async () => {
    const response = new Response(new Uint8Array(12))
    await expect(readLimitedBody(response, 10)).rejects.toThrow('too large')
  })

  it('cancels the upstream body when Content-Length already exceeds the limit', async () => {
    const cancel = vi.fn()
    const response = new Response(new ReadableStream({ cancel }), { headers: { 'content-length': '20' } })
    await expect(readLimitedBody(response, 10)).rejects.toThrow('too large')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(response.body?.locked).toBe(false)
  })

  it('releases the reader after a successful bounded read', async () => {
    const response = new Response(new Uint8Array([1, 2]))
    await expect(readLimitedBody(response, 10)).resolves.toEqual(new Uint8Array([1, 2]))
    expect(response.body?.locked).toBe(false)
  })

  it('releases the reader after a byte-limit failure', async () => {
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start: (controller) => controller.enqueue(new Uint8Array(12)),
        cancel,
      }),
    )
    await expect(readLimitedBody(response, 10)).rejects.toThrow('too large')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(response.body?.locked).toBe(false)
  })
})
