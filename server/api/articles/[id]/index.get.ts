export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const sessionId = getCookie(event, 'anon_session')
  const { clientSiteId } = getQuery<{ clientSiteId: string }>(event)

  const article = await prisma.article.findUnique({
    where: { slug_clientSiteId: { slug, clientSiteId } },
    include: {
      user: {
        select: {
          username: true,
          id: true,
          email: true,
          avatarUrl: true,
          _count: { select: { following: true } },
        },
      },
      tags: { include: { tag: true } },
      reactions: true,
      articleSeries: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null } },
          reactions: true,
        },
      },
    },
  })

  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (article.status !== 'published' && user?.role !== 'admin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  let seriesNav = null

  if (article.articleSeriesId && article.seriesOrder !== null) {
    const whereFilter: any = { articleSeriesId: article.articleSeriesId }
    if (user?.role !== 'admin') whereFilter.status = 'published'

    const allSeriesArticles = await prisma.article.findMany({
      where: whereFilter,
      orderBy: { seriesOrder: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        seriesOrder: true,
        status: true,
      },
    })

    const currentIndex = allSeriesArticles.findIndex((a) => a.id === article.id)
    const prev = currentIndex > 0 ? allSeriesArticles[currentIndex - 1] : null
    const next =
      currentIndex !== -1 && currentIndex < allSeriesArticles.length - 1 ? allSeriesArticles[currentIndex + 1] : null

    seriesNav = {
      name: article.articleSeries?.name,
      slug: article.articleSeries?.slug,
      total: allSeriesArticles.length,
      current: article.seriesOrder,
      prev,
      next,
      articles: allSeriesArticles,
    }
  }

  return {
    ...article,
    commentCount: article._count.comments,
    likes: article._count.reactions,
    likedByUser: user?.id
      ? article.reactions.some((r) => r.userId === user.id)
      : sessionId
        ? article.reactions.some((r) => r.sessionId === sessionId)
        : false,
    followerCount: article.user?._count.following ?? 0,
    series: seriesNav,
  }
})
