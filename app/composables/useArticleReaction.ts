import type { MaybeRefOrGetter } from 'vue'

type ArticleReaction = { liked: boolean; likes: number }
type ReactionRequest = (url: string, options: { method: 'POST' }) => Promise<ArticleReaction>

export function useArticleReaction(
  articleId: MaybeRefOrGetter<string | null | undefined>,
  initialReaction: MaybeRefOrGetter<ArticleReaction>,
  request: ReactionRequest = (url, options) => $fetch<ArticleReaction>(url, options),
) {
  const state = useState<Record<string, ArticleReaction>>('article-card-reactions', () => ({}))
  const pending = useState<Record<string, boolean>>('article-reaction-pending', () => ({}))
  const toast = useToast()
  const { t } = useI18n()
  const optimisticStatus = useOptimisticStatus()

  const current = computed(() => {
    const id = toValue(articleId)
    return (id && state.value[id]) || toValue(initialReaction)
  })
  const isPending = computed(() => {
    const id = toValue(articleId)
    return !!(id && pending.value[id])
  })

  const toggle = async () => {
    const id = toValue(articleId)
    if (!id || pending.value[id]) return

    const previous = { ...current.value }
    const optimistic = {
      liked: !previous.liked,
      likes: Math.max(0, previous.likes + (previous.liked ? -1 : 1)),
    }
    state.value = { ...state.value, [id]: optimistic }
    pending.value = { ...pending.value, [id]: true }
    optimisticStatus.saving()

    try {
      const confirmed = await request(`/api/articles/${id}/reaction`, { method: 'POST' })
      state.value = { ...state.value, [id]: confirmed }
      optimisticStatus.saved()
      return confirmed
    } catch (error: any) {
      state.value = { ...state.value, [id]: previous }
      optimisticStatus.reverted()
      toast.add({
        color: 'error',
        title: t('articles.comments.reactionFailed'),
        description: error?.data?.message,
      })
    } finally {
      const { [id]: _finished, ...rest } = pending.value
      pending.value = rest
    }
  }

  return {
    liked: computed(() => current.value.liked),
    likes: computed(() => current.value.likes),
    isPending,
    toggle,
  }
}
