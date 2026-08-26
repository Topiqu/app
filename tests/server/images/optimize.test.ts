import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { optimizeGeneratedImage } from '../../../server/utils/images/optimize'

describe('optimizeGeneratedImage', () => {
  it('converts generated images to a bounded WebP while preserving aspect ratio', async () => {
    const source = await sharp({
      create: { width: 1600, height: 1000, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer()

    const optimized = await optimizeGeneratedImage(source)
    const metadata = await sharp(optimized.data).metadata()

    expect(optimized).toMatchObject({ width: 1280, height: 800, contentType: 'image/webp', extension: 'webp' })
    expect(metadata).toMatchObject({ format: 'webp', width: 1280, height: 800 })
    expect(optimized.data.byteLength).toBeLessThan(source.byteLength)
  })

  it('never enlarges a small source', async () => {
    const source = await sharp({
      create: { width: 320, height: 200, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()

    expect(await optimizeGeneratedImage(source)).toMatchObject({ width: 320, height: 200 })
  })
})
