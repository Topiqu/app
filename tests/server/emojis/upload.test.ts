// @vitest-environment node

import sharp from 'sharp'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EMOJI_MAX_UPLOAD_BYTES } from '../../../shared/utils/uploadLimits'

const { analyze, put, remove } = vi.hoisted(() => ({ analyze: vi.fn(), put: vi.fn(), remove: vi.fn() }))
vi.mock('../../../server/utils/imageAnalysis', () => ({ analyzeImage: analyze }))
vi.mock('../../../server/utils/storage', () => ({ putToCdn: put, deleteFromCdn: remove }))

const setup = async (bytes: Uint8Array) => {
  vi.resetModules()
  analyze.mockReset().mockResolvedValue({ tags: [], moderation: 'clear' })
  put.mockReset().mockResolvedValue('https://cdn.example.org/uploads/emoji-offline.webp')
  remove.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'admin', role: 'admin', clientSiteId: 'tenant' } }))
  vi.stubGlobal('readMultipartFormData', async () => [
    { name: 'shortcode', data: Buffer.from('happy') },
    { name: 'file', filename: 'happy.png', type: 'image/png', data: Buffer.from(bytes) },
  ])
  const create = vi
    .fn()
    .mockResolvedValue({ id: 'emoji', shortcode: 'happy', imageUrl: 'https://cdn.example.org/emoji.webp' })
  vi.stubGlobal('getEnhancedPrisma', async () => ({ emoji: { findFirst: vi.fn().mockResolvedValue(null), create } }))
  vi.stubGlobal('isUniqueViolation', (error: { code?: string }) => error.code === 'P2002')
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  const { default: handler } = await import('../../../server/api/emojis/index.post')
  return { run: () => handler({} as never), create }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('emoji upload validation', () => {
  it('rejects oversized bytes before moderation or storage', async () => {
    const { run } = await setup(new Uint8Array(EMOJI_MAX_UPLOAD_BYTES + 1))
    await expect(run()).rejects.toMatchObject({ statusCode: 413 })
    expect(analyze).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
  })

  it('rejects spoofed image MIME before moderation', async () => {
    const { run } = await setup(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'))
    await expect(run()).rejects.toMatchObject({ statusCode: 415 })
    expect(analyze).not.toHaveBeenCalled()
  })

  it('preserves animated emoji while moderating a bounded JPEG frame', async () => {
    const pixels = Buffer.concat([Buffer.alloc(4 * 4 * 3, 40), Buffer.alloc(4 * 4 * 3, 200)])
    const animation = await sharp(pixels, { raw: { width: 4, height: 8, channels: 3, pageHeight: 4 } })
      .gif({ delay: [100, 100], loop: 0 })
      .toBuffer()
    const { run } = await setup(animation)
    await run()
    const stored = await sharp(put.mock.calls[0]![1], { animated: true }).metadata()
    const moderated = await sharp(analyze.mock.calls[0]![0]).metadata()
    expect(stored).toMatchObject({ format: 'webp', pages: 2 })
    expect(moderated.format).toBe('jpeg')
    expect(moderated.width).toBeLessThanOrEqual(128)
    expect(moderated.height).toBeLessThanOrEqual(128)
  })

  it('does not store or persist an emoji rejected by moderation', async () => {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } })
      .png()
      .toBuffer()
    const { run, create } = await setup(bytes)
    analyze.mockRejectedValue(createError({ statusCode: 422 }))
    await expect(run()).rejects.toMatchObject({ statusCode: 422 })
    expect(put).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('removes exactly the newly uploaded object when creation loses a shortcode race', async () => {
    const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'blue' } })
      .png()
      .toBuffer()
    const { run, create } = await setup(bytes)
    create.mockRejectedValue({ code: 'P2002' })
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
    expect(remove).toHaveBeenCalledWith(put.mock.calls[0]![0], 'uploads/')
  })
})
