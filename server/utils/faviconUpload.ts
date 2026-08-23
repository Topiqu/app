import sharp from 'sharp'

export const FAVICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const FAVICON_MAX_BYTES = 512 * 1024
export const FAVICON_MIN_SIZE = 32
export const FAVICON_MAX_SIZE = 512

export const validateFaviconUpload = async (data: Uint8Array, mimeType: string) => {
  if (!(FAVICON_MIME_TYPES as readonly string[]).includes(mimeType)) return 'type' as const
  if (data.byteLength > FAVICON_MAX_BYTES) return 'bytes' as const

  const metadata = await sharp(data)
    .metadata()
    .catch(() => null)
  if (!metadata?.width || !metadata.height || metadata.width !== metadata.height) return 'square' as const
  if (metadata.width < FAVICON_MIN_SIZE || metadata.width > FAVICON_MAX_SIZE) return 'dimensions' as const
  return null
}
