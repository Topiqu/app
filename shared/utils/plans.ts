export type UpgradeTarget = 'PRO' | 'PREMIUM'

const UPGRADE_LADDER: Record<string, UpgradeTarget> = {
  BASIC: 'PRO',
  PRO: 'PREMIUM',
}

export const getUpgradeTarget = (plan?: string | null, hasActiveSubscription?: boolean): UpgradeTarget | null => {
  if (hasActiveSubscription) return null
  return UPGRADE_LADDER[plan ?? ''] ?? null
}
