import type { SharePlatform } from '~~/generated/zenstack/models'

let fingerprint: Promise<{ get: () => Promise<{ visitorId: string }> }> | undefined

const visitorId = async () => {
  fingerprint ??= import('@fingerprintjs/fingerprintjs').then((m) => m.default.load())
  return (await (await fingerprint).get()).visitorId
}

/** Records a share. Resolves to the server's count, or undefined when tracking failed. */
export function useArticleShare() {
  const { data: session } = useAuth()

  return async (articleId: string, platform: SharePlatform) => {
    try {
      // The server dedupes per identity; an anonymous POST without the fingerprint is a 400.
      const body = { platform, visitorId: session.value?.user?.id ? null : await visitorId() }
      const res = await $fetch<{ shared: number }>(`/api/articles/${articleId}/share`, { method: 'POST', body })
      return res.shared
    } catch (e) {
      // Non-fatal for the visitor, but a silent catch once hid a 500 on every share.
      console.warn('share tracking failed', e)
    }
  }
}
