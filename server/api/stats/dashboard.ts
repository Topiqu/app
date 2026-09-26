import type { SharePlatform } from '~~/generated/zenstack/models'

import { z } from 'zod'
import { completedWritingValue, generatedWordsFromSnapshot } from '~~/shared/utils/valueMetrics'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)

  const clientSiteId = user.clientSiteId!
  const trendStart = lastDays(VIEW_TREND_DAYS)[0]!
  // Keep the no-query API response lifetime-scoped for existing callers; the modal explicitly
  // requests its new 30-day default.
  const { range } = await getValidatedQuery(event, z.object({ range: z.enum(['30d', 'all']).default('all') }).parse)
  const periodStart = new Date(`${trendStart}T00:00:00.000Z`)
  const isAllTime = range === 'all'
  const articlePeriod = isAllTime ? {} : { publishedAt: { gte: periodStart } }
  const interactionPeriod = isAllTime ? {} : { createdAt: { gte: periodStart } }

  const [
    articleCount,
    publishedCount,
    followerCount,
    viewsAggregate,
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
    periodViewCounts,
    periodInteractions,
    periodTopCommented,
    periodTopLiked,
    publishedCoverage,
    completedSessionWords,
    legacySessions,
    cronValueRows,
    monthlyViewRows,
    valueTrackingRows,
    ambiguousSessions,
    legacyAiArticles,
  ] = await Promise.all([
    db.article.count({ where: { clientSiteId } }),
    db.article.count({ where: { clientSiteId, status: 'published', ...articlePeriod } }),
    db.follow.count({ where: { followed: { clientSiteId } } }),
    // Published only, matching `topArticle` — a draft is not readership, and an admin
    // previewing one used to move this number.
    isAllTime
      ? db.article.aggregate({ where: { clientSiteId, status: 'published' }, _sum: { views: true } })
      : db.$queryRaw<{ views: number }[]>`
          SELECT COUNT(*)::int AS views FROM "ArticleView" v
          JOIN "Article" a ON a."id" = v."articleId"
          WHERE v."clientSiteId" = ${clientSiteId} AND v."viewedOn" >= ${trendStart}::date
            AND a."status" = 'published'
        `.then((rows) => rows[0]?.views ?? 0),
    // This is the current inventory of articles and drafts, not a period activity metric.
    // Keeping drafts here also makes older AI-created work visible when no generation receipt exists.
    db.article.groupBy({
      by: ['aiInvolvement'],
      where: { clientSiteId },
      _count: { _all: true },
    }),
    db.clientSite.findUnique({
      where: { id: clientSiteId },
      select: { humanHourlyRateUsd: true, humanWordsPerHour: true },
    }),
    // Real per-day readership from the event log, not views bucketed by publish date.
    isAllTime
      ? Promise.resolve([])
      : db.$queryRaw`
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
             COALESCE(SUM(CASE WHEN ${isAllTime} THEN a."views" ELSE COALESCE(recent."views", 0) END), 0)::int AS views,
             COUNT(a."id")::int AS "articleCount"
      FROM "Tag" t
      JOIN "ArticleTag" at ON at."tagId" = t."id"
      JOIN "Article" a ON a."id" = at."articleId" AND a."status" = 'published'
      LEFT JOIN (
        SELECT "articleId", COUNT(*)::int AS views FROM "ArticleView"
        WHERE "clientSiteId" = ${clientSiteId} AND "viewedOn" >= ${trendStart}::date
        GROUP BY "articleId"
      ) recent ON recent."articleId" = a."id"
      WHERE t."clientSiteId" = ${clientSiteId}
      GROUP BY t."id", t."name"
      HAVING COUNT(a."id") > 0
      ORDER BY views DESC, "articleCount" DESC
      LIMIT 8
    `,
    isAllTime
      ? db.article.findFirst({
          where: { clientSiteId, status: 'published' },
          select: { id: true, slug: true, title: true, views: true },
          orderBy: { views: 'desc' },
        })
      : db.$queryRaw<{ id: string; slug: string; title: string; views: number }[]>`
          SELECT a."id", a."slug", a."title", COUNT(*)::int AS views
          FROM "ArticleView" v JOIN "Article" a ON a."id" = v."articleId"
          WHERE v."clientSiteId" = ${clientSiteId} AND v."viewedOn" >= ${trendStart}::date
            AND a."status" = 'published'
          GROUP BY a."id" ORDER BY views DESC LIMIT 1
        `.then((rows) => rows[0] ?? null),
    // Ranked by the same articles the count displays. `orderBy: { articles: { _count } }` on User
    // cannot be filtered — it sorts by the author's total across every tenant and status, so the
    // winner could be someone whose work is mostly elsewhere or unpublished.
    db.article.groupBy({
      by: ['userId'],
      where: { clientSiteId, status: 'published', ...articlePeriod },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 1,
    }),
    isAllTime
      ? db.article.findFirst({
          where: { clientSiteId: user.clientSiteId, status: 'published' },
          select: { id: true, slug: true, title: true, _count: { select: { comments: true } } },
          orderBy: { comments: { _count: 'desc' } },
        })
      : Promise.resolve(null),
    isAllTime
      ? db.article.findFirst({
          where: { clientSiteId: user.clientSiteId, status: 'published' },
          select: { id: true, slug: true, title: true, _count: { select: { reactions: true } } },
          orderBy: { reactions: { _count: 'desc' } },
        })
      : Promise.resolve(null),
    isAllTime
      ? db.article.findMany({
          where: { status: 'published', clientSiteId },
          select: {
            views: true,
            _count: { select: { reactions: true, comments: true, pollResults: true, shares: true } },
          },
        })
      : Promise.resolve([]),
    db.articleShare.groupBy({
      by: ['platform'],
      where: { article: { status: 'published', clientSiteId }, ...interactionPeriod },
      _count: { platform: true },
    }),
    isAllTime
      ? Promise.resolve(null)
      : db.$queryRaw<{ articleId: string; views: number }[]>`
      SELECT v."articleId", COUNT(*)::int AS views FROM "ArticleView" v
      JOIN "Article" a ON a."id" = v."articleId"
      WHERE v."clientSiteId" = ${clientSiteId} AND v."viewedOn" >= ${trendStart}::date
        AND a."status" = 'published'
      GROUP BY v."articleId"
    `,
    isAllTime
      ? Promise.resolve(null)
      : Promise.all([
          db.articleReaction.count({ where: { article: { clientSiteId, status: 'published' }, ...interactionPeriod } }),
          db.comment.count({ where: { article: { clientSiteId, status: 'published' }, ...interactionPeriod } }),
          db.pollResult.count({ where: { article: { clientSiteId, status: 'published' }, ...interactionPeriod } }),
        ]),
    isAllTime
      ? Promise.resolve(null)
      : db.$queryRaw<{ id: string; slug: string; title: string; comments: number }[]>`
      SELECT a."id", a."slug", a."title", COUNT(c."id")::int AS comments
      FROM "Comment" c JOIN "Article" a ON a."id" = c."articleId"
      WHERE a."clientSiteId" = ${clientSiteId} AND a."status" = 'published' AND c."createdAt" >= ${periodStart}
      GROUP BY a."id" ORDER BY comments DESC LIMIT 1
    `.then((rows) => rows[0] ?? null),
    isAllTime
      ? Promise.resolve(null)
      : db.$queryRaw<{ id: string; slug: string; title: string; likes: number }[]>`
      SELECT a."id", a."slug", a."title", COUNT(r."id")::int AS likes
      FROM "ArticleReaction" r JOIN "Article" a ON a."id" = r."articleId"
      WHERE a."clientSiteId" = ${clientSiteId} AND a."status" = 'published' AND r."createdAt" >= ${periodStart}
      GROUP BY a."id" ORDER BY likes DESC LIMIT 1
    `.then((rows) => rows[0] ?? null),
    prisma.article.aggregate({
      where: { clientSiteId, status: 'published', publishedAt: { not: null } },
      _min: { publishedAt: true },
      _count: { _all: true },
    }),
    prisma.articleGenerationSession.aggregate({
      where: {
        clientSiteId,
        charged: true,
        completedAt: isAllTime ? { not: null } : { gte: periodStart },
        generatedWordCount: { not: null },
      },
      _sum: { generatedWordCount: true },
      _min: { completedAt: true },
    }),
    prisma.articleGenerationSession.findMany({
      where: {
        clientSiteId,
        charged: true,
        status: 'COMPLETED',
        completedAt: isAllTime ? { not: null } : { gte: periodStart },
        generatedWordCount: null,
      },
      select: { completedAt: true, recoverableSnapshot: true },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN "metadata"->>'generatedWordCount' ~ '^[0-9]+$'
        THEN ("metadata"->>'generatedWordCount')::integer ELSE 0 END), 0)::int AS words,
        MIN(CASE WHEN "metadata"->>'generatedWordCount' ~ '^[0-9]+$' THEN "createdAt" END) AS since,
        COUNT(*) FILTER (WHERE "metadata"->>'generatedWordCount' IS NULL)::int AS missing
      FROM "Log" WHERE "clientSiteId" = ${clientSiteId}
        AND "action" IN ('CRON_ARTICLE_PUBLISHED', 'CRON_ARTICLE_SAVED_AS_DRAFT')
        AND (${isAllTime} OR "createdAt" >= ${periodStart})
    `,
    isAllTime
      ? db.$queryRaw`
      SELECT date_trunc('month', "viewedOn") AS date, COUNT(*)::int AS views
      FROM "ArticleView" WHERE "clientSiteId" = ${clientSiteId}
      GROUP BY 1 ORDER BY 1
    `
      : Promise.resolve([]),
    prisma.$queryRaw<{ since: Date | null }[]>`
      SELECT MIN("at") AS since FROM (
        SELECT "completedAt" AS "at" FROM "ArticleGenerationSession"
        WHERE "clientSiteId" = ${clientSiteId} AND "charged" = true
          AND "completedAt" IS NOT NULL
          AND ("generatedWordCount" IS NOT NULL OR "status" = 'COMPLETED')
        UNION ALL
        SELECT "createdAt" AS "at" FROM "Log"
        WHERE "clientSiteId" = ${clientSiteId}
          AND "action" IN ('CRON_ARTICLE_PUBLISHED', 'CRON_ARTICLE_SAVED_AS_DRAFT')
          AND "metadata"->>'generatedWordCount' ~ '^[0-9]+$'
      ) completed_work
    `,
    prisma.articleGenerationSession.count({
      where: {
        clientSiteId,
        charged: true,
        status: { in: ['RESTORED', 'DISMISSED'] },
        generatedWordCount: null,
        completedAt: isAllTime ? { not: null } : { gte: periodStart },
      },
    }),
    // Legacy articles have no reliable link to a generation receipt. Keep this estimate separate
    // from documented work: adding the two totals would risk counting the same writing twice.
    prisma.article.aggregate({
      where: { clientSiteId, aiInvolvement: 'FULL' },
      _sum: { totalWords: true },
      _count: { _all: true },
    }),
  ])

  const distribution: Record<SharePlatform, number> = { TWITTER: 0, LINKEDIN: 0, FACEBOOK: 0, EMAIL: 0, OTHER: 0 }
  shareDistribution.forEach((s) => {
    distribution[s.platform] = s._count.platform
  })

  const viewCounts = isAllTime
    ? articlesForEngagement.map((a) => a.views)
    : (periodViewCounts ?? []).map((a) => a.views)
  const totalViews = isAllTime
    ? ((viewsAggregate as { _sum: { views: number | null } })._sum.views ?? 0)
    : (viewsAggregate as number)

  const topAuthorRow = topAuthorResult[0]
  const topAuthor = topAuthorRow
    ? await db.user.findUnique({
        where: { id: topAuthorRow.userId },
        select: { username: true, avatarUrl: true },
      })
    : null

  const cron = (cronValueRows as { words: number; since: Date | null; missing: number }[])[0]!
  const reconstructedWords = legacySessions.reduce(
    (sum, session) => sum + generatedWordsFromSnapshot(session.recoverableSnapshot),
    0,
  )
  const generatedWords = (completedSessionWords._sum.generatedWordCount ?? 0) + reconstructedWords + Number(cron.words)
  const value = completedWritingValue(generatedWords, rates?.humanHourlyRateUsd, rates?.humanWordsPerHour)
  const legacyEstimate = completedWritingValue(
    legacyAiArticles._sum.totalWords ?? 0,
    rates?.humanHourlyRateUsd,
    rates?.humanWordsPerHour,
  )
  const valueSince = valueTrackingRows[0]?.since ?? null
  const publishedTotal = await db.article.count({ where: { clientSiteId, status: 'published' } })
  const savings = {
    words: value.generatedWords,
    minutes: value.estimatedMinutes,
    amountUsd: value.estimatedAmountUsd,
    hourlyRateUsd: value.hourlyRateUsd,
    wordsPerHour: value.wordsPerHour,
  }
  const periodEngagement = periodInteractions
    ? engagementRate([
        {
          views: totalViews,
          _count: {
            reactions: periodInteractions[0],
            comments: periodInteractions[1],
            pollResults: periodInteractions[2],
            shares: Object.values(distribution).reduce((a, b) => a + b, 0),
          },
        },
      ])
    : engagementRate(articlesForEngagement)
  const commentsHighlight = isAllTime
    ? topCommented
      ? {
          id: topCommented.id,
          slug: topCommented.slug,
          title: topCommented.title,
          comments: topCommented._count.comments,
        }
      : null
    : periodTopCommented
  const likesHighlight = isAllTime
    ? topLiked
      ? {
          id: topLiked.id,
          slug: topLiked.slug,
          title: topLiked.title,
          likes: topLiked._count.reactions,
        }
      : null
    : periodTopLiked

  return {
    generatedAt: new Date().toISOString(),
    range,
    articleCount,
    publishedCount,
    draftCount: isAllTime
      ? await db.article.count({ where: { clientSiteId, status: 'draft' } })
      : await db.article.count({ where: { clientSiteId, status: 'draft', createdAt: { gte: periodStart } } }),
    followerCount,
    totalViews,
    averageViews: publishedTotal > 0 ? totalViews / publishedTotal : 0,
    topThreeShare: topThreeShare(viewCounts),
    aiInvolvement: involvementCounts(aiInvolvement),
    savings,
    value: {
      ...value,
      legacyEstimate: { ...legacyEstimate, articleCount: legacyAiArticles._count._all },
      trackedSince: valueSince?.toISOString().slice(0, 10) ?? null,
      partialHistory: Number(cron.missing) > 0 || ambiguousSessions > 0,
      activityCoverage: { writing: valueSince?.toISOString().slice(0, 10) ?? null },
    },
    publishedCoverage: {
      trackedSince: publishedCoverage._min.publishedAt
        ? new Date(publishedCoverage._min.publishedAt).toISOString().slice(0, 10)
        : null,
      partialHistory: publishedCoverage._count._all < publishedTotal,
    },
    engagementRate: periodEngagement,
    totalShares: Object.values(distribution).reduce((a, b) => a + b, 0),
    sharesDistribution: distribution,
    topArticle,
    topAuthor:
      topAuthor && topAuthorRow
        ? { username: topAuthor.username, avatarUrl: topAuthor.avatarUrl, articleCount: topAuthorRow._count._all }
        : null,
    topCommentedArticle: commentsHighlight,
    topLikedArticle: likesHighlight,
    topTags: tagRows as { name: string; views: number; articleCount: number }[],
    // Dates stay ISO; the client localises.
    viewsHistory: isAllTime
      ? fillMonthlySeries(monthlyViewRows as { date: Date; views: number }[])
      : fillDailySeries(viewsByDayRows as { date: Date; views: number }[]),
    // Null until the first event lands. The client says "since <date>" rather than implying
    // the flat stretch before the event table existed was a quiet month.
    trackingSince: (trackingSinceRows as { since: Date | null }[])[0]?.since?.toISOString().slice(0, 10) ?? null,
  }
})
