<template>
  <div
    class="bg-white p-4 sm:p-6 md:p-8 rounded-3xl shadow border border-gray-200 hover:bg-gray-50 transition-colors w-full"
    :class="{
      'ml-0': depth === 1,
      'ml-4 sm:ml-6': depth === 2,
      'ml-8 sm:ml-10': depth >= 3,
    }"
  >
    <div class="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4">
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
        <span class="text-gray-400">• {{ formatDate(comment.createdAt) }}</span>
      </div>
      <div v-if="!comment.deletedAt" class="flex items-center gap-2 sm:gap-3">
        <button
          v-if="session?.user && !isReplying"
          class="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer hover:scale-[1.02]"
          aria-label="Odpovědět na komentář"
          @click="$emit('reply', comment)"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-inherit" />
          <span>Odpovědět</span>
        </button>
        <button
          v-if="session?.user && session.user.id === comment.userId"
          class="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer hover:scale-[1.02]"
          aria-label="Smazat komentář"
          @click="$emit('delete', comment)"
        >
          <Icon name="mdi:delete" class="w-4 h-4 text-inherit" />
          <span>Smazat</span>
        </button>
      </div>
    </div>
    <p
      class="mt-4 sm:mt-6 text-gray-700 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-gray-400 italic': comment.deletedAt }"
    >
      {{ comment.deletedAt ? '[Tento komentář byl smazán]' : comment.content }}
    </p>
    <div v-if="!comment.deletedAt" class="mt-4 sm:mt-5 flex items-center gap-2 sm:gap-3 flex-wrap">
      <button
        v-if="session?.user"
        class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
        :class="
          comment.userReaction?.type === 'LIKE'
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600'
        "
        @click="$emit('like', comment)"
      >
        <Icon name="mdi:thumb-up-outline" class="w-4 h-4 text-inherit" />
        <span>{{ comment.likes || 0 }}</span>
      </button>
      <button
        v-if="session?.user"
        class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
        :class="
          comment.userReaction?.type === 'DISLIKE'
            ? 'bg-red-100 text-red-600'
            : 'bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600'
        "
        @click="$emit('dislike', comment)"
      >
        <Icon name="mdi:thumb-down-outline" class="w-4 h-4 text-inherit" />
        <span>{{ comment.dislikes || 0 }}</span>
      </button>
    </div>
    <div
      v-if="comment.replies?.length && depth < 3"
      class="mt-4 sm:mt-6 space-y-4"
    >
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :isReplying="isReplying"
        :depth="depth + 1"
        @reply="$emit('reply', $event)"
        @delete="$emit('delete', $event)"
        @like="$emit('like', $event)"
        @dislike="$emit('dislike', $event)"
      />
    </div>
    <div
      v-if="comment.replies?.length && depth === 3"
      class="mt-4 sm:mt-6 space-y-4"
    >
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :isReplying="isReplying"
        :depth="depth"
        @reply="$emit('reply', $event)"
        @delete="$emit('delete', $event)"
        @like="$emit('like', $event)"
        @dislike="$emit('dislike', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithReplies } from '~~/types/comment'

import { format } from 'date-fns'

defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
}>()

defineEmits<{
  (e: 'reply' | 'delete' | 'like' | 'dislike', comment: CommentWithReplies): void
}>()

const { data: session } = useAuth()

const formatDate = (d?: string | Date) => (d ? format(new Date(d), 'dd.MM.yyyy, HH:mm') : 'Nikdy')
</script>
