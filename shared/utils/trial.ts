export const TRIAL_DAYS = 14
export const TRIAL_PLAN = 'PREMIUM'
export const EXPIRED_TRIAL_TOKEN_LIMIT = 100

export interface TrialInfo {
  plan?: string | null
  createdAt?: Date | string | null
  firstPaidAt?: Date | string | null
  stripeSubscriptionId?: string | null
}

const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const trialEndsAt = (site?: TrialInfo | null): Date | null => {
  const created = toDate(site?.createdAt)
  return created ? new Date(created.getTime() + TRIAL_MS) : null
}

/**
 * `firstPaidAt` is the paid marker, not the plan: a trial tenant sits on TRIAL_PLAN from signup,
 * so reading the plan column would call every paying customer a trialist.
 */
export const isInTrial = (site?: TrialInfo | null, now: Date = new Date()): boolean => {
  if (!site || site.firstPaidAt || site.plan === 'BASIC') return false
  const endsAt = trialEndsAt(site)
  return !!endsAt && now < endsAt
}

export const trialExpired = (site?: TrialInfo | null, now: Date = new Date()): boolean => {
  if (!site || site.firstPaidAt) return false
  const endsAt = trialEndsAt(site)
  return !!endsAt && now >= endsAt
}

/**
 * Stripe owns the lifecycle of a card-backed trial — it promotes on conversion and revokes on
 * a failed first invoice — so downgrading those here would race the webhook mid-conversion.
 */
export const needsTrialDowngrade = (site?: TrialInfo | null, now: Date = new Date()): boolean =>
  trialExpired(site, now) && site?.plan !== 'BASIC' && !site?.stripeSubscriptionId

export const trialDaysLeft = (site?: TrialInfo | null, now: Date = new Date()): number => {
  const endsAt = trialEndsAt(site)
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}
