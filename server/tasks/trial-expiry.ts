import { needsTrialDowngrade } from '~~/shared/utils/trial'

export default defineMonitoredTask({
  meta: {
    name: 'trial-expiry',
    description: 'Drop card-less tenants off the trial plan once the trial window closes',
  },
  async run() {
    const now = new Date()

    const sites = await prisma.clientSite.findMany({
      where: expiredTrialWhere(now),
      select: TRIAL_SELECT,
      take: 200,
    })

    let downgraded = 0

    for (const site of sites) {
      // The SQL filter and the predicate must agree; if they ever drift, the predicate wins.
      if (!needsTrialDowngrade(site, now)) continue

      await downgradeExpiredTrial(site.id, site)
      downgraded++
    }

    return { result: { candidates: sites.length, downgraded } }
  },
})
