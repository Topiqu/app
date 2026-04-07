export function useArticleTracking(articleIdRef: Ref<string | undefined>) {
  let fpPromise: Promise<any> | undefined

  const getVisitorId = async () => {
    if (!fpPromise) {
      fpPromise = import('@fingerprintjs/fingerprintjs').then((m) => m.default.load())
    }
    const fp = await fpPromise
    const result = await fp.get()
    return result.visitorId
  }

  const trackView = () => {
    if (!articleIdRef.value || !import.meta.client) return
    const key = `viewed-${articleIdRef.value}`
    const last = sessionStorage.getItem(key)
    const now = Date.now()

    if (last && now - Number(last) < 1000 * 60 * 30) return

    try {
      $fetch(`/api/articles/${articleIdRef.value}/view`, { method: 'POST' })
      sessionStorage.setItem(key, now.toString())
    } catch {
      // Ignored
    }
  }

  return { getVisitorId, trackView }
}
