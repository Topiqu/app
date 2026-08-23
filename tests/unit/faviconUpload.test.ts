import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { FAVICON_MAX_BYTES, validateFaviconUpload } from '../../server/utils/faviconUpload'

const image = (width: number, height: number, format: 'png' | 'jpeg' | 'webp' = 'png') => {
  const source = sharp({ create: { width, height, channels: 4, background: '#4f46e5' } })
  if (format === 'jpeg') return source.jpeg().toBuffer()
  if (format === 'webp') return source.webp().toBuffer()
  return source.png().toBuffer()
}

describe('favicon upload validation', () => {
  it('accepts supported square images in the size range', async () => {
    expect(await validateFaviconUpload(await image(32, 32), 'image/png')).toBeNull()
    expect(await validateFaviconUpload(await image(512, 512, 'webp'), 'image/webp')).toBeNull()
  })

  it('rejects unsupported, non-square, out-of-range and oversized files', async () => {
    expect(await validateFaviconUpload(await image(64, 64), 'image/gif')).toBe('type')
    expect(await validateFaviconUpload(await image(64, 32), 'image/png')).toBe('square')
    expect(await validateFaviconUpload(await image(16, 16), 'image/png')).toBe('dimensions')
    expect(await validateFaviconUpload(await image(513, 513), 'image/png')).toBe('dimensions')
    expect(await validateFaviconUpload(new Uint8Array(FAVICON_MAX_BYTES + 1), 'image/png')).toBe('bytes')
  })
})
