import type { Ref } from 'vue'
import type { CommentWithReplies } from '~~/types/comment'

export function useCommentPermissions(comment: Ref<CommentWithReplies>, isReplying: Ref<boolean>) {
  const { data: session } = useAuth()

  return reactive({
    user: computed(() => session.value?.user),
    isAdmin: computed(() => session.value?.user?.role === 'admin'),
    isOwn: computed(() => session.value?.user?.id === comment.value.userId),
    isAuthor: computed(() => session.value?.user?.id === comment.value.article.userId),
    isBanned: computed(() => !!comment.value.user?.isBanned),
    isSameSite: computed(() => session.value?.user?.clientSiteId === comment.value.article?.clientSiteId),

    report: computed(() => {
      const u = session.value?.user
      return !!u && !comment.value.deletedAt && !comment.value.user?.isBanned && u.id !== comment.value.userId
    }),
    ban: computed(() => {
      const u = session.value?.user
      return (
        !!u &&
        u.role === 'admin' &&
        u.clientSiteId === comment.value.article?.clientSiteId &&
        u.id !== comment.value.userId &&
        !comment.value.user?.isBanned
      )
    }),
    unban: computed(() => {
      const u = session.value?.user
      return (
        !!u &&
        u.role === 'admin' &&
        u.clientSiteId === comment.value.article?.clientSiteId &&
        u.id !== comment.value.userId &&
        !!comment.value.user?.isBanned
      )
    }),
    reply: computed(() => !!session.value?.user && !isReplying.value && !comment.value.user?.isBanned),
    deleteOwn: computed(() => !!session.value?.user && session.value.user.id === comment.value.userId),
    moderateDelete: computed(() => {
      const u = session.value?.user
      return !!u && u.role === 'admin' && u.id === comment.value.article?.userId && !comment.value.user?.isBanned
    }),
  })
}
