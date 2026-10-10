import type { ConsentCapabilities, ConsentDecision, ConsentSite } from '~~/shared/utils/consent'

import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  consentCapabilities,
  consentCovers,
  createConsentDecision,
  hasAnalyticsConsent,
  hasMarketingConsent,
  isConsentDecision,
} from '~~/shared/utils/consent'

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

  watch(
    decision,
    (value) => {
      if (JSON.stringify(cookie.value) !== JSON.stringify(value)) cookie.value = value
    },
    { deep: true, flush: 'sync' },
  )
  watch(
    cookie,
    (value) => {
      const next = isConsentDecision(value) ? value : null
      if (JSON.stringify(decision.value) !== JSON.stringify(next)) decision.value = next
    },
    { deep: true, flush: 'sync' },
  )
  return decision
}

export const useConsentSettingsOpen = () => useState('consent-settings-open', () => false)

export const useAnalyticsConsent = () => {
  const decision = useConsentDecision()
  const capabilities = useState<ConsentCapabilities | null>('consent-capabilities', () => null)
  return computed(() => Boolean(capabilities.value && hasAnalyticsConsent(decision.value, capabilities.value)))
}

export const useMarketingConsent = () => {
  const decision = useConsentDecision()
  const capabilities = useState<ConsentCapabilities | null>('consent-capabilities', () => null)
  return computed(() => Boolean(capabilities.value && hasMarketingConsent(decision.value, capabilities.value)))
}

export const useConsent = (site: MaybeRefOrGetter<ConsentSite | null | undefined>) => {
  const decision = useConsentDecision()
  const settingsOpen = useConsentSettingsOpen()
  const capabilities = computed(() => consentCapabilities(toValue(site)))
  const currentCapabilities = useState<ConsentCapabilities | null>('consent-capabilities', () => null)
  const hasOptionalServices = computed(() => capabilities.value.analytics || capabilities.value.marketing)
  const needsDecision = computed(() => hasOptionalServices.value && !consentCovers(decision.value, capabilities.value))
  const analyticsGranted = computed(
    () =>
      capabilities.value.analytics &&
      hasAnalyticsConsent(decision.value, capabilities.value) &&
      (!currentCapabilities.value || hasAnalyticsConsent(decision.value, currentCapabilities.value)),
  )
  const marketingGranted = computed(
    () =>
      capabilities.value.marketing &&
      hasMarketingConsent(decision.value, capabilities.value) &&
      (!currentCapabilities.value || hasMarketingConsent(decision.value, currentCapabilities.value)),
  )

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
