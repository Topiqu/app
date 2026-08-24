export function useArticleTracking(articleIdRef: Ref<string | undefined>) {
  const consentDecision = useConsentDecision()
  const lastViewedAt = useSessionStorage<number | null>(
    computed(() => `viewed-${articleIdRef.value ?? 'pending'}`),
    null,
  )

  let fpPromise: Promise<any> | undefined

  const getVisitorId = async () => {
    if (!fpPromise) {
      fpPromise = import('@fingerprintjs/fingerprintjs').then((m) => m.default.load())
    }
    const fp = await fpPromise
    const result = await fp.get()
    return result.visitorId
  }

  let viewPending = false

  const recordView = () => {
    if (!articleIdRef.value || !import.meta.client) return
    const now = Date.now()

    if (lastViewedAt.value && now - lastViewedAt.value < 1000 * 60 * 30) return

    try {
      $fetch(`/api/articles/${articleIdRef.value}/view`, { method: 'POST' })
      lastViewedAt.value = now
    } catch {
      // Ignored
    }
  }

  const trackView = () => {
    if (!hasAnalyticsConsent(consentDecision.value)) {
      viewPending = true
      return
    }
    recordView()
  }

  watch(consentDecision, () => {
    if (!viewPending || !hasAnalyticsConsent(consentDecision.value)) return
    viewPending = false
    recordView()
  })

  return { getVisitorId, trackView }
}
