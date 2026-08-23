import sharp from 'sharp'

export const EMOJI_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const EMOJI_SIZE = 128
export const EMOJI_CONTENT_TYPE = 'image/webp'

const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif'])

export async function prepareEmojiImage(input: Uint8Array) {
  if (!input.length || input.length > EMOJI_MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: input.length ? 413 : 400,
      statusMessage: input.length ? 'Emoji image is too large' : 'Emoji image is empty',
    })
  }

  try {
    const image = sharp(input, { animated: true, failOn: 'warning', limitInputPixels: 20_000_000 }).rotate()
    const metadata = await image.metadata()
    if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format) || !metadata.width || !metadata.height)
      throw new Error('Unsupported image')

    return await image
      .resize(EMOJI_SIZE, EMOJI_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toBuffer()
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 415, statusMessage: 'Invalid or unsupported emoji image' })
  }
}

export function emojiImageKeyFromUrl(url: string | null | undefined, cdnUrl: string) {
  if (!url) return null
  try {
    const candidate = new URL(url)
    const cdn = new URL(cdnUrl)
    if (candidate.origin !== cdn.origin || !/^\/uploads\/emoji-[a-f0-9-]+\.webp$/.test(candidate.pathname)) return null
    return candidate.pathname.slice(1)
  } catch {
    return null
  }
}
