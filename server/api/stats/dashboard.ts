import type { SharePlatform } from '@prisma/client'

import { writingSavings } from '~~/shared/utils/savings'

// UTC day keys, oldest first — the raw query below buckets on DATE_TRUNC, which is UTC too.
const lastSevenDays = () => {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today)
    day.setUTCDate(day.getUTCDate() - (6 - i))
    return day.toISOString().slice(0, 10)
  })
}

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)

  const [
    articleCount,
    followerCount,
    viewsAggregate,
    aiWords,
    rates,
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
      _sum: { views: true },
    }),
    // Only fully AI-written articles count as saved work: the editor demotes an article to
    // ASSIST the moment a human edits its body.
    db.article.aggregate({
      where: { clientSiteId: user.clientSiteId, aiInvolvement: 'FULL' },
      _sum: { totalWords: true },
    }),
    db.clientSite.findUnique({
      where: { id: user.clientSiteId! },
      select: { humanHourlyRateUsd: true, humanWordsPerHour: true },
    }),
    db.$queryRaw`
      SELECT DATE_TRUNC('day', COALESCE("publishedAt", "createdAt")) AS date, SUM(views) AS views
      FROM "Article"
      WHERE "clientSiteId" = ${user.clientSiteId}
      AND "status" = 'published'
      AND COALESCE("publishedAt", "createdAt") >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
      GROUP BY DATE_TRUNC('day', COALESCE("publishedAt", "createdAt"))
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

  const viewsByDay = new Map(
    (viewsLast7Days as { date: Date; views: bigint | number }[]).map((row) => [
      row.date.toISOString().slice(0, 10),
      Number(row.views) || 0,
    ]),
  )

  // Derived on read, not read back from Article.savedAmount: those columns froze a rate (and a
  // currency) at generation time, so a rate correction never reached articles already written.
  const savings = writingSavings(aiWords._sum.totalWords || 0, rates?.humanHourlyRateUsd, rates?.humanWordsPerHour)

  return {
    articleCount,
    followerCount,
    totalViews: viewsAggregate._sum.views || 0,
    savings,
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
    // Every day in the window, not just the ones that happen to have a row — a sparse axis
    // made a two-article week look like a dense trend. Dates stay ISO; the client localises.
    viewsHistory: lastSevenDays().map((date) => ({
      date,
      views: Number(viewsByDay.get(date) ?? 0),
    })),
  }
})
