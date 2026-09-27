import type { Ref } from 'vue'
import type { CommentWithReplies } from '~~/types/comment'

export type ReactionType = 'LIKE' | 'DISLIKE'

export interface EmojiReactionState {
  emojiId: string
  count: number
  emoji: { imageUrl: string; shortcode: string }
  hasReacted?: boolean
}

export interface EmojiReactionEvent {
  commentId: string
  emojiId: string
  shortcode: string
  imageUrl: string
  userId: string
  revert?: boolean
}

export function useCommentReactions(
  comment: Ref<CommentWithReplies>,
  opts: { isSiteAdmin: Ref<boolean>; currentUserId: Ref<string | undefined> },
) {
  const toast = useToast()
  const { t } = useI18n()
  const isPending = shallowRef(false)
  const optimisticStatus = useOptimisticStatus()

  const snapshot = (c: CommentWithReplies) => ({
    likes: c.likes ?? 0,
    dislikes: c.dislikes ?? 0,
    userReaction: c.userReaction as { type: ReactionType } | null,
    emojiReactions: [...(c.emojiReactions ?? [])] as EmojiReactionState[],
    publicationLikes: c.publicationLikes,
  })

  const state = reactive(snapshot(comment.value))
  watch(comment, (c) => Object.assign(state, snapshot(c)), { deep: true })

  const counter: Record<ReactionType, 'likes' | 'dislikes'> = { LIKE: 'likes', DISLIKE: 'dislikes' }

  async function updateReaction(type: ReactionType) {
    if (isPending.value) return
    const { likes, dislikes, userReaction, publicationLikes } = state
    const prev = userReaction?.type
    const next = prev === type ? undefined : type

    if (prev) state[counter[prev]]--
    if (next) state[counter[next]]++
    state.userReaction = next ? { type: next } : null
    if (opts.isSiteAdmin.value) state.publicationLikes += Number(next === 'LIKE') - Number(prev === 'LIKE')
    isPending.value = true
    optimisticStatus.saving()

    try {
      await $fetch('/api/comments/reaction', { method: 'POST', body: { commentId: comment.value.id, type } })
      optimisticStatus.saved()
    } catch {
      Object.assign(state, { likes, dislikes, userReaction, publicationLikes })
      optimisticStatus.reverted()
      toast.add({ color: 'error', title: t('articles.comments.reactionFailed') })
    } finally {
      isPending.value = false
    }
  }

  function handleEmojiReaction(data: EmojiReactionEvent) {
    if (data.commentId !== comment.value.id || data.userId !== opts.currentUserId.value) return

    const idx = state.emojiReactions.findIndex((x) => x.emojiId === data.emojiId)
    const existing = state.emojiReactions[idx]

    if (existing) {
      const remove = data.revert || existing.hasReacted
      existing.hasReacted = !remove
      existing.count = remove ? Math.max(0, existing.count - 1) : existing.count + 1
      if (existing.count === 0) state.emojiReactions.splice(idx, 1)
      return
    }
    if (!data.revert) {
      state.emojiReactions.push({
        emojiId: data.emojiId,
        emoji: { shortcode: data.shortcode, imageUrl: data.imageUrl },
        count: 1,
        hasReacted: true,
      })
    }
  }

  return { state, isPending, updateReaction, handleEmojiReaction }
}
