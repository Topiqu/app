// GAM is a paid-plan integration; a code left over after a downgrade to BASIC stays inert.
export const tenantGamEnabled = (site?: { plan?: string | null; gamNetworkCode?: string | null } | null) =>
  !!site && site.plan !== 'BASIC' && Boolean(site.gamNetworkCode?.trim())

/** The feed ad slot sits after this many cards — divisible by every grid width (1/2/3 columns). */
export const FEED_AD_AFTER = 6
