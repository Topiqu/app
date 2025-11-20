export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  return await db.emoji.findMany({
    where: { clientSiteId: user.clientSiteId },
  })
})
