// Advertising is halted. Retained provider configuration is not an active entitlement.
const advertisingEnabled = false

// GAM is a paid-plan integration; a code left over after a downgrade to BASIC stays inert.
export const tenantGamEnabled = (site?: { plan?: string | null; gamNetworkCode?: string | null } | null) =>
  advertisingEnabled && !!site && site.plan !== 'BASIC' && Boolean(site.gamNetworkCode?.trim())

/** The feed ad slot sits after this many cards — divisible by every grid width (1/2/3 columns). */
export const FEED_AD_AFTER = 6
