export function useCommentThreads(articleId: MaybeRefOrGetter<string>, sort: Ref<string>) {
  const { data: session } = useAuth()
  const requestFetch = useRequestFetch()
  const toast = useToast()
  const { t } = useI18n()
  const id = computed(() => toValue(articleId))
  const viewer = computed(() =>
    JSON.stringify([session.value?.user.id, session.value?.user.role, session.value?.user.clientSiteId]),
  )
  const page = shallowRef(1)
  const comments = shallowRef<CommentWithReplies[]>([])
  const hasMore = shallowRef(false)
  const pendingReplies = shallowReactive(new Set<string>())
  const pendingContexts = shallowReactive(new Set<string>())
  const requests = new Map<string, AbortController>()
  let version = 0
  let disposed = false
  const root = useAsyncData(
    computed(() => `comment-threads:${id.value}:${viewer.value}`),
    async (_app, { signal }) => {
      const snapshot = { articleId: id.value, sort: sort.value, page: page.value }
      const result = await requestFetch<CommentPage, '/api/comments/:id'>(
        `/api/comments/${snapshot.articleId}` as '/api/comments/:id',
        {
          query: { page: snapshot.page, limit: 2, sort: snapshot.sort },
          signal,
        },
      )
      return { ...result, ...snapshot }
    },
    { lazy: true, deep: false },
  )
  const loading = computed(() => root.status.value === 'pending')
  const index = computed(() => indexCommentThreads(comments.value))
  const applyRoot = (result: typeof root.data.value) => {
    if (!result || result.articleId !== id.value || result.sort !== sort.value || disposed) return
    comments.value = mergeCommentThreads(comments.value, result.comments, result.page === 1)
    hasMore.value = result.hasMore
  }
  watch(root.data, applyRoot, { immediate: true })
  const ready = root.then(() => applyRoot(root.data.value))

  const cancelChildren = () => {
    version++
    for (const request of requests.values()) request.abort()
    requests.clear()
    pendingReplies.clear()
    pendingContexts.clear()
  }
  const reset = () => {
    cancelChildren()
    page.value = 1
    comments.value = []
    hasMore.value = false
  }
  watch([id, viewer], reset, { flush: 'sync' })
  watch(
    sort,
    () => {
      reset()
      root.clear()
      void root.refresh()
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    cancelChildren()
  })

  const refresh = async () => {
    if (disposed) return
    page.value = 1
    root.clear()
    await root.refresh()
  }
  const loadMore = async () => {
    if (disposed || loading.value || !hasMore.value) return
    const previousPage = page.value
    const generation = version
    page.value++
    root.clear()
    await root.refresh()
    if (!disposed && version === generation && root.error.value) page.value = previousPage
  }
  const loadBranch = async (comment: CommentWithReplies, mode: 'replies' | 'context' | 'refresh') => {
    const context = mode === 'context'
    const pending = mode === 'replies' ? pendingReplies : pendingContexts
    if (
      disposed ||
      pending.has(comment.id) ||
      (context ? !comment.contextParentId : mode === 'replies' && !comment.repliesHasMore)
    )
      return
    const generation = version
    const controller = new AbortController()
    const key = `${mode}:${comment.id}`
    pending.add(comment.id)
    requests.set(key, controller)
    try {
      const result = await $fetch<CommentPage, '/api/comments/:id'>(
        `/api/comments/${id.value}` as '/api/comments/:id',
        {
          query:
            mode === 'replies'
              ? { parent: comment.id, cursor: comment.repliesCursor || undefined }
              : { target: context ? comment.contextParentId : comment.id },
          signal: controller.signal,
        },
      )
      if (disposed || controller.signal.aborted || version !== generation) return
      comments.value = mergeCommentThreads(comments.value, result.comments, context)
      if (result.parent) {
        const parent = index.value.get(result.parent.id)
        if (parent) {
          parent.repliesCursor = result.parent.cursor
          parent.repliesHasMore = result.parent.hasMore
          triggerRef(comments)
        }
      }
    } catch (error: unknown) {
      if (!disposed && !controller.signal.aborted && version === generation)
        toast.add({
          color: 'error',
          title: t('articles.comments.errorLoadingComments', { 0: fetchErrorMessage(error, t('common.error')) }),
        })
    } finally {
      if (requests.get(key) === controller) {
        requests.delete(key)
        pending.delete(comment.id)
      }
    }
  }
  return {
    ready,
    comments,
    index,
    hasMore,
    loading,
    error: root.error,
    refresh,
    loadMore,
    pendingReplies,
    pendingContexts,
    loadReplies: (comment: CommentWithReplies) => loadBranch(comment, 'replies'),
    loadContext: (comment: CommentWithReplies) => loadBranch(comment, 'context'),
    refreshComment: (comment: CommentWithReplies) => loadBranch(comment, 'refresh'),
  }
}
