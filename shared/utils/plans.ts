export const AI_CAPABLE_PLANS = ['PRO', 'PREMIUM', 'CUSTOM'] as const

export const hasAiPlan = (plan?: string | null): boolean => (AI_CAPABLE_PLANS as readonly string[]).includes(plan ?? '')

// Names as sold on the pricing page; the BASIC enum is marketed as Free.
const PLAN_NAMES: Record<string, string> = { BASIC: 'Free', PRO: 'Pro', PREMIUM: 'Premium', CUSTOM: 'Custom' }

export const planName = (plan?: string | null) => (plan ? (PLAN_NAMES[plan] ?? plan) : '')

/**
 * A paid plan provisioned by hand has no Stripe invoice, and only a permanent contract funds its
 * monthly AI budget without one (`aiAllowance.ts::fund`). A later subscription overwrites it.
 */
export const manualBillingPlan = (plan?: string | null) =>
  plan === 'PRO' || plan === 'PREMIUM' ? ('PERMANENT' as const) : undefined

export type UpgradeTarget = 'PRO' | 'PREMIUM'

const UPGRADE_LADDER: Record<string, UpgradeTarget> = {
  BASIC: 'PRO',
  PRO: 'PREMIUM',
}

export const getUpgradeTarget = (plan?: string | null, hasActiveSubscription?: boolean): UpgradeTarget | null => {
  if (hasActiveSubscription) return null
  return UPGRADE_LADDER[plan ?? ''] ?? null
}

const UPGRADE_TARGETS: UpgradeTarget[] = ['PRO', 'PREMIUM']

/** Every plan above the current one, cheapest first; the first entry is `getUpgradeTarget`. */
export const getUpgradeTargets = (plan?: string | null, hasActiveSubscription?: boolean): UpgradeTarget[] => {
  const next = getUpgradeTarget(plan, hasActiveSubscription)
  return next ? UPGRADE_TARGETS.slice(UPGRADE_TARGETS.indexOf(next)) : []
}
