export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const site = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { communityInsight: true },
  })

  if (!site) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  return site.communityInsight
})
