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
  opts: { isAuthor: Ref<boolean>; currentUserId: Ref<string | undefined> },
) {
  const toast = useToast()

  const snapshot = (c: CommentWithReplies) => ({
    likes: c.likes ?? 0,
    dislikes: c.dislikes ?? 0,
    userReaction: c.userReaction as { type: ReactionType } | null,
    emojiReactions: [...(c.emojiReactions ?? [])] as EmojiReactionState[],
    isLikedByAuthor: c.isLikedByAuthor,
  })

  const state = reactive(snapshot(comment.value))
  watch(comment, (c) => Object.assign(state, snapshot(c)), { deep: true })

  const counter: Record<ReactionType, 'likes' | 'dislikes'> = { LIKE: 'likes', DISLIKE: 'dislikes' }

  async function updateReaction(type: ReactionType) {
    const prev = state.userReaction?.type
    const isOff = prev === type
    const switching = !!prev && prev !== type

    if (switching && prev) state[counter[prev]]--
    state[counter[type]] += isOff ? -1 : 1
    state.userReaction = isOff ? null : { type }
    if (opts.isAuthor.value) state.isLikedByAuthor = type === 'LIKE' && !isOff

    try {
      await $fetch('/api/comments/reaction', { method: 'POST', body: { commentId: comment.value.id, type } })
    } catch {
      if (switching && prev) state[counter[prev]]++
      state[counter[type]] += isOff ? 1 : -1
      state.userReaction = prev ? { type: prev } : null
      if (opts.isAuthor.value) state.isLikedByAuthor = state.userReaction?.type === 'LIKE'
      toast.error({ message: $t('articles.comments.reactionFailed') })
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

  return { state, updateReaction, handleEmojiReaction }
}
