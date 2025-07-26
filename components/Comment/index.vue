<template>
  <div
    class="bg-white p-8 rounded-3xl shadow border border-gray-200 hover:bg-gray-50 transition-colors"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3 text-sm md:text-base">
        <Icon name="mdi:account-circle-outline" class="w-6 h-6 text-blue-500" />
        <span class="font-semibold text-gray-800">
          {{ comment.user?.username || 'Není k dispozici' }}
        </span>
        <span class="text-gray-400">• {{ formatDate(comment.createdAt) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="session?.user && !isReplying"
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer hover:scale-[1.02]"
          aria-label="Odpovědět na komentář"
          @click="$emit('reply', comment)"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-inherit" />
          <span>Odpovědět</span>
        </button>

        <button
          v-if="session?.user && session.user.id === comment.userId"
          class="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer hover:scale-[1.02]"
          aria-label="Smazat komentář"
          @click="$emit('delete', comment)"
        >
          <Icon name="mdi:delete" class="w-4 h-4 text-inherit" />
          <span>Smazat</span>
        </button>
      </div>
    </div>

    <p class="mt-6 text-gray-700 whitespace-pre-line text-sm md:text-base">
      {{ comment.content }}
    </p>

    <div class="mt-5 flex items-center gap-3">
      <button
        v-if="session?.user"
        class="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
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
        class="flex items-center gap-1 px-3 py-1.5 text-sm rounded-xl shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
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
      class="mt-6 ml-6 space-y-4 border-l border-gray-200 pl-4 bg-neutral-50 rounded-lg py-4"
    >
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :is-replying="isReplying"
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
