import { tenantGamEnabled } from './advertising'

export const CONSENT_COOKIE = 'topiqu_consent'
export const CONSENT_VERSION = 3 as const
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export type ConsentLauncher = 'client-version' | 'cookie-button' | 'none'

/** ClientVersion shows the session tenant's wallet, so on another tenant's blog an admin is a reader. */
export const consentLauncherFor = (
  role: string | null | undefined,
  publication: boolean,
  foreignHost = false,
): ConsentLauncher => {
  if ((role === 'admin' || role === 'superadmin') && !foreignHost) return 'client-version'
  return publication ? 'cookie-button' : 'none'
}

export interface ConsentSite {
  id?: string | null
  plan?: string | null
  gtagId?: string | null
  allowGtag?: boolean | null
  gamNetworkCode?: string | null
}

export interface ConsentCapabilities {
  analytics: boolean
  googleAnalytics: boolean
  marketing: boolean
  configuration?: string
}

export interface ConsentDecision {
  version: typeof CONSENT_VERSION
  analytics: boolean
  marketing: boolean
  configuration: string
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
  const marketing = tenantGamEnabled(site)

  return {
    analytics: true,
    googleAnalytics,
    marketing,
    configuration: JSON.stringify([
      site.id ?? null,
      googleAnalytics ? site.gtagId!.trim() : null,
      marketing ? `gam:${site.gamNetworkCode!.trim()}` : null,
    ]),
  }
}

export const isConsentDecision = (value: unknown): value is ConsentDecision => {
  if (!value || typeof value !== 'object') return false
  const decision = value as Partial<ConsentDecision>
  return (
    decision.version === CONSENT_VERSION &&
    typeof decision.analytics === 'boolean' &&
    typeof decision.marketing === 'boolean' &&
    typeof decision.configuration === 'string' &&
    typeof decision.decidedAt === 'string' &&
    Boolean(decision.services) &&
    typeof decision.services?.internalAnalytics === 'boolean' &&
    typeof decision.services?.googleAnalytics === 'boolean' &&
    typeof decision.services?.marketing === 'boolean'
  )
}

export const consentCovers = (decision: unknown, capabilities: ConsentCapabilities) => {
  if (!isConsentDecision(decision)) return false
  if (decision.configuration !== (capabilities.configuration ?? '')) return false
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
  configuration: capabilities.configuration ?? '',
  services: {
    internalAnalytics: capabilities.analytics,
    googleAnalytics: capabilities.googleAnalytics,
    marketing: capabilities.marketing,
  },
  decidedAt,
})

export const hasAnalyticsConsent = (decision: unknown, capabilities?: ConsentCapabilities) =>
  isConsentDecision(decision) &&
  decision.analytics &&
  decision.services.internalAnalytics &&
  (!capabilities || consentCovers(decision, capabilities))

export const hasMarketingConsent = (decision: unknown, capabilities?: ConsentCapabilities) =>
  isConsentDecision(decision) &&
  decision.marketing &&
  decision.services.marketing &&
  (!capabilities || consentCovers(decision, capabilities))
