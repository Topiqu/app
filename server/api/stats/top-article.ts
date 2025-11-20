export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const topArticle = await prisma.article.findFirst({
    where: { clientSiteId: user.clientSiteId },
    select: { id: true, title: true, views: true },
    orderBy: { views: 'desc' },
    take: 1,
  })

  return topArticle || null
})
