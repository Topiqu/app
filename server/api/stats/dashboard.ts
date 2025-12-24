import type { SharePlatform } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const session = await getServerSession(event)
  const user = session?.user

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const [
    counts,
    totalViews,
    roiMetrics,
    viewsLast7Days,
    tagsResult,
    topArticle,
    topAuthorResult,
    topCommented,
    topLiked,
    articlesForEngagement,
    shareDistribution,
  ] = await Promise.all([
    db.article.count({ where: { clientSiteId: user.clientSiteId } }),
    db.follow.count({ where: { followed: { clientSiteId: user.clientSiteId } } }),
    db.article.aggregate({
      where: { clientSiteId: user.clientSiteId },
      _sum: { views: true, savedAmount: true, savedTimeMinutes: true },
    }),
    db.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt") AS date, SUM(views) AS views
      FROM "Article"
      WHERE "clientSiteId" = ${user.clientSiteId}
      AND "createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date
    `,
    db.tag.findMany({
      where: { clientSiteId: user.clientSiteId },
      select: {
        id: true,
        name: true,
        articles: { select: { article: { select: { views: true } } } },
      },
      orderBy: { articles: { _count: 'desc' } },
      take: 10,
    }),
    db.article.findFirst({
      where: { clientSiteId: user.clientSiteId },
      select: { id: true, title: true, views: true },
      orderBy: { views: 'desc' },
    }),
    db.user.findFirst({
      where: { articles: { some: { status: 'published', clientSiteId: user.clientSiteId } } },
      orderBy: { articles: { _count: 'desc' } },
      select: {
        username: true,
        avatarUrl: true,
        articles: { where: { status: 'published', clientSiteId: user.clientSiteId }, select: { id: true } },
      },
    }),
    db.article.findFirst({
      where: { clientSiteId: user.clientSiteId, status: 'published' },
      select: { id: true, title: true, _count: { select: { comments: true } } },
      orderBy: { comments: { _count: 'desc' } },
    }),
    db.article.findFirst({
      where: { clientSiteId: user.clientSiteId, status: 'published' },
      select: { id: true, title: true, _count: { select: { reactions: true } } },
      orderBy: { reactions: { _count: 'desc' } },
    }),
    db.article.findMany({
      where: { status: 'published', clientSiteId: user.clientSiteId },
      select: {
        views: true,
        _count: { select: { reactions: true, comments: true, pollResults: true } },
        shares: { select: { id: true } },
      },
    }),
    db.articleShare.groupBy({
      by: ['platform'],
      where: { article: { status: 'published', clientSiteId: user.clientSiteId } },
      _count: { platform: true },
    }),
  ])

  const distribution: Record<SharePlatform, number> = { TWITTER: 0, LINKEDIN: 0, FACEBOOK: 0, EMAIL: 0, OTHER: 0 }
  shareDistribution.forEach((s) => {
    distribution[s.platform] = s._count.platform
  })

  const engagementRates = articlesForEngagement
    .filter((a) => a.views > 0)
    .map((a) => (a._count.reactions + a._count.comments + a.shares.length + a._count.pollResults) / a.views)

  const engagementRate =
    engagementRates.length > 0 ? engagementRates.reduce((s, r) => s + r, 0) / engagementRates.length : 0

  return {
    articleCount: counts,
    followerCount: totalViews,
    totalViews: roiMetrics._sum.views || 0,
    savedAmount: roiMetrics._sum.savedAmount || 0,
    savedTimeMinutes: roiMetrics._sum.savedTimeMinutes || 0,
    engagementRate,
    totalShares: Object.values(distribution).reduce((a, b) => a + b, 0),
    sharesDistribution: distribution,
    topArticle,
    topAuthor: topAuthorResult
      ? {
          username: topAuthorResult.username,
          avatarUrl: topAuthorResult.avatarUrl,
          articleCount: topAuthorResult.articles.length,
        }
      : null,
    topCommentedArticle: topCommented
      ? {
          title: topCommented.title,
          comments: topCommented._count.comments,
        }
      : null,
    topLikedArticle: topLiked
      ? {
          title: topLiked.title,
          likes: topLiked._count.reactions,
        }
      : null,
    topTags: tagsResult
      .map((tag) => ({
        name: tag.name,
        views: tag.articles.reduce((sum, a) => sum + a.article.views, 0),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 3),
    viewsHistory: (viewsLast7Days as any[]).map((v) => ({
      date: v.date.toISOString().slice(5, 10),
      views: Number(v.views) || 0,
    })),
  }
})
