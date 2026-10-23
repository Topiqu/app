// @vitest-environment node

import sharp from 'sharp'
import { createError } from 'h3'
import { Writable } from 'node:stream'
import { EventEmitter } from 'node:events'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchImage } = vi.hoisted(() => ({ fetchImage: vi.fn() }))
vi.mock('../../../server/utils/images/publicFetch', async (original) => ({
  ...(await original<typeof import('../../../server/utils/images/publicFetch')>()),
  fetchPublicUrl: fetchImage,
}))
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { cdnUrl: 'https://cdn.example.org/' } }))

const article = (overrides = {}) => ({
  id: 'article-1',
  slug: 'clanek',
  title: 'Český článek',
  content: '<p>First paragraph &amp; one.</p><p>Second paragraph.</p>',
  imageUrl: null,
  createdAt: new Date('2026-01-02T10:00:00Z'),
  status: 'draft',
  ...overrides,
})

const setup = async (ids: unknown = ['article-1']) => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireTenantScope', async () => ({
    user: { id: 'author', language: 'en' },
    membership: { clientSiteId: 'tenant' },
  }))
  vi.stubGlobal('hasTenantScope', () => false)
  vi.stubGlobal('readBody', async () => ({ ids }))
  vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('isCdnImageUrl', (url: string) => new URL(url).host === 'cdn.example.org')
  const findMany = vi.fn().mockResolvedValue([])
  vi.stubGlobal('getEnhancedPrisma', async () => ({ article: { findMany } }))
  const chunks: Buffer[] = []
  const res = Object.assign(
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk)
        callback()
      },
    }),
    { setHeader: vi.fn(), headersSent: false },
  )
  const event = { node: { req: new EventEmitter(), res } }
  const { default: run } = await import('../../../server/api/articles/export-pdf.post')
  return { run: () => run(event as never), findMany, res, event, chunks }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  fetchImage.mockReset()
})

describe('PDF export resource bounds', () => {
  it('rejects oversized selections before querying article contents', async () => {
    const { run, findMany } = await setup(Array.from({ length: 101 }, (_, i) => `article-${i}`))
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('deduplicates the selection while retaining tenant and author restrictions', async () => {
    const { run, findMany } = await setup(['article-1', 'article-1'])
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['article-1'] },
          clientSiteId: 'tenant',
          OR: [{ userId: 'author' }, { user: { role: 'ai' } }],
        },
      }),
    )
  })

  it('rate limits authenticated export work before loading content', async () => {
    const { run, findMany } = await setup()
    vi.mocked(consumeRateLimit).mockResolvedValue(false)
    await expect(run()).rejects.toMatchObject({ statusCode: 429 })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('bounds simultaneous exports and releases the slot after a database failure', async () => {
    const { run, findMany } = await setup()
    let release!: (value: never[]) => void
    findMany.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const requests = Array.from({ length: 4 }, () => run())
    try {
      await vi.waitFor(() => expect(findMany).toHaveBeenCalledTimes(4))
      const fifth = run()
      requests.push(fifth)
      void fifth.catch(() => {})
      await new Promise((resolve) => setImmediate(resolve))
      expect(findMany).toHaveBeenCalledTimes(4)
      await expect(fifth).rejects.toMatchObject({ statusCode: 429 })
    } finally {
      release([])
      await Promise.allSettled(requests)
    }
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
    expect(findMany).toHaveBeenCalledTimes(5)
  })

  it('rejects legacy oversized contents before constructing a document', async () => {
    const { run, findMany, res } = await setup()
    findMany.mockResolvedValue([article({ content: 'x'.repeat(100_001) })])
    await expect(run()).rejects.toMatchObject({ statusCode: 413 })
    expect(res.setHeader).not.toHaveBeenCalled()
  })

  it('writes a complete PDF and leaves no export timer running', async () => {
    const { run, findMany, res, chunks } = await setup()
    findMany.mockResolvedValue([article()])
    vi.useFakeTimers()
    await expect(run()).resolves.toBeNull()
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-')
    expect(Buffer.concat(chunks).toString('latin1')).toContain('%%EOF')
    expect(res.writableFinished).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a stalled destination and settles when the export deadline expires', async () => {
    const { run, findMany, res } = await setup()
    findMany.mockResolvedValue([article()])
    res._write = () => {}
    vi.useFakeTimers()
    const result = run()
    await vi.waitFor(() => expect(res.setHeader).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(result).resolves.toBeNull()
    expect(res.destroyed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds CDN image streaming and skips an oversized image without losing the PDF', async () => {
    const { run, findMany, chunks } = await setup()
    findMany.mockResolvedValue([article({ imageUrl: 'https://cdn.example.org/cover.webp' })])
    const cancel = vi.fn()
    fetchImage.mockResolvedValue(
      new Response(new ReadableStream({ cancel }), { headers: { 'content-length': '3000001' } }),
    )
    await expect(run()).resolves.toBeNull()
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(fetchImage).toHaveBeenCalledWith(expect.any(URL), 5000, expect.any(AbortSignal), { redirect: 'error' })
    expect(Buffer.concat(chunks).toString('latin1')).toContain('%%EOF')
  })

  it('converts a bounded WebP cover to a PDF-compatible image', async () => {
    const { run, findMany, chunks } = await setup()
    findMany.mockResolvedValue([article({ imageUrl: 'https://cdn.example.org/cover.webp' })])
    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'blue' } })
      .webp()
      .toBuffer()
    fetchImage.mockResolvedValue(new Response(new Uint8Array(bytes)))
    await expect(run()).resolves.toBeNull()
    expect(Buffer.concat(chunks).toString('latin1')).toContain('/Subtype /Image')
  })

  it('aborts an in-flight image request when the client disconnects', async () => {
    const { run, findMany, res } = await setup()
    findMany.mockResolvedValue([article({ imageUrl: 'https://cdn.example.org/cover.webp' })])
    let imageSignal: AbortSignal | undefined
    fetchImage.mockImplementation((_url, _timeout, signal: AbortSignal) => {
      imageSignal = signal
      return new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      )
    })
    const result = run()
    await vi.waitFor(() => expect(fetchImage).toHaveBeenCalledTimes(1))
    res.destroy()
    await expect(result).resolves.toBeNull()
    expect(imageSignal?.aborted).toBe(true)
  })

  it('settles and reports a destination write error without an unhandled stream failure', async () => {
    const { run, findMany, res } = await setup()
    findMany.mockResolvedValue([article()])
    res._write = (_chunk, _encoding, callback) => callback(new Error('destination unavailable'))
    await expect(run()).resolves.toBeNull()
    expect(res.destroyed).toBe(true)
    expect(reportCaughtError).toHaveBeenCalledWith('PDF export interrupted', expect.any(Error), {
      clientSiteId: 'tenant',
    })
  })
})
