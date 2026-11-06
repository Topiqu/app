const DAY_MS = 86_400_000
// A rebuild takes about a minute; whoever misses this run is next in an hour.
const MAX_REBUILDS = 5

/** Refilling ahead of the autopilot keeps its article runs free of a paid rebuild and of a week without a topic. */
export default defineMonitoredTask({
  meta: {
    name: 'keyword-plan-refill',
    description: 'Keep two weeks of keyword plan topics ready for sites on the autopilot',
  },
  async run() {
    if (!hasDataForSeo()) return { result: { checked: 0, attempted: 0, failed: 0 } }
    const now = new Date()
    const sites = await prisma.clientSite.findMany({
      where: {
        deletedAt: null,
        generationFrequency: { not: 'NONE' },
        ...activeFeatureFilter('ARTICLE_CRONS'),
        OR: [{ keywordPlanAttemptedAt: null }, { keywordPlanAttemptedAt: { lte: new Date(now.getTime() - DAY_MS) } }],
      },
      select: {
        id: true,
        plan: true,
        language: true,
        focus: true,
        audience: true,
        keywords: true,
        keywordPlanRefreshedAt: true,
        keywordPlanAttemptedAt: true,
        keywordPlanProfile: true,
        keywordMarket: true,
        domain: true,
        articleQuality: true,
        generationFrequency: true,
        timeZone: true,
        releaseHour: true,
        releaseWindowStart: true,
        releaseWindowEnd: true,
        releaseDays: true,
        intervalMinHours: true,
        intervalMaxHours: true,
        articleCreditWallet: {
          select: {
            grants: {
              where: { remaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
              select: { remaining: true },
            },
          },
        },
      },
    })

    let checked = 0
    let attempted = 0
    let failed = 0
    for (const site of sites) {
      if (attempted >= MAX_REBUILDS) break
      const quality = articleQualityOf(site.articleQuality)
      const credits = site.articleCreditWallet?.grants.reduce((total, grant) => total + grant.remaining, 0) ?? 0
      const schedule = releaseScheduleOf(site)
      // A site that cannot write consumes no topics, so its stock waits for the credits.
      if (!schedule || !hasAiPlan(site.plan) || credits < articleCreditCost(quality)) continue
      checked += 1
      try {
        const stock = keywordPlanStock(releaseForecast(schedule, null, now, quality).perMonth)
        if ((await refillKeywordPlan(site, stock, now)).attempted) attempted += 1
      } catch (error) {
        failed += 1
        console.error('[keyword-plan-refill] Site failed:', site.id, (error as Error).message)
      }
    }
    return { result: { checked, attempted, failed } }
  },
})
