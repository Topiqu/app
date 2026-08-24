import { platformAdsEnabledForPlan, tenantGamEnabled } from './advertising'

export const CONSENT_COOKIE = 'topiqu_consent'
export const CONSENT_VERSION = 2 as const

export type ConsentLauncher = 'client-version' | 'cookie-button' | 'none'

export const consentLauncherFor = (role: string | null | undefined, publication: boolean): ConsentLauncher => {
  if (role === 'admin' || role === 'superadmin') return 'client-version'
  return publication ? 'cookie-button' : 'none'
}

export interface ConsentSite {
  plan?: string | null
  gtagId?: string | null
  allowGtag?: boolean | null
  gamNetworkCode?: string | null
}

export interface ConsentCapabilities {
  analytics: boolean
  googleAnalytics: boolean
  marketing: boolean
}

export interface ConsentDecision {
  version: typeof CONSENT_VERSION
  analytics: boolean
  marketing: boolean
  services: {
    internalAnalytics: boolean
    googleAnalytics: boolean
    marketing: boolean
  }
  decidedAt: string
}

const GA4_ID = /^G-[A-Z0-9]+$/i

export const consentCapabilities = (site?: ConsentSite | null): ConsentCapabilities => {
  if (!site) return { analytics: false, googleAnalytics: false, marketing: false }

  const googleAnalytics = Boolean(
    site.plan !== 'BASIC' && site.allowGtag && site.gtagId?.trim() && GA4_ID.test(site.gtagId.trim()),
  )
  const marketing = platformAdsEnabledForPlan(site.plan) || tenantGamEnabled(site.gamNetworkCode)

  return {
    analytics: true,
    googleAnalytics,
    marketing,
  }
}

export const isConsentDecision = (value: unknown): value is ConsentDecision => {
  if (!value || typeof value !== 'object') return false
  const decision = value as Partial<ConsentDecision>
  return (
    decision.version === CONSENT_VERSION &&
    typeof decision.analytics === 'boolean' &&
    typeof decision.marketing === 'boolean' &&
    typeof decision.decidedAt === 'string' &&
    Boolean(decision.services) &&
    typeof decision.services?.internalAnalytics === 'boolean' &&
    typeof decision.services?.googleAnalytics === 'boolean' &&
    typeof decision.services?.marketing === 'boolean'
  )
}

export const consentCovers = (decision: unknown, capabilities: ConsentCapabilities) => {
  if (!isConsentDecision(decision)) return false
  if (capabilities.analytics && !decision.services.internalAnalytics) return false
  if (capabilities.googleAnalytics && !decision.services.googleAnalytics) return false
  if (capabilities.marketing && !decision.services.marketing) return false
  return true
}

export const createConsentDecision = (
  capabilities: ConsentCapabilities,
  choices: Pick<ConsentDecision, 'analytics' | 'marketing'>,
  decidedAt = new Date().toISOString(),
): ConsentDecision => ({
  version: CONSENT_VERSION,
  analytics: capabilities.analytics && choices.analytics,
  marketing: capabilities.marketing && choices.marketing,
  services: {
    internalAnalytics: capabilities.analytics,
    googleAnalytics: capabilities.googleAnalytics,
    marketing: capabilities.marketing,
  },
  decidedAt,
})

export const hasAnalyticsConsent = (decision: unknown) => isConsentDecision(decision) && decision.analytics

export const hasMarketingConsent = (decision: unknown) => isConsentDecision(decision) && decision.marketing
