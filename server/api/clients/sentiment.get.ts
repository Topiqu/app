export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({
    where: { id: user.clientSiteId, deletedAt: null },
    select: { communityInsight: true },
  })

  if (!site) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  return readCommunityInsight(site.communityInsight)
})
