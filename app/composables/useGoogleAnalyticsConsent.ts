import type { ConsentSite } from '~~/shared/utils/consent'

const removeAnalyticsCookies = () => {
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name && (/^_ga/.test(name) || /^_gid$/.test(name))))
  const parts = window.location.hostname.split('.')
  const domains = parts.map((_, index) => `.${parts.slice(index).join('.')}`)
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`
  }
}

/** The banner owns choices; this composable owns the lifecycle of the Google tag. */
export const useGoogleAnalyticsConsent = (
  site: MaybeRefOrGetter<ConsentSite | null | undefined>,
  enabled: MaybeRefOrGetter<boolean>,
) => {
  const { capabilities, analyticsGranted, marketingGranted } = useConsent(site)
  const { gtag, initialize, enableAnalytics, disableAnalytics } = useGtag()
  const id = computed(() => (capabilities.value.googleAnalytics ? toValue(site)?.gtagId?.trim() : undefined))
  const active = computed(() => toValue(enabled) && analyticsGranted.value)
  const initialized = new Set<string>()
  let previousId: string | undefined

  if (import.meta.client) {
    const removeGuard = useRouter().beforeEach((to) => {
      if (resolvePageShell(to.meta.shell) === 'publication') return
      // History-based enhanced measurement must not send a private route before Vue updates.
      for (const tagId of initialized) disableAnalytics(tagId)
      gtag('consent', 'update', { analytics_storage: 'denied' })
    })
    onBeforeUnmount(() => {
      removeGuard()
      if (previousId) disableAnalytics(previousId)
    })
    watch(
      [id, active, marketingGranted],
      ([tagId, analytics, marketing]) => {
        if (previousId && (previousId !== tagId || !analytics)) disableAnalytics(previousId)
        const adConsent = marketing ? 'granted' : 'denied'
        const consent = {
          analytics_storage: analytics ? 'granted' : 'denied',
          ad_storage: adConsent,
          ad_user_data: adConsent,
          // This integration serves non-personalized ads and does not enable Google Signals.
          ad_personalization: 'denied',
        } as const

        if (!analyticsGranted.value) removeAnalyticsCookies()
        if (!tagId || !analytics) {
          gtag('consent', 'update', consent)
          if (tagId) disableAnalytics(tagId)
          return
        }

        enableAnalytics(tagId)
        if (!initialized.has(tagId)) {
          // nuxt-gtag 4.1 skips config when another tag already created dataLayer.
          const existingQueue = Boolean((window as unknown as { dataLayer?: unknown[] }).dataLayer)
          if (existingQueue) gtag('consent', 'update', consent)
          initialize(tagId)
          if (existingQueue)
            gtag('config', tagId, {
              cookie_domain: 'none',
              allow_google_signals: false,
              allow_ad_personalization_signals: false,
            })
          initialized.add(tagId)
        }
        gtag('consent', 'update', consent)
        previousId = tagId
      },
      { immediate: true },
    )
  }
}
