// @vitest-environment node
import type { Nitro } from 'nitropack'

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IMAGE_MAX_UPLOAD_BYTES } from '../../shared/utils/uploadLimits'

interface FetchOptions {
  signal: AbortSignal
  headers?: Record<string, string>
  isBlockedAddress?: (address: string) => boolean
}

async function installedFetch(upstream: (url: string, options: FetchOptions) => Promise<Response>) {
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
  const { default: config } = await import('../../nuxt.config')
  const original = fileURLToPath(
    new URL('../../node_modules/nuxt-og-image/dist/runtime/server/og-image/bindings/fetch/node.js', import.meta.url),
  )
  const alias: Record<string, string> = { '#og-image/bindings/fetch': original }
  const nitro = { options: { alias, handlers: [] } } as unknown as Nitro
  await config.nitro!.hooks!['build:before']!(nitro)
  vi.stubGlobal('__topiquOgFetchFixture', upstream)
  const bundled = await build({
    entryPoints: [
      fileURLToPath(new URL('../../node_modules/nuxt-og-image/dist/runtime/server/util/ssrf.js', import.meta.url)),
    ],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: [
      {
        name: 'installed-og-fetch-boundary',
        setup(builder) {
          builder.onResolve({ filter: /^#/ }, ({ path }) => {
            if (alias[path] === original) return { path: 'upstream', namespace: 'og-fetch-boundary' }
            if (alias[path]) return { path: alias[path] }
          })
          builder.onLoad({ filter: /.*/, namespace: 'og-fetch-boundary' }, () => ({
            contents: 'export const guardedFetch = (...args) => globalThis.__topiquOgFetchFixture(...args)',
            loader: 'js',
          }))
        },
      },
    ],
  })
  const source = `${bundled.outputFiles[0]!.text}\n// Isolated fixture ${crypto.randomUUID()}`
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return (await import(/* @vite-ignore */ url)) as {
    fetchWithRedirectValidation: (
      url: string,
      options: { timeout: number; headers?: Record<string, string>; signal?: AbortSignal },
    ) => Promise<ArrayBuffer | null>
  }
}

