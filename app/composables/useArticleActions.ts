import type { MaybeRefOrGetter } from 'vue'

export function useArticleActions(dataRef: MaybeRefOrGetter<any>, refreshContext: () => Promise<void>) {
  const { t } = useI18n()
  const toast = useToast()
  const clipboard = useClipboard()

  const resolvedData = computed(() => toValue(dataRef))

  const share = async (platform: 'TWITTER' | 'LINKEDIN' | 'OTHER') => {
    if (!resolvedData.value?.id) return
    try {
      await $fetch(`/api/articles/${resolvedData.value.id}/share`, { method: 'POST', body: { platform } })
      resolvedData.value.shared = (resolvedData.value.shared || 0) + 1
    } catch {
      // Intentionally ignoring minor share tracking errors
    }
  }

  const copyLink = async (url: string) => {
    clipboard.copy(url)
    toast.success({ message: t('common.actions.copySuccess') })
    await share('OTHER')
  }

  const toggleComments = async () => {
    const article = resolvedData.value
    if (!article?.id) return
    try {
      await $fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        body: { allowedComments: article.allowedComments },
      })
      toast.success({
        message: t('articles.comments.toggleSuccess', [
          article.allowedComments
            ? t('articles.comments.commentsEnabled')
            : t('articles.comments.commentsDisabledSuccess'),
        ]),
      })
      await refreshContext()
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }
      toast.error({ message: err.data?.message || t('common.messages.operationFailed') })
      article.allowedComments = !article.allowedComments
    }
  }

  const debouncedSetStatus = useDebounceFn(async (id: string, status: string) => {
    try {
      await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
      await refreshContext()
      toast.success({
        message: t('articles.status.changeSuccess', [
          status === 'draft' ? t('articles.status.draft') : t('articles.status.published'),
        ]),
      })
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } }
      toast.error({ message: err.data?.message || t('common.messages.statusChangeFailed') })
    }
  }, 100)

  return {
    share,
    copyLink,
    toggleComments,
    debouncedSetStatus,
  }
}
