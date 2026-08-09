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

/**
 * `tokenRemaining` is deliberately untouched — a trial tenant can have bought a token pack, and
 * clearing the balance would delete a purchase. The plan gate on generation is what stops an
 * expired trial from spending what is left.
 */
export const downgradeExpiredTrial = async (clientSiteId: string, site?: TrialInfo) => {
  await prisma.$transaction(async (tx) => {
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { plan: 'BASIC', tokenLimit: EXPIRED_TRIAL_TOKEN_LIMIT },
    })

    await syncPlanFeatures(tx, clientSiteId, 'BASIC')
  })

  await logAction({
    action: 'TRIAL_EXPIRED',
    clientSiteId,
    metadata: { from: site?.plan ?? null, tokenLimit: EXPIRED_TRIAL_TOKEN_LIMIT },
  })
}
