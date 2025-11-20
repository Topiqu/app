export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)
  const { shortcode, imageUrl } = body

  if (!shortcode) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!imageUrl) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const emoji = await db.emoji.create({
    data: {
      shortcode,
      imageUrl,
      clientSiteId: user.clientSiteId!,
    },
    select: { id: true, shortcode: true, imageUrl: true },
  })

  return { success: true, emoji }
})
