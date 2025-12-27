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
          _count: { select: { articles: true } },
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
    const [prev, next] = await Promise.all([
      prisma.article.findFirst({
        where: {
          articleSeriesId: article.articleSeriesId,
          seriesOrder: { lt: article.seriesOrder },
          status: 'published',
        },
        orderBy: { seriesOrder: 'desc' },
        select: { title: true, slug: true, imageUrl: true, seriesOrder: true },
      }),
      prisma.article.findFirst({
        where: {
          articleSeriesId: article.articleSeriesId,
          seriesOrder: { gt: article.seriesOrder },
          status: 'published',
        },
        orderBy: { seriesOrder: 'asc' },
        select: { title: true, slug: true, imageUrl: true, seriesOrder: true },
      }),
    ])

    seriesNav = {
      name: article.articleSeries?.name,
      slug: article.articleSeries?.slug,
      total: article.articleSeries?._count.articles,
      current: (article.seriesOrder || 0) + 1,
      prev,
      next,
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
