export function useArticleTracking(articleIdRef: Ref<string | undefined>) {
  const analyticsGranted = useAnalyticsConsent()
  let viewPending = false
  let request: AbortController | undefined

  const recordView = async () => {
    const id = articleIdRef.value
    if (!id || !import.meta.client || !analyticsGranted.value) return
    const key = `viewed-${id}`
    const now = Date.now()
    let lastViewedAt = 0
    try {
      lastViewedAt = Number(window.sessionStorage.getItem(key)) || 0
    } catch {
      /* Storage may be unavailable. */
    }
    if (lastViewedAt && now - lastViewedAt < 1000 * 60 * 30) return
    request?.abort()
    const controller = new AbortController()
    request = controller
    try {
      const result = await $fetch<{ counted: boolean }>(`/api/articles/${id}/view`, {
        method: 'POST',
        body: { referrer: document.referrer || undefined },
        signal: controller.signal,
      })
      if (result.counted && analyticsGranted.value) {
        try {
          window.sessionStorage.setItem(key, String(now))
        } catch {
          /* Optional cache. */
        }
      }
    } catch {
      /* Measurement must not interrupt reading. */
    } finally {
      if (request === controller) request = undefined
    }
  }

  const trackView = () => {
    if (!analyticsGranted.value) {
      viewPending = true
      return
    }
    void recordView()
  }

  watch(analyticsGranted, (granted) => {
    if (!granted) {
      request?.abort()
      try {
        for (const key of Object.keys(window.sessionStorage))
          if (key.startsWith('viewed-')) window.sessionStorage.removeItem(key)
      } catch {
        /* Storage may be unavailable. */
      }
      return
    }
    if (!viewPending) return
    viewPending = false
    void recordView()
  })
  onBeforeUnmount(() => request?.abort())
  return { trackView }
}
