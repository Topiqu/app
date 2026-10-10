import type { H3Event } from 'h3'
import type { ConsentSite } from '~~/shared/utils/consent'

import { getCookie } from 'h3'
import { CONSENT_COOKIE, consentCapabilities, hasAnalyticsConsent } from '~~/shared/utils/consent'

export const articleAnalyticsAllowed = (event: H3Event, site?: ConsentSite) => {
  const raw = getCookie(event, CONSENT_COOKIE)
  if (!raw) return false
  try {
    return hasAnalyticsConsent(JSON.parse(raw), site ? consentCapabilities(site) : undefined)
  } catch {
    return false
  }
}
