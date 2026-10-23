// @vitest-environment node

import { join } from 'node:path'
import { createApp, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { runtime } = vi.hoisted(() => ({
  runtime: {
    app: { baseURL: '/' },
    ipx: {
      baseURL: '/_ipx',
      fs: { dir: '', maxAge: 86_400 },
      http: { domains: ['cdn.example.test'], maxAge: 31_536_000, ignoreCacheControl: true },
      alias: { '/fixture.png': '/topik_normal_rm.png' },
    },
  },
}))
vi.mock('nitropack/runtime', () => ({ useRuntimeConfig: () => runtime }))

beforeEach(() => {
  vi.resetModules()
  runtime.app.baseURL = '/'
  runtime.ipx.baseURL = '/_ipx'
  runtime.ipx.fs.dir = join(process.cwd(), 'public')
})

const requestHandler = async () => {
  const { default: handler } = await import('../../server/runtime/ipx')
  const handle = toWebHandler(createApp().use(handler))
  return (request: Request) => {
    // Nitro's localFetch supplies Host when translating the native Bun request.
    const headers = new Headers(request.headers)
    headers.set('host', new URL(request.url).host)
    return handle(new Request(request, { headers }))
  }
}

describe('IPX on the Nitro 2 Fetch boundary', () => {
  it('preserves transformed bytes, MIME, cache policy and security headers', async () => {
    const handle = await requestHandler()
    const response = await handle(new Request('http://localhost/_ipx/w_80&f_webp&q_82/fixture.png'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toContain('max-age=86400')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(response.headers.get('etag')).toBeTruthy()
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
  })

  it('preserves conditional GET and HEAD semantics', async () => {
    const handle = await requestHandler()
    const url = 'http://localhost/_ipx/w_80&f_webp&q_82/topik_normal_rm.png'
    const image = await handle(new Request(url))
    const conditional = await handle(new Request(url, { headers: { 'if-none-match': image.headers.get('etag')! } }))
    expect(conditional.status).toBe(304)
    expect((await conditional.arrayBuffer()).byteLength).toBe(0)
    const head = await handle(new Request(url, { method: 'HEAD' }))
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toBe('image/webp')
    expect((await head.arrayBuffer()).byteLength).toBe(0)
  })

  it('rejects external hosts and private or escaped filesystem paths before remote IO', async () => {
    const handle = await requestHandler()
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Remote IO is forbidden in this test'))
    try {
      for (const path of [
        '/_ipx/w_80/https://example.invalid/private.png',
        '/_ipx/w_80/https://127.0.0.1/private.png',
        '/_ipx/w_80/%2e%2e%2fpackage.json',
        '/_ipx/w_80/not-a-fixture.png',
      ]) {
        const response = await handle(new Request(`http://localhost${path}`))
        expect([403, 404]).toContain(response.status)
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })

  it('resolves the configured application base and IPX mount without losing modifiers', async () => {
    runtime.app.baseURL = '/publication/'
    runtime.ipx.baseURL = '/images/'
    const handle = await requestHandler()
    const response = await handle(new Request('http://localhost/publication/images/w_80&f_webp/fixture.png'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
  })
})
