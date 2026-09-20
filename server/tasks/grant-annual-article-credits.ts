import { articleCreditsForPlan, nextArticleCreditMonth } from '~~/shared/utils/articleCredits'

export default defineMonitoredTask({
  meta: {
    name: 'grant-annual-article-credits',
    description: 'Issues monthly article allowances for active annual subscriptions',
  },
  async run() {
    const now = new Date()
    const sites = await prisma.clientSite.findMany({
      where: {
        billingPlan: 'ANNUAL',
        plan: { in: ['PRO', 'PREMIUM'] },
        stripeSubscriptionId: { not: null },
      },
      select: {
        id: true,
        plan: true,
        articleCreditWallet: {
          select: {
            grants: {
              where: { source: 'PLAN' },
              orderBy: { periodEnd: 'desc' },
              take: 1,
              select: { periodEnd: true },
            },
          },
        },
      },
    })

    let granted = 0
    for (const site of sites) {
      let periodStart = site.articleCreditWallet?.grants[0]?.periodEnd
      const amount = articleCreditsForPlan(site.plan)
      if (!periodStart || amount <= 0) continue

      // Catch up after scheduler downtime, with a hard bound against corrupt anchors.
      for (let index = 0; periodStart <= now && index < 12; index += 1) {
        const periodEnd = nextArticleCreditMonth(periodStart)
        await creditArticleCredits({
          clientSiteId: site.id,
          amount,
          source: 'PLAN',
          idempotencyKey: `annual:${site.id}:${periodStart.toISOString()}`,
          reason: `${site.plan} monthly articles on annual subscription`,
          periodStart,
          periodEnd,
          expiresAt: periodEnd,
        })
        granted += amount
        periodStart = periodEnd
      }
    }

    return { result: { sites: sites.length, granted } }
  },
})
