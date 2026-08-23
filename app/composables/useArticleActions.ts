import type { MaybeRefOrGetter } from 'vue'
import type { SharePlatform } from '@prisma/client'

export function useArticleActions(
  dataRef: MaybeRefOrGetter<any>,
  refreshContext: () => Promise<void>,
  getVisitorId: () => Promise<string>,
) {
  const { t } = useI18n()
  const toast = useToast()
  const clipboard = useClipboard()
  const { data: session } = useAuth()

  const resolvedData = computed(() => toValue(dataRef))

  const share = async (platform: SharePlatform) => {
    if (!resolvedData.value?.id) return
    try {
      // The server dedupes on this, so an anonymous visitor needs the same fingerprint the
      // like gate uses; a signed-in user is identified by the session and needs no probe.
      const visitorId = session.value?.user?.id ? null : await getVisitorId()

      // Take the server's count rather than incrementing locally, so a share that was not
      // counted (repeat click) can't drift the displayed number away from the row.
      const res = await $fetch<{ shared: number }>(`/api/articles/${resolvedData.value.id}/share`, {
        method: 'POST',
        body: { platform, visitorId },
      })
      resolvedData.value.shared = res.shared
    } catch (e) {
      // Still non-fatal for the visitor — but silence here is what let a 500 on every share
      // (an unapplied migration) look like a working button for a whole afternoon.
      console.warn('share tracking failed', e)
    }
  }

  const copyLink = async (url: string) => {
    clipboard.copy(url)
    toast.add({ color: 'success', title: t('common.actions.copySuccess') })
    await share('OTHER')
  }

  // The switch only emits — it never flips the payload — so this owns the flip. Sending
  // `article.allowedComments` unchanged made the PATCH a no-op and the toast describe the old state.
  const toggleComments = async () => {
    const article = resolvedData.value
    if (!article?.id) return

    const next = !article.allowedComments
    article.allowedComments = next
    try {
      await $fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        body: { allowedComments: next },
      })
      toast.add({
        color: 'success',
        title: t('articles.comments.toggleSuccess', [
          article.allowedComments
            ? t('articles.comments.commentsEnabled')
            : t('articles.comments.commentsDisabledSuccess'),
        ]),
      })
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }
      toast.add({ color: 'error', title: err.data?.message || t('common.messages.operationFailed') })
      article.allowedComments = !article.allowedComments
    }
  }

  const debouncedSetStatus = useDebounceFn(async (id: string, status: string) => {
    try {
      await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
      await refreshContext()
      toast.add({
        color: 'success',
        title: t('articles.status.changeSuccess', [
          status === 'draft' ? t('articles.status.draft') : t('articles.status.published'),
        ]),
      })
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }
      toast.add({ color: 'error', title: err.data?.message || t('common.messages.statusChangeFailed') })
    }
  }, 100)

  return {
    share,
    copyLink,
    toggleComments,
    debouncedSetStatus,
  }
}
