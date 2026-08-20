import type { SharePlatform } from '@prisma/client'

import { writingSavings } from '~~/shared/utils/savings'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)

  const clientSiteId = user.clientSiteId!
  const trendStart = lastDays(VIEW_TREND_DAYS)[0]!

  const [
    articleCount,
    publishedCount,
    followerCount,
    viewsAggregate,
    aiWords,
    aiInvolvement,
    rates,
    viewsByDayRows,
    trackingSinceRows,
    tagRows,
    topArticle,
    topAuthorResult,
    topCommented,
    topLiked,
    articlesForEngagement,
    shareDistribution,
  ] = await Promise.all([
    db.article.count({ where: { clientSiteId } }),
    db.article.count({ where: { clientSiteId, status: 'published' } }),
    db.follow.count({ where: { followed: { clientSiteId } } }),
    // Published only, matching `topArticle` — a draft is not readership, and an admin
    // previewing one used to move this number.
    db.article.aggregate({
      where: { clientSiteId, status: 'published' },
      _sum: { views: true },
    }),
    // Only fully AI-written articles count as saved work: the editor demotes an article to
    // ASSIST the moment a human edits its body.
    db.article.aggregate({
      where: { clientSiteId, aiInvolvement: 'FULL' },
      _sum: { totalWords: true },
    }),
    // Published only, like every other count here — counting drafts made this split total more
    // than the article count printed directly above it.
    db.article.groupBy({
      by: ['aiInvolvement'],
      where: { clientSiteId, status: 'published' },
      _count: { _all: true },
    }),
    db.clientSite.findUnique({
      where: { id: clientSiteId },
      select: { humanHourlyRateUsd: true, humanWordsPerHour: true },
    }),
    // Real per-day readership from the event log, not views bucketed by publish date.
    db.$queryRaw`
      SELECT "viewedOn" AS date, COUNT(*)::int AS views
      FROM "ArticleView"
      WHERE "clientSiteId" = ${clientSiteId}
      AND "viewedOn" >= ${trendStart}::date
      GROUP BY "viewedOn"
      ORDER BY "viewedOn"
    `,
    // The series cannot predate the event table, so the client labels the window instead of
    // drawing flat zeros back to the blog's first article. Raw like the query above, so both
    // read the log under the same explicit tenant filter rather than a policy this endpoint's
    // non-admin members would fail.
    db.$queryRaw`SELECT MIN("viewedOn") AS since FROM "ArticleView" WHERE "clientSiteId" = ${clientSiteId}`,
    // Ranked by summed views in SQL. Prisma cannot order a tag by an aggregate over its
    // articles, so the old code took the ten tags with most articles and sorted *those* —
    // a tag on two heavily-read articles never entered the candidate set.
    db.$queryRaw`
      SELECT t."name" AS name,
             COALESCE(SUM(a."views"), 0)::int AS views,
             COUNT(a."id")::int AS "articleCount"
      FROM "Tag" t
      JOIN "ArticleTag" at ON at."tagId" = t."id"
      JOIN "Article" a ON a."id" = at."articleId" AND a."status" = 'published'
      WHERE t."clientSiteId" = ${clientSiteId}
      GROUP BY t."id", t."name"
      HAVING COUNT(a."id") > 0
      ORDER BY views DESC, "articleCount" DESC
      LIMIT 8
    `,
    db.article.findFirst({
      where: { clientSiteId, status: 'published' },
      select: { id: true, slug: true, title: true, views: true },
      orderBy: { views: 'desc' },
    }),
    // Ranked by the same articles the count displays. `orderBy: { articles: { _count } }` on User
    // cannot be filtered — it sorts by the author's total across every tenant and status, so the
    // winner could be someone whose work is mostly elsewhere or unpublished.
    db.article.groupBy({
      by: ['userId'],
      where: { clientSiteId, status: 'published' },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 1,
    }),
    db.article.findFirst({
      where: { clientSiteId, status: 'published' },
      select: { id: true, slug: true, title: true, _count: { select: { comments: true } } },
      orderBy: { comments: { _count: 'desc' } },
    }),
    db.article.findFirst({
      where: { clientSiteId, status: 'published' },
      select: { id: true, slug: true, title: true, _count: { select: { reactions: true } } },
      orderBy: { reactions: { _count: 'desc' } },
    }),
    db.article.findMany({
      where: { status: 'published', clientSiteId },
      select: {
        views: true,
        _count: { select: { reactions: true, comments: true, pollResults: true, shares: true } },
      },
    }),
    db.articleShare.groupBy({
      by: ['platform'],
      where: { article: { status: 'published', clientSiteId } },
      _count: { platform: true },
    }),
  ])

  const distribution: Record<SharePlatform, number> = { TWITTER: 0, LINKEDIN: 0, FACEBOOK: 0, EMAIL: 0, OTHER: 0 }
  shareDistribution.forEach((s) => {
    distribution[s.platform] = s._count.platform
  })

  const viewCounts = articlesForEngagement.map((a) => a.views)

  const topAuthorRow = topAuthorResult[0]
  const topAuthor = topAuthorRow
    ? await db.user.findUnique({
        where: { id: topAuthorRow.userId },
        select: { username: true, avatarUrl: true },
      })
    : null

  // Derived on read, not read back from Article.savedAmount: those columns froze a rate (and a
  // currency) at generation time, so a rate correction never reached articles already written.
  const savings = writingSavings(aiWords._sum.totalWords || 0, rates?.humanHourlyRateUsd, rates?.humanWordsPerHour)

  return {
    generatedAt: new Date().toISOString(),
    articleCount,
    publishedCount,
    draftCount: articleCount - publishedCount,
    followerCount,
    totalViews: viewsAggregate._sum.views || 0,
    averageViews: publishedCount > 0 ? (viewsAggregate._sum.views || 0) / publishedCount : 0,
    topThreeShare: topThreeShare(viewCounts),
    aiInvolvement: involvementCounts(aiInvolvement),
    savings,
    engagementRate: engagementRate(articlesForEngagement),
    totalShares: Object.values(distribution).reduce((a, b) => a + b, 0),
    sharesDistribution: distribution,
    topArticle,
    topAuthor:
      topAuthor && topAuthorRow
        ? { username: topAuthor.username, avatarUrl: topAuthor.avatarUrl, articleCount: topAuthorRow._count._all }
        : null,
    topCommentedArticle: topCommented
      ? { slug: topCommented.slug, title: topCommented.title, comments: topCommented._count.comments }
      : null,
    topLikedArticle: topLiked
      ? { slug: topLiked.slug, title: topLiked.title, likes: topLiked._count.reactions }
      : null,
    topTags: tagRows as { name: string; views: number; articleCount: number }[],
    // Dates stay ISO; the client localises.
    viewsHistory: fillDailySeries(viewsByDayRows as { date: Date; views: number }[]),
    // Null until the first event lands. The client says "since <date>" rather than implying
    // the flat stretch before the event table existed was a quiet month.
    trackingSince: (trackingSinceRows as { since: Date | null }[])[0]?.since?.toISOString().slice(0, 10) ?? null,
  }
})
