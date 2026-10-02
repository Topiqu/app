export const platformAdsEnabledForPlan = (plan?: string | null) => plan === 'BASIC'

export const tenantGamEnabled = (networkCode?: string | null) => Boolean(networkCode?.trim())

export type AdProvider = 'adsense' | 'gam' | null

/** The feed ad slot sits after this many cards — divisible by every grid width (1/2/3 columns). */
export const FEED_AD_AFTER = 6

// Platform AdSense wins on BASIC even if a GAM code survived a downgrade: that inventory is ours.
export const adProviderFor = (
  site: { plan?: string | null; gamNetworkCode?: string | null } | null | undefined,
  { marketing, adsenseSlot }: { marketing: boolean; adsenseSlot?: string | null },
): AdProvider => {
  if (!site || !marketing) return null
  if (platformAdsEnabledForPlan(site.plan)) return adsenseSlot?.trim() ? 'adsense' : null
  return tenantGamEnabled(site.gamNetworkCode) ? 'gam' : null
}
