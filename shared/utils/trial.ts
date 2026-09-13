export const TRIAL_DAYS = 14
export const TRIAL_PLAN = 'PREMIUM'
export const EXPIRED_TRIAL_TOKEN_LIMIT = 100

export interface TrialInfo {
  plan?: string | null
  trialStartedAt?: Date | string | null
  trialEndsAt?: Date | string | null
  trialAcknowledgedAt?: Date | string | null
  firstPaidAt?: Date | string | null
  stripeSubscriptionId?: string | null
}

export type TrialState = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'ACKNOWLEDGED'

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const trialEndsAt = (site?: TrialInfo | null): Date | null => {
  if (!toDate(site?.trialStartedAt)) return null
  return toDate(site?.trialEndsAt)
}

/** Plan and payment fields are consequences, never proof that a trial existed. */
export const trialState = (site?: TrialInfo | null, now: Date = new Date()): TrialState => {
  if (!site || site.firstPaidAt) return 'NONE'
  const endsAt = trialEndsAt(site)
  if (!endsAt) return 'NONE'
  if (site.trialAcknowledgedAt) return 'ACKNOWLEDGED'
  if (now >= endsAt) return site.stripeSubscriptionId ? 'NONE' : 'EXPIRED'
  return site.plan === 'BASIC' ? 'NONE' : 'ACTIVE'
}

export const isInTrial = (site?: TrialInfo | null, now: Date = new Date()): boolean =>
  trialState(site, now) === 'ACTIVE'

export const trialExpired = (site?: TrialInfo | null, now: Date = new Date()): boolean =>
  trialState(site, now) === 'EXPIRED'

/**
 * Stripe owns the lifecycle of a card-backed trial — it promotes on conversion and revokes on
 * a failed first invoice — so downgrading those here would race the webhook mid-conversion.
 */
export const needsTrialDowngrade = (site?: TrialInfo | null, now: Date = new Date()): boolean =>
  trialExpired(site, now) && site?.plan !== 'BASIC'

export const trialDaysLeft = (site?: TrialInfo | null, now: Date = new Date()): number => {
  const endsAt = trialEndsAt(site)
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}
