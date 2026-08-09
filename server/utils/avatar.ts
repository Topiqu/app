import sharp from 'sharp'

export const AVATAR_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const AVATAR_SIZE = 512
export const AVATAR_CONTENT_TYPE = 'image/webp'

const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'tiff'])

export async function prepareAvatar(input: Uint8Array) {
  if (!input.length || input.length > AVATAR_MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: input.length ? 413 : 400,
      statusMessage: input.length ? 'Avatar is too large' : 'Avatar is empty',
    })
  }

  try {
    const image = sharp(input, { animated: false, failOn: 'warning', limitInputPixels: 40_000_000 }).rotate()
    const metadata = await image.metadata()
    if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height)
      throw new Error('Unsupported image')

    return await image
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre', withoutEnlargement: false })
      .webp({ quality: 86, effort: 5 })
      .toBuffer()
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 415, statusMessage: 'Invalid or unsupported image' })
  }
}

export function avatarKeyFromUrl(url: string | null | undefined, cdnUrl: string) {
  if (!url) return null
  try {
    const candidate = new URL(url)
    const cdn = new URL(cdnUrl)
    if (candidate.origin !== cdn.origin || !candidate.pathname.startsWith('/avatars/')) return null
    return candidate.pathname.slice(1)
  } catch {
    return null
  }
}
