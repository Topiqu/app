import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateImage } from '../../../server/utils/ai/image'

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('ai', () => ({ generateImage: generate }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  generate.mockReset()
})

describe('generated image storage', () => {
  it('keeps concurrent completions distinct even at the same millisecond and slot', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000)
    vi.stubGlobal('aiImageModel', () => 'offline-model')
    vi.stubGlobal('hashMedia', (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex'))
    const images = await Promise.all(
      ['red', 'blue'].map((background) =>
        sharp({ create: { width: 8, height: 8, channels: 3, background } })
          .png()
          .toBuffer(),
      ),
    )
    for (const bytes of images) generate.mockResolvedValueOnce({ image: { uint8Array: bytes } })
    const objects = new Map<string, Uint8Array>()
    const put = vi.fn(async (key: string, bytes: Uint8Array) => {
      objects.set(key, bytes)
      return `https://cdn.example.invalid/${key}`
    })
    vi.stubGlobal('putToCdn', put)

    const results = await Promise.all([
      generateImage('red scene', { filenameSuffix: '0' }),
      generateImage('blue scene', { filenameSuffix: '0' }),
    ])

    expect(new Set(results.map((result) => result.storageKey)).size).toBe(2)
    expect(new Set(results.map((result) => result.url)).size).toBe(2)
    expect(objects.size).toBe(2)
    expect(results[0]!.contentHash).not.toBe(results[1]!.contentHash)
    for (const result of results) {
      expect(objects.get(result.storageKey)).toHaveLength(result.sizeBytes)
      expect(result.mimeType).toBe('image/webp')
    }
    expect(put).toHaveBeenCalledWith(expect.any(String), expect.any(Uint8Array), 'image/webp', undefined, {
      cacheControl: 'public, max-age=31536000, immutable',
    })
  })

  it('stores generated article media in the supplied tenant namespace', async () => {
    vi.stubGlobal('aiImageModel', () => 'offline-model')
    vi.stubGlobal('hashMedia', () => 'generated-content-hash')
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
      .png()
      .toBuffer()
    generate.mockResolvedValue({ image: { uint8Array: bytes } })
    const put = vi.fn(async (key: string) => `https://cdn.example.invalid/${key}`)
    vi.stubGlobal('putToCdn', put)

    const result = await generateImage('an editorial scene', { clientSiteId: 'tenant-a' })

    expect(result.storageKey).toMatch(/^article-images\/tenant-a\/article-.*\.webp$/)
    expect(put).toHaveBeenCalledWith(result.storageKey, expect.any(Uint8Array), 'image/webp', undefined, {
      cacheControl: 'public, max-age=31536000, immutable',
    })
  })

  it('rejects an invalid tenant namespace before asking the provider for an image', async () => {
    await expect(generateImage('an editorial scene', { clientSiteId: '../tenant-b' })).rejects.toThrow('tenant')
    expect(generate).not.toHaveBeenCalled()
  })
})
