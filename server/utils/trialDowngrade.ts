import { EXPIRED_TRIAL_TOKEN_LIMIT, TRIAL_DAYS, type TrialInfo } from '~~/shared/utils/trial'

export const TRIAL_SELECT = {
  id: true,
  plan: true,
  createdAt: true,
  firstPaidAt: true,
  stripeSubscriptionId: true,
} as const

/** Mirrors `needsTrialDowngrade` in SQL; the predicate re-checks each row before it is written. */
export const expiredTrialWhere = (now: Date) => ({
  plan: { not: 'BASIC' as const },
  firstPaidAt: null,
  stripeSubscriptionId: null,
  deletedAt: null,
  createdAt: { lte: new Date(now.getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000) },
})

/** Preserve the balance because it may include a purchase, and keep capacity at least as large as
 * that balance. The plan gate stops an expired trial from spending it until the tenant upgrades. */
export const downgradeExpiredTrial = async (clientSiteId: string, site?: TrialInfo) => {
  let tokenLimit = EXPIRED_TRIAL_TOKEN_LIMIT
  await prisma.$transaction(async (tx) => {
    const balance = await tx.clientSite.findUnique({ where: { id: clientSiteId }, select: { tokenRemaining: true } })
    tokenLimit = Math.max(EXPIRED_TRIAL_TOKEN_LIMIT, balance?.tokenRemaining ?? 0)

    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { plan: 'BASIC', tokenLimit },
    })

    await syncPlanFeatures(tx, clientSiteId, 'BASIC')
  })

  await logAction({
    action: 'TRIAL_EXPIRED',
    clientSiteId,
    metadata: { from: site?.plan ?? null, tokenLimit },
  })
}
