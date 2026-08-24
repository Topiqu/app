export const platformAdsEnabledForPlan = (plan?: string | null) => plan === 'BASIC'

export const tenantGamEnabled = (networkCode?: string | null) => Boolean(networkCode?.trim())
