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
        plan: { in: ['PRO', 'PREMIUM', 'CUSTOM'] },
        OR: [{ stripeSubscriptionId: { not: null } }, { billingProvider: 'SHOPIFY' }],
      },
      select: {
        id: true,
        plan: true,
        paidTeamSeats: true,
        paidThrough: true,
        stripeSubscriptionId: true,
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
      if (site.plan === 'CUSTOM' && site.paidTeamSeats === null) continue
      let paidThrough = site.paidThrough
      // Bootstrap older annual contracts read-only from the provider, never from a rolling local anniversary.
      if ((!paidThrough || paidThrough <= now) && site.stripeSubscriptionId) {
        try {
          const subscription = await useStripe().subscriptions.retrieve(site.stripeSubscriptionId, {
            expand: ['latest_invoice'],
          })
          if (
            subscription.status !== 'active' ||
            subscriptionPlan(subscription) !== site.plan ||
            primaryPlanItem(subscription)?.price.recurring?.interval !== 'year'
          )
            continue
          const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null
          const end = invoice?.status === 'paid' ? invoice.lines.data[0]?.period.end : null
          if (end) {
            paidThrough = new Date(end * 1000)
            await prisma.clientSite.updateMany({
              where: {
                id: site.id,
                stripeSubscriptionId: subscription.id,
                OR: [{ paidThrough: null }, { paidThrough: { lt: paidThrough } }],
              },
              data: { paidThrough },
            })
          }
        } catch (error) {
          await reportCaughtError('Annual paid period lookup failed', error, { clientSiteId: site.id })
          continue
        }
      }
      if (!paidThrough || paidThrough <= now) continue

      // Catch up after scheduler downtime, with a hard bound against corrupt anchors.
      for (let index = 0; periodStart <= now && index < 12; index += 1) {
        const periodEnd = nextArticleCreditMonth(periodStart)
        if (periodStart >= paidThrough) break
        await creditArticleCredits({
          clientSiteId: site.id,
          amount,
          source: 'PLAN',
          idempotencyKey: `annual:${site.id}:${periodStart.toISOString()}`,
          reason: `${site.plan} monthly articles on annual subscription`,
          periodStart,
          periodEnd: periodEnd < paidThrough ? periodEnd : paidThrough,
          expiresAt: periodEnd < paidThrough ? periodEnd : paidThrough,
        })
        granted += amount
        periodStart = periodEnd
      }
    }

    return { result: { sites: sites.length, granted } }
  },
})
