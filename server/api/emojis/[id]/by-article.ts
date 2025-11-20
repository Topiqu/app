export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  const db = await getEnhancedPrisma(user)
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { clientSiteId: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  return await db.emoji.findMany({
    where: { clientSiteId: article.clientSiteId },
    select: { id: true, shortcode: true, imageUrl: true },
  })
})
