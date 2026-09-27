export function useArticleTracking(articleIdRef: Ref<string | undefined>) {
  const consentDecision = useConsentDecision()
  const lastViewedAt = useSessionStorage<number | null>(
    computed(() => `viewed-${articleIdRef.value ?? 'pending'}`),
    null,
  )

  let viewPending = false

  const recordView = () => {
    if (!articleIdRef.value || !import.meta.client) return
    const now = Date.now()

    if (lastViewedAt.value && now - lastViewedAt.value < 1000 * 60 * 30) return

    try {
      $fetch(`/api/articles/${articleIdRef.value}/view`, {
        method: 'POST',
        body: { referrer: document.referrer || undefined },
      })
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

  return { trackView }
}