function streamed(chunks: Uint8Array[], headers: Record<string, string> = {}, status = 200) {
  const cancel = vi.fn()
  let pulls = 0
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[pulls++]
        if (chunk) controller.enqueue(chunk)
        else controller.close()
      },
      cancel,
    },
    { highWaterMark: 0 },
  )
  return {
    body,
    cancel,
    get pulls() {
      return pulls
    },
    response: new Response(body, { status, headers }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('installed OG image guarded fetch byte boundary', () => {
  it.each([undefined, '1'])(
    'rejects actual oversized streams with Content-Length %s and releases upstream',
    async (length) => {
      const response = streamed(
        [new Uint8Array(8 * 1024 * 1024), new Uint8Array(8 * 1024 * 1024)],
        length === undefined ? {} : { 'content-length': length },
      )
      const upstream = vi.fn().mockResolvedValue(response.response)
      const { fetchWithRedirectValidation } = await installedFetch(upstream)
      const result = await fetchWithRedirectValidation('https://og-fixture.example/cover.png', { timeout: 1000 })
      expect(result === null).toBe(true)
      await vi.waitFor(() => expect(response.cancel).toHaveBeenCalledTimes(1))
      await vi.waitFor(() => expect(response.body.locked).toBe(false))
      expect(response.pulls).toBeLessThanOrEqual(2)
    },
  )

  it('rejects an oversized declared body without pulling it', async () => {
    const response = streamed([new Uint8Array(1)], { 'content-length': String(IMAGE_MAX_UPLOAD_BYTES + 1) })
    const { fetchWithRedirectValidation } = await installedFetch(vi.fn().mockResolvedValue(response.response))
    expect(
      (await fetchWithRedirectValidation('https://og-fixture.example/cover.png', { timeout: 1000 })) === null,
    ).toBe(true)
    expect(response.pulls).toBe(0)
    expect(response.cancel).toHaveBeenCalledTimes(1)
    expect(response.body.locked).toBe(false)
  })

  it('accepts exactly the supported image limit without changing bytes or leaving a reader locked', async () => {
    const bytes = new Uint8Array(IMAGE_MAX_UPLOAD_BYTES)
    bytes[0] = 137
    bytes[bytes.length - 1] = 42
    const response = streamed([bytes], { 'content-length': String(bytes.byteLength), 'content-type': 'image/png' })
    const headers = { 'x-og-fixture': 'safe' }
    const upstream = vi.fn().mockResolvedValue(response.response)
    const { fetchWithRedirectValidation } = await installedFetch(upstream)
    const result = await fetchWithRedirectValidation('https://og-fixture.example/cover.png', { timeout: 1000, headers })
    expect(result?.byteLength).toBe(bytes.byteLength)
    expect(Buffer.compare(Buffer.from(result!), Buffer.from(bytes))).toBe(0)
    await vi.waitFor(() => expect(response.body.locked).toBe(false))
    expect(response.cancel).not.toHaveBeenCalled()
    const options = upstream.mock.calls[0]![1] as FetchOptions
    expect(options.headers).toBe(headers)
    expect(options.isBlockedAddress?.('127.0.0.1')).toBe(true)
    expect(options.isBlockedAddress?.('93.184.216.34')).toBe(false)
    expect(options.signal.aborted).toBe(false)
  })

  it('preserves redirect cancellation, response status/headers and per-hop address checks', async () => {
    const redirect = streamed(
      [new Uint8Array(1)],
      {
        location: 'https://og-second.example/cover.png',
        'content-length': String(IMAGE_MAX_UPLOAD_BYTES + 1),
      },
      302,
    )
    const image = streamed([new Uint8Array([137, 80, 78, 71])])
    const upstream = vi.fn().mockResolvedValueOnce(redirect.response).mockResolvedValueOnce(image.response)
    const { fetchWithRedirectValidation } = await installedFetch(upstream)
    const result = await fetchWithRedirectValidation('https://og-first.example/cover.png', { timeout: 1000 })
    expect(new Uint8Array(result!)).toEqual(new Uint8Array([137, 80, 78, 71]))
    expect(upstream.mock.calls.map(([url]) => url)).toEqual([
      'https://og-first.example/cover.png',
      'https://og-second.example/cover.png',
    ])
    expect(redirect.cancel).toHaveBeenCalledTimes(1)
    expect(redirect.pulls).toBe(0)
    expect(upstream.mock.calls[0]![1].signal).toBe(upstream.mock.calls[1]![1].signal)
    expect(upstream.mock.calls[1]![1].isBlockedAddress('10.0.0.1')).toBe(true)
  })

  it('still refuses private initial and redirect URLs before opening their connection', async () => {
    const redirect = streamed([], { location: 'http://169.254.169.254/metadata' }, 302)
    const upstream = vi.fn().mockResolvedValue(redirect.response)
    const { fetchWithRedirectValidation } = await installedFetch(upstream)
    await expect(fetchWithRedirectValidation('http://127.0.0.1/secret', { timeout: 1000 })).resolves.toBeNull()
    expect(upstream).not.toHaveBeenCalled()
    await expect(
      fetchWithRedirectValidation('https://og-fixture.example/redirect', { timeout: 1000 }),
    ).resolves.toBeNull()
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(redirect.cancel).toHaveBeenCalledTimes(1)
  })

  it('preserves non-success cancellation and null-body responses', async () => {
    const failure = streamed([new Uint8Array(1)], { 'content-length': String(IMAGE_MAX_UPLOAD_BYTES + 1) }, 404)
    const upstream = vi
      .fn()
      .mockResolvedValueOnce(failure.response)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { fetchWithRedirectValidation } = await installedFetch(upstream)
    await expect(
      fetchWithRedirectValidation('https://og-fixture.example/missing', { timeout: 1000 }),
    ).resolves.toBeNull()
    expect(failure.cancel).toHaveBeenCalledTimes(1)
    expect(failure.pulls).toBe(0)
    expect((await fetchWithRedirectValidation('https://og-fixture.example/empty', { timeout: 1000 }))?.byteLength).toBe(
      0,
    )
  })

  it('propagates the existing abort signal to the transport and releases a stalled upstream reader', async () => {
    const aborted = new AbortController()
    let response!: ReturnType<typeof streamed>
    let observedSignal!: AbortSignal
    const upstream = vi.fn(async (_url: string, options: FetchOptions) => {
      observedSignal = options.signal
      let streamController!: ReadableStreamDefaultController<Uint8Array>
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller
        },
      })
      options.signal.addEventListener('abort', () => streamController.error(new Error('Synthetic timeout')), {
        once: true,
      })
      response = { body, response: new Response(body), cancel: vi.fn(), pulls: 0 }
      return response.response
    })
    const { fetchWithRedirectValidation } = await installedFetch(upstream)
    const reading = fetchWithRedirectValidation('https://og-fixture.example/stalled', {
      timeout: 1000,
      signal: aborted.signal,
    })
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1))
    aborted.abort()
    await expect(reading).resolves.toBeNull()
    expect(observedSignal.aborted).toBe(true)
    await vi.waitFor(() => expect(response.body.locked).toBe(false))
  })

  it('does not expose or retain a failed response stream', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('Synthetic read failure'))
      },
    })
    const { fetchWithRedirectValidation } = await installedFetch(vi.fn().mockResolvedValue(new Response(body)))
    await expect(
      fetchWithRedirectValidation('https://og-fixture.example/broken', { timeout: 1000 }),
    ).resolves.toBeNull()
    await vi.waitFor(() => expect(body.locked).toBe(false))
  })

  it('releases the upstream reader even when cancellation itself rejects', async () => {
    let pulls = 0
    const cancel = vi.fn().mockRejectedValue(new Error('Synthetic cancellation failure'))
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++
          controller.enqueue(new Uint8Array(8 * 1024 * 1024))
        },
        cancel,
      },
      { highWaterMark: 0 },
    )
    const { fetchWithRedirectValidation } = await installedFetch(vi.fn().mockResolvedValue(new Response(body)))
    await expect(
      fetchWithRedirectValidation('https://og-fixture.example/too-large', { timeout: 1000 }),
    ).resolves.toBeNull()
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(body.locked).toBe(false))
    expect(pulls).toBeLessThanOrEqual(2)
  })
})
