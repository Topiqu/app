<template>
  <div
    class="bg-white p-4 sm:p-6 md:p-8 rounded-3xl shadow border border-gray-200 hover:bg-gray-50 transition-colors w-full"
  >
    <div
      class="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4"
    >
      <div
        class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap"
      >
        <Icon
          name="mdi:account-circle-outline"
          class="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 flex-shrink-0"
        />
        <span class="font-semibold text-gray-800">{{
          comment.user?.username || 'Není k dispozici'
        }}</span>
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
    <div
      v-if="!comment.deletedAt"
      class="mt-4 sm:mt-5 flex items-center gap-2 sm:gap-3 flex-wrap"
    >
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
      v-if="comment.replies?.length"
      class="mt-4 sm:mt-6 space-y-4"
      :class="
        depth < 3
          ? 'ml-4 sm:ml-6 border-l border-gray-200 pl-4 bg-neutral-50 rounded-lg py-4'
          : 'ml-2 sm:ml-4 pl-2'
      "
    >
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :is-replying="isReplying"
        :depth="depth < 3 ? depth + 1 : 3"
        @reply="$emit('reply', $event)"
        @delete="$emit('delete', $event)"
        @like="$emit('like', $event)"
        @dislike="$emit('dislike', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { format } from 'date-fns'
import type { CommentWithReplies } from '~/types/comment'

defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
}>()

defineEmits<{
  (
    e: 'reply' | 'delete' | 'like' | 'dislike',
    comment: CommentWithReplies,
  ): void
}>()

const { data: session } = useAuth()
const formatDate = (d: string) => format(new Date(d), 'dd.MM.yyyy, HH:mm')
</script>
