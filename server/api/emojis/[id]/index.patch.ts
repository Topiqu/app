import { isValidEmojiShortcode, normalizeEmojiShortcode } from '#shared/utils/emoji'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const shortcode = normalizeEmojiShortcode(String((await readBody(event))?.shortcode || ''))
  if (!isValidEmojiShortcode(shortcode)) throw createError({ statusCode: 400, message: t('emoji.invalidShortcode')! })

  const db = await getEnhancedPrisma(user)
  const emoji = await db.emoji.update({
    where: { id, clientSiteId: user.clientSiteId },
    data: { shortcode },
    select: { id: true, shortcode: true, imageUrl: true, _count: { select: { emojiReactions: true } } },
  })

  return { emoji }
})
