import type { SharePlatform } from '~~/generated/zenstack/models'

/** Sharing works without analytics; only the optional statistics request is consent-gated. */
export function useArticleShare() {
  const analyticsGranted = useAnalyticsConsent()

  return async (articleId: string, platform: SharePlatform) => {
    if (!analyticsGranted.value) return
    try {
      const res = await $fetch<{ shared?: number }, '/api/articles/:id/share'>(
        `/api/articles/${articleId}/share` as '/api/articles/:id/share',
        {
          method: 'POST',
          body: { platform },
        },
      )
      return res.shared
    } catch (e) {
      // Non-fatal for the visitor, but a silent catch once hid a 500 on every share.
      console.warn('share tracking failed', e)
    }
  }
}
