<template>
  <div
    :id="`comment-${comment.id}`"
    class="w-full min-w-fit bg-white pt-2 pb-0.5 pl-2 pr-0.5 sm:pt-4 sm:pb-1 sm:pl-4 sm:pr-1 md:pt-6 md:pb-1.5 md:pl-6 md:pr-1.5 rounded-3xl shadow border border-gray-200"
  >
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pr-2 sm:pr-4 md:pr-6">
      <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap">
        <UserCard
          v-if="comment.user"
          :user="{
            id: comment.user.id,
            username: comment.user.username,
            email: comment.user.email!,
            createdAt: comment.user.createdAt,
            avatarUrl: comment.user.avatarUrl,
            bio: comment.user.bio,
            lastLogin: comment.user.lastLogin,
            commentsCount: comment.user.commentsCount,
            likesCount: comment.user.likesCount,
            dislikesCount: comment.user.dislikesCount,
          }"
        />
        <span v-else class="font-semibold text-gray-800">Není k dispozici</span>
      </div>
      <div v-if="!comment.deletedAt" class="flex flex-col gap-1 sm:gap-2">
        <button
          v-if="session?.user && !isReplying"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Odpovědět"
          @click="$emit('reply', comment)"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-gray-600" />
          <span class="hidden sm:inline">Odpovědět</span>
        </button>
        <button
          v-if="session?.user && session.user.id === comment.userId"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Smazat komentář"
          @click="$emit('delete', comment)"
        >
          <Icon name="mdi:delete" class="w-4 h-4 text-red-500" />
          <span class="hidden sm:inline">Smazat</span>
        </button>
        <button
          v-if="session?.user"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Nahlásit komentář"
          @click="report(comment)"
        >
          <Icon name="mdi:alert" class="w-4 h-4 text-yellow-500" />
          <span class="hidden sm:inline">Nahlásit</span>
        </button>
      </div>
    </div>
    <div class="mt-4 sm:mt-6">
      <span class="text-xs sm:text-sm md:text-base text-gray-400">• {{ formatDate(comment.createdAt) }}</span>
    </div>
    <p
      class="mt-4 sm:mt-6 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-gray-400 italic': comment.deletedAt }"
    >
      {{ comment.deletedAt ? '[Tento komentář byl smazán]' : comment.content }}
    </p>
    <div
      v-if="!comment.deletedAt"
      class="mt-4 sm:mt-5 flex items-center justify-between flex-wrap gap-3 pb-2 sm:pb-4 md:pb-6"
    >
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          v-if="session?.user"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 bg-gray-100"
          :class="comment.userReaction?.type === 'LIKE' ? 'bg-green-100 text-green-600' : 'text-gray-600'"
          @click="$emit('like', comment)"
        >
          <Icon name="mdi:thumb-up-outline" class="w-4 h-4" />
          <span>{{ comment.likes || 0 }}</span>
        </button>
        <button
          v-if="session?.user"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 bg-gray-100"
          :class="comment.userReaction?.type === 'DISLIKE' ? 'bg-red-100 text-red-600' : 'text-gray-600'"
          @click="$emit('dislike', comment)"
        >
          <Icon name="mdi:thumb-down-outline" class="w-4 h-4" />
          <span>{{ comment.dislikes || 0 }}</span>
        </button>
        <div v-if="comment.emojiReactions?.length" class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div
            v-for="reaction in comment.emojiReactions"
            :key="reaction.emojiId"
            v-tippy="{ content: reaction.emoji.shortcode, placement: 'top' }"
            class="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 bg-gray-100 text-gray-600"
          >
            <img :src="reaction.emoji.imageUrl" :alt="reaction.emoji.shortcode" class="w-4 h-4" />
            <span>{{ reaction.count }}</span>
          </div>
        </div>
      </div>
      <div>
        <EmojiPopover :commentId="comment.id" :articleId="comment.articleId!" @reaction="$emit('refresh')" />
      </div>
    </div>
    <div v-if="comment.replies?.length" class="mt-4 sm:mt-6 space-y-4">
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :isReplying="isReplying"
        :depth="depth < 12 ? depth + 1 : depth"
        @reply="$emit('reply', $event)"
        @delete="$emit('delete', $event)"
        @like="$emit('like', $event)"
        @dislike="$emit('dislike', $event)"
        @refresh="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithReplies } from '~~/types/comment'

import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
}>()

defineEmits<{
  (e: 'reply' | 'delete' | 'like' | 'dislike', comment: CommentWithReplies): void
  (e: 'refresh'): void
}>()

const { data: session } = useAuth()
const toast = useToast()

const report = async (c: CommentWithReplies) => {
  try {
    await $fetch('/api/notifications', {
      method: 'POST',
      body: { commentId: c.id },
    })
    toast.success({ message: 'Komentář nahlášen' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nahlášení selhalo' })
  }
}
</script>
