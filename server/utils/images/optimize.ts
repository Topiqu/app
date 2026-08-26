import sharp from 'sharp'

export const IMMUTABLE_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

export const optimizeGeneratedImage = async (input: Uint8Array) => {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true })

  return {
    data: new Uint8Array(data),
    width: info.width,
    height: info.height,
    contentType: 'image/webp' as const,
    extension: 'webp' as const,
  }
}
