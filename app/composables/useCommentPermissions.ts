import type { Ref } from 'vue'
import type { CommentWithReplies } from '~~/types/comment'

// Mirrors the server checks for the UI only; the endpoints enforce them (moderation also needs CONTENT_MODERATE).
export function useCommentPermissions(comment: Ref<CommentWithReplies>, isReplying: Ref<boolean>) {
  const { data: session } = useAuth()
  const user = computed(() => session.value?.user)
  const isOwn = computed(() => !!user.value && user.value.id === comment.value.userId)
  const isBanned = computed(() => !!comment.value.user?.isBanned)
  const isSiteAdmin = computed(
    () => user.value?.role === 'admin' && user.value.clientSiteId === comment.value.article.clientSiteId,
  )
  const canModerate = computed(() => isSiteAdmin.value && !isOwn.value)

  return reactive({
    user,
    isSiteAdmin,
    isBanned,
    report: computed(() => !!user.value && !isOwn.value && !comment.value.deletedAt && !isBanned.value),
    ban: computed(() => canModerate.value && !isBanned.value),
    unban: computed(() => canModerate.value && isBanned.value),
    reply: computed(() => !!user.value && !isReplying.value && !isBanned.value),
    deleteOwn: isOwn,
    moderateDelete: canModerate,
  })
}
