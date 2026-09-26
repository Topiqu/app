import type { MaybeRefOrGetter } from 'vue'
import type { SharePlatform } from '~~/generated/zenstack/models'

export function useArticleActions(
  dataRef: MaybeRefOrGetter<any>,
  refreshContext: () => Promise<void>,
) {
  const { t } = useI18n()
  const toast = useToast()
  const clipboard = useClipboard()
  const trackShare = useArticleShare()
  const optimisticStatus = useOptimisticStatus()
  const statusPending = shallowRef(false)

  const resolvedData = computed(() => toValue(dataRef))

  const share = async (platform: SharePlatform) => {
    if (!resolvedData.value?.id) return
    // Take the server's count rather than incrementing locally, so a share that was not
    // counted (repeat click) can't drift the displayed number away from the row.
    const shared = await trackShare(resolvedData.value.id, platform)
    if (shared !== undefined) resolvedData.value.shared = shared
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
    optimisticStatus.saving()
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
      optimisticStatus.saved()
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }
      toast.add({ color: 'error', title: err.data?.message || t('common.messages.operationFailed') })
      article.allowedComments = !article.allowedComments
      optimisticStatus.reverted()
    }
  }

  const debouncedSetStatus = useDebounceFn(async (id: string, status: string) => {
    const article = resolvedData.value
    if (!article || statusPending.value) return
    const previous = article.status
    article.status = status
    statusPending.value = true
    optimisticStatus.saving()
    try {
      await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
      await refreshContext()
      optimisticStatus.saved()
      toast.add({
        color: 'success',
        title: t('articles.status.changeSuccess', [
          status === 'draft' ? t('articles.status.draft') : t('articles.status.published'),
        ]),
      })
    } catch (e: unknown) {
      article.status = previous
      optimisticStatus.reverted()
      const err = e as { data?: { message?: string } }
      toast.add({ color: 'error', title: err.data?.message || t('common.messages.statusChangeFailed') })
    } finally {
      statusPending.value = false
    }
  }, 100)

  return {
    share,
    copyLink,
    toggleComments,
    debouncedSetStatus,
  }
}
