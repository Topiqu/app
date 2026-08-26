import sharp from 'sharp'
import { FAVICON_MAX_BYTES, FAVICON_MAX_SIZE, FAVICON_MIN_SIZE, isFaviconMimeType } from '~~/shared/utils/favicon'

export type FaviconRejection = 'type' | 'bytes' | 'unreadable' | 'square' | 'dimensions'

export const validateFaviconUpload = async (data: Uint8Array, mimeType: string): Promise<FaviconRejection | null> => {
  if (!isFaviconMimeType(mimeType)) return 'type'
  if (data.byteLength > FAVICON_MAX_BYTES) return 'bytes'

  const metadata = await sharp(data)
    .metadata()
    .catch(() => null)
  if (!metadata?.width || !metadata.height) return 'unreadable'
  if (metadata.width !== metadata.height) return 'square'
  if (metadata.width < FAVICON_MIN_SIZE || metadata.width > FAVICON_MAX_SIZE) return 'dimensions'
  return null
}
