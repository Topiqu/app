import { subDays } from 'date-fns'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const clientSiteId = user.clientSiteId!
  const since = subDays(new Date(), 30)
  since.setUTCHours(0, 0, 0, 0)

  const [crawlerDays, referrals, runs, prompts, opportunities] = await Promise.all([
    db.aiCrawlerDaily.findMany({
      where: { clientSiteId, date: { gte: since } },
      select: {
        bot: true,
        kind: true,
        surface: true,
        path: true,
        requestCount: true,
        successCount: true,
        errorCount: true,
        rateLimitedCount: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    }),
    db.aiReferralVisit.findMany({
      where: { clientSiteId, visitedOn: { gte: since } },
      select: { channel: true, articleId: true, visitedOn: true },
    }),
    db.aiVisibilityRun.findMany({
      where: { clientSiteId, executedAt: { gte: since } },
      select: {
        id: true,
        promptId: true,
        provider: true,
        model: true,
        status: true,
        executedAt: true,
        searchedWeb: true,
        brandMentioned: true,
        responseText: true,
        citationCount: true,
        error: true,
        citations: {
          select: {
            url: true,
            normalizedUrl: true,
            domain: true,
            title: true,
            owned: true,
            articleId: true,
            position: true,
          },
          orderBy: { position: 'asc' },
        },
        prompt: { select: { text: true, language: true } },
      },
      orderBy: { executedAt: 'desc' },
      take: 100,
    }),
    db.aiVisibilityPrompt.findMany({
      where: { clientSiteId },
      select: {
        id: true,
        text: true,
        language: true,
        country: true,
        intent: true,
        source: true,
        active: true,
        lastRunAt: true,
        _count: { select: { runs: true } },
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    }),
    db.aiVisibilityOpportunity.findMany({
      where: { clientSiteId },
      select: {
        id: true,
        kind: true,
        status: true,
        reason: true,
        citedDomains: true,
        sampleSize: true,
        ownedHits: true,
        externalHits: true,
        firstSeenAt: true,
        lastSeenAt: true,
        prompt: { select: { id: true, text: true } },
        article: { select: { id: true, slug: true, title: true } },
      },
      orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
    }),
  ])

  const byBot = new Map<string, { bot: string; kind: string; requests: number; pages: Set<string>; lastSeenAt: Date }>()
  for (const row of crawlerDays) {
    const current = byBot.get(row.bot) ?? {
      bot: row.bot,
      kind: row.kind,
      requests: 0,
      pages: new Set<string>(),
      lastSeenAt: row.lastSeenAt,
    }
    current.requests += row.requestCount
    current.pages.add(row.path)
    if (row.lastSeenAt > current.lastSeenAt) current.lastSeenAt = row.lastSeenAt
    byBot.set(row.bot, current)
  }

  const successfulRuns = runs.filter((run) => run.status === 'SUCCEEDED')
  const ownedRuns = successfulRuns.filter((run) => run.citations.some((citation) => citation.owned))
  const citedRuns = successfulRuns.filter((run) => run.citations.length > 0)
  const ownedPages = new Set(
    successfulRuns.flatMap((run) =>
      run.citations.filter((citation) => citation.owned).map((citation) => citation.normalizedUrl),
    ),
  )

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 30,
    crawlers: {
      requests: crawlerDays.reduce((sum, row) => sum + row.requestCount, 0),
      uniquePages: new Set(crawlerDays.map((row) => row.path)).size,
      successes: crawlerDays.reduce((sum, row) => sum + row.successCount, 0),
      errors: crawlerDays.reduce((sum, row) => sum + row.errorCount, 0),
      rateLimited: crawlerDays.reduce((sum, row) => sum + row.rateLimitedCount, 0),
      byBot: [...byBot.values()]
        .map((row) => ({ ...row, pages: row.pages.size }))
        .sort((a, b) => b.requests - a.requests),
      recentPages: crawlerDays.slice(0, 20),
    },
    referrals: {
      visits: referrals.length,
      uniqueArticles: new Set(referrals.map((row) => row.articleId)).size,
      byChannel: Object.entries(
        referrals.reduce<Record<string, number>>((acc, row) => {
          acc[row.channel] = (acc[row.channel] ?? 0) + 1
          return acc
        }, {}),
      ).map(([channel, visits]) => ({ channel, visits })),
    },
    visibility: {
      providers: visibilityProviderStatuses(),
      successfulRuns: successfulRuns.length,
      citedRuns: citedRuns.length,
      ownedRuns: ownedRuns.length,
      citationCoverage: successfulRuns.length ? ownedRuns.length / successfulRuns.length : null,
      brandMentionCoverage: successfulRuns.length
        ? successfulRuns.filter((run) => run.brandMentioned).length / successfulRuns.length
        : null,
      ownedPages: ownedPages.size,
      recentRuns: runs.slice(0, 30),
    },
    prompts,
    opportunities,
  }
})
