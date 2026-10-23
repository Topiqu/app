import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { analyzeImage } from '~~/server/utils/imageAnalysis'
import { deleteFromCdn, putToCdn } from '~~/server/utils/storage'
import { EMOJI_CONTENT_TYPE, prepareEmojiImage } from '~~/server/utils/emojiImage'

import { isValidEmojiShortcode, normalizeEmojiShortcode } from '#shared/utils/emoji'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  if (user.role !== 'admin' || !user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  const field = (name: string) => parts.find((part) => part.name === name && !part.filename)?.data.toString()
  const file = parts.find((part) => part.filename)
  const shortcode = normalizeEmojiShortcode(String(field('shortcode') || ''))

  if (!isValidEmojiShortcode(shortcode)) throw createError({ statusCode: 400, message: t('emoji.invalidShortcode')! })
  if (!file?.type?.startsWith('image/')) throw createError({ statusCode: 400, message: t('emoji.invalidImage')! })

  const db = await getEnhancedPrisma(user)
  const existing = await db.emoji.findFirst({
    where: { shortcode, clientSiteId: user.clientSiteId },
    select: { id: true },
  })
  if (existing) throw createError({ statusCode: 409, message: t('emoji.duplicateShortcode')! })

  const image = await prepareEmojiImage(file.data)
  const moderationImage = await sharp(image, { animated: false, limitInputPixels: 20_000_000 })
    .flatten({ background: 'white' })
    .jpeg({ quality: 80 })
    .toBuffer()
  const { tags } = await analyzeImage(moderationImage)
  const key = `uploads/emoji-${randomUUID()}.webp`
  const imageUrl = await putToCdn(key, image, EMOJI_CONTENT_TYPE, {
    'rekognition-tags': tags.join(','),
    'original-name': file.filename ? encodeURIComponent(file.filename) : 'unknown',
  })

  try {
    const emoji = await db.emoji.create({
      data: { shortcode, imageUrl, clientSiteId: user.clientSiteId },
      select: { id: true, shortcode: true, imageUrl: true },
    })
    return { success: true, emoji }
  } catch (error) {
    await deleteFromCdn(key, 'uploads/').catch(async () => {
      await reportCaughtError('Emoji create rollback failed', new Error('EMOJI_UPLOAD_CLEANUP_FAILED'), {
        clientSiteId: user.clientSiteId,
      }).catch(() => {})
    })
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, message: t('emoji.duplicateShortcode')! })
    throw error
  }
})
