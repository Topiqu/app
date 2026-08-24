import type { ConsentDecision, ConsentSite } from '~~/shared/utils/consent'

import {
  CONSENT_COOKIE,
  consentCapabilities,
  consentCovers,
  createConsentDecision,
  hasAnalyticsConsent,
  hasMarketingConsent,
  isConsentDecision,
} from '~~/shared/utils/consent'

const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export const useConsentDecision = () => {
  const cookie = useCookie<ConsentDecision | null>(CONSENT_COOKIE, {
    default: () => null,
    maxAge: CONSENT_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: useRequestURL().protocol === 'https:',
  })
  const decision = useState<ConsentDecision | null>('consent-decision', () =>
    isConsentDecision(cookie.value) ? cookie.value : null,
  )

  watch(decision, (value) => (cookie.value = value), { deep: true })
  return decision
}

export const useConsentSettingsOpen = () => useState('consent-settings-open', () => false)

export const useConsent = (site: MaybeRefOrGetter<ConsentSite | null | undefined>) => {
  const decision = useConsentDecision()
  const settingsOpen = useConsentSettingsOpen()
  const capabilities = computed(() => consentCapabilities(toValue(site)))
  const hasOptionalServices = computed(() => capabilities.value.analytics || capabilities.value.marketing)
  const needsDecision = computed(() => hasOptionalServices.value && !consentCovers(decision.value, capabilities.value))
  const analyticsGranted = computed(() => capabilities.value.analytics && hasAnalyticsConsent(decision.value))
  const marketingGranted = computed(() => capabilities.value.marketing && hasMarketingConsent(decision.value))

  const save = (choices: Pick<ConsentDecision, 'analytics' | 'marketing'>) => {
    decision.value = createConsentDecision(capabilities.value, choices)
    settingsOpen.value = false
  }

  const acceptAll = () => save({ analytics: true, marketing: true })
  const rejectAll = () => save({ analytics: false, marketing: false })

  return {
    decision,
    settingsOpen,
    capabilities,
    hasOptionalServices,
    needsDecision,
    analyticsGranted,
    marketingGranted,
    save,
    acceptAll,
    rejectAll,
  }
}
