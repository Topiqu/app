import { deleteFromCdn } from '~~/server/utils/storage'
import { emojiImageKeyFromUrl } from '~~/server/utils/emojiImage'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const emoji = await db.emoji.findFirst({
    where: { id, clientSiteId: user.clientSiteId },
    select: { imageUrl: true, _count: { select: { emojiReactions: true } } },
  })
  if (!emoji) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })

  await db.emoji.delete({
    where: { id, clientSiteId: user.clientSiteId },
  })

  const key = emojiImageKeyFromUrl(emoji.imageUrl, useRuntimeConfig().public.cdnUrl)
  if (key) {
    await deleteFromCdn(key, 'uploads/').catch((error) => console.error('Emoji image cleanup failed:', error))
  }

  return { success: true, deletedReactions: emoji._count.emojiReactions }
})
