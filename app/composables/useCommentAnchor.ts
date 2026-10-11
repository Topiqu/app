import type { CommentWithReplies } from '~~/types/comment'

export function useCommentAnchor(articleId: Ref<string>, comments: ShallowRef<CommentWithReplies[]>) {
  const route = useRoute()
  const toast = useToast()
  const { t } = useI18n()

  onMounted(() => {
    watch(
      () => route.hash,
      async (hash, _previous, onCleanup) => {
        if (!hash.startsWith('#comment-')) return
        const id = hash.slice('#comment-'.length)
        if (!id) return

        const controller = new AbortController()
        onCleanup(() => controller.abort())

        try {
          if (!document.getElementById(hash.slice(1))) {
            const result = await $fetch<{ comments: CommentWithReplies[] }>(`/api/comments/${articleId.value}`, {
              query: { target: id },
              signal: controller.signal,
            })
            if (controller.signal.aborted) return
            comments.value = [
              ...result.comments.filter((comment) => !comments.value.some((item) => item.id === comment.id)),
              ...comments.value,
            ]
          }

          await nextTick()
          if (controller.signal.aborted) return
          const target = document.getElementById(hash.slice(1))
          target?.scrollIntoView({ block: 'start' })
          target?.focus({ preventScroll: true })
        } catch (error) {
          if (controller.signal.aborted) return
          toast.add({
            color: 'error',
            title: t('articles.comments.errorLoadingComments', { 0: fetchErrorMessage(error, t('common.error')) }),
          })
        }
      },
      { immediate: true },
    )
  })
}
