import type { MaybeRefOrGetter } from 'vue'
import type { ArticleWithDetails } from '~~/types/article'
import type { SharePlatform } from '~~/generated/zenstack/models'

type ActionArticle = Pick<ArticleWithDetails, 'id' | 'status' | 'allowedComments'> & { shared?: number }

export function useArticleActions(
  dataRef: MaybeRefOrGetter<ActionArticle | null | undefined>,
  refreshContext: () => Promise<void>,
) {
  const { t } = useI18n()
  const toast = useToast()
  const clipboard = useClipboard()
  const trackShare = useArticleShare()
  const optimisticStatus = useOptimisticStatus()
  const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()
  const pendingComments = new Set<string>()
  const pendingStatuses = new Set<string>()
  let disposed = false
  let shareVersion = 0
  onScopeDispose(() => {
    disposed = true
    shareVersion++
  })

  const resolvedData = computed(() => toValue(dataRef))
  watch(
    () => resolvedData.value?.id,
    () => shareVersion++,
    { flush: 'sync' },
  )

  const isCurrent = (article: ActionArticle) => !disposed && resolvedData.value?.id === article.id
  const recordShare = async (article: ActionArticle | null | undefined, platform: SharePlatform) => {
    if (!article?.id || disposed) return
    const version = ++shareVersion
    // Take the server's count rather than incrementing locally, so a share that was not
    // counted (repeat click) can't drift the displayed number away from the row.
    const shared = await trackShare(article.id, platform)
    if (shared !== undefined && version === shareVersion && isCurrent(article)) resolvedData.value!.shared = shared
  }
  const share = (platform: SharePlatform) => recordShare(resolvedData.value, platform)

  const copyLink = async (url: string) => {
    const article = resolvedData.value
    try {
      await clipboard.copy(url)
      if (!disposed) toast.add({ color: 'success', title: t('common.actions.copySuccess') })
      await recordShare(article, 'OTHER')
    } catch {
      if (!disposed) toast.add({ color: 'error', title: t('common.messages.operationFailed') })
    }
  }

  const refreshAfterChange = async (article: ActionArticle, invalidate: () => Promise<unknown>, refresh = false) => {
    const results = await Promise.allSettled([
      Promise.resolve().then(invalidate),
      ...(refresh && isCurrent(article) ? [Promise.resolve().then(refreshContext)] : []),
    ])
    if (results.some((result) => result.status === 'rejected'))
      console.warn('[ArticleActions] Could not refresh saved article data.')
  }

  // The switch only emits — it never flips the payload — so this owns the flip. Sending
  // `article.allowedComments` unchanged made the PATCH a no-op and the toast describe the old state.
  const toggleComments = async () => {
    const article = resolvedData.value
    if (!article?.id || disposed || pendingComments.has(article.id)) return

    const previous = article.allowedComments
    const next = !previous
    pendingComments.add(article.id)
    article.allowedComments = next
    const sequence = optimisticStatus.saving()
    try {
      await $fetch<unknown, '/api/articles/:id'>(`/api/articles/${article.id}` as '/api/articles/:id', {
        method: 'PATCH',
        body: { allowedComments: next },
      })
    } catch (error: unknown) {
      pendingComments.delete(article.id)
      optimisticStatus.reverted(sequence)
      if (isCurrent(article)) {
        resolvedData.value!.allowedComments = previous
        toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.messages.operationFailed')) })
      }
      return
    }
    optimisticStatus.saved(sequence)
    if (isCurrent(article)) {
      resolvedData.value!.allowedComments = next
      toast.add({
        color: 'success',
        title: t('articles.comments.toggleSuccess', [
          next ? t('articles.comments.commentsEnabled') : t('articles.comments.commentsDisabledSuccess'),
        ]),
      })
    }
    try {
      await refreshAfterChange(article, invalidateArticles)
    } finally {
      pendingComments.delete(article.id)
    }
  }

  // Send a selection immediately so navigation cannot drop a queued mutation.
  const debouncedSetStatus = async (id: string, status: string) => {
    const article = resolvedData.value
    if (!article || article.id !== id || disposed || pendingStatuses.has(id)) return
    if (status !== 'draft' && status !== 'published' && status !== 'archived') return
    const previous = article.status
    if (previous === status) return
    article.status = status
    pendingStatuses.add(id)
    const sequence = optimisticStatus.saving()
    try {
      await $fetch<unknown, '/api/articles/:id'>(`/api/articles/${id}` as '/api/articles/:id', {
        method: 'PATCH',
        body: { status },
      })
    } catch (error: unknown) {
      pendingStatuses.delete(id)
      optimisticStatus.reverted(sequence)
      if (isCurrent(article)) {
        resolvedData.value!.status = previous
        toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.messages.statusChangeFailed')) })
      }
      return
    }
    optimisticStatus.saved(sequence)
    if (isCurrent(article)) {
      resolvedData.value!.status = status
      toast.add({
        color: 'success',
        title: t('articles.status.changeSuccess', [t(`articles.status.${status}`)]),
      })
    }
    try {
      await refreshAfterChange(article, invalidateArticlesAndStats, true)
    } finally {
      pendingStatuses.delete(id)
    }
  }

  return {
    share,
    copyLink,
    toggleComments,
    debouncedSetStatus,
  }
}
