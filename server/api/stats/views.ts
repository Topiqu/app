export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const totalViews = await prisma.article.aggregate({
    where: { clientSiteId: user.clientSiteId },
    _sum: { views: true },
  })

  return { totalViews: totalViews._sum.views || 0 }
})
