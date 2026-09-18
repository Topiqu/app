import type { TrialInfo } from '~~/shared/utils/trial'

export const TRIAL_SELECT = {
  id: true,
  plan: true,
  trialStartedAt: true,
  trialEndsAt: true,
  trialAcknowledgedAt: true,
  firstPaidAt: true,
  stripeSubscriptionId: true,
} as const

/** Mirrors `needsTrialDowngrade` in SQL; the predicate re-checks each row before it is written. */
export const expiredTrialWhere = (now: Date) => ({
  plan: { not: 'BASIC' as const },
  trialStartedAt: { not: null },
  trialEndsAt: { not: null, lte: now },
  trialAcknowledgedAt: null,
  firstPaidAt: null,
  stripeSubscriptionId: null,
  deletedAt: null,
})

/** Plan entitlements and credit are independent. Only explicitly expiring grants can expire. */
export const downgradeExpiredTrial = async (clientSiteId: string, site?: TrialInfo) => {
  await serializableTransaction(async (tx) => {
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { plan: 'BASIC' },
    })

    await syncPlanFeatures(tx, clientSiteId)
  })

  await logAction({
    action: 'TRIAL_EXPIRED',
    clientSiteId,
    metadata: { from: site?.plan ?? null },
  })
}
