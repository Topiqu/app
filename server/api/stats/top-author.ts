export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const topAuthor = await prisma.user.findFirst({
    where: { articles: { some: { status: 'published', clientSiteId: user.clientSiteId } } },
    orderBy: { articles: { _count: 'desc' } },
    select: {
      username: true,
      avatarUrl: true,
      articles: { where: { status: 'published', clientSiteId: user.clientSiteId } },
    },
  })

  return topAuthor
    ? { username: topAuthor.username, avatarUrl: topAuthor.avatarUrl, articleCount: topAuthor.articles.length }
    : null
})
