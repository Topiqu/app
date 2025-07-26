<template>
  <div class="bg-white p-6 rounded-3xl shadow border border-gray-200">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <Icon name="mdi:account-circle-outline" class="w-6 h-6 text-blue-500" />
        <span class="font-semibold text-gray-800">{{
          comment.user?.username || 'Není k dispozici'
        }}</span>
        <span class="text-gray-400 text-sm"
          >• {{ formatDate(comment.createdAt) }}</span
        >
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="session?.user && !isReplying"
          class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-gray-700 hover:bg-blue-600 text-gray-50 hover:text-white font-semibold transition-colors"
          @click="$emit('reply', comment)"
        >
          <Icon name="mdi:reply" class="w-4 h-4" /> Odpovědět
        </button>
        <button
          v-if="session?.user && session.user.id === comment.userId"
          class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-gray-800 hover:bg-red-600 text-gray-50 hover:text-white font-semibold transition-colors"
          @click="$emit('delete', comment)"
        >
          <Icon name="mdi:delete" class="w-4 h-4" /> Smazat
        </button>
      </div>
    </div>
    <p class="mt-4 text-gray-700 whitespace-pre-line">{{ comment.content }}</p>
    <div class="mt-4 flex items-center gap-3">
      <button
        v-if="session?.user"
        class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors"
        :class="
          comment.userReaction?.type === 'LIKE'
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600'
        "
        @click="$emit('like', comment)"
      >
        <Icon name="mdi:thumb-up-outline" class="w-4 h-4" />
        <span>{{ comment.likes || 0 }}</span>
      </button>
      <button
        v-if="session?.user"
        class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md transition-colors"
        :class="
          comment.userReaction?.type === 'DISLIKE'
            ? 'bg-red-100 text-red-600'
            : 'bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600'
        "
        @click="$emit('dislike', comment)"
      >
        <Icon name="mdi:thumb-down-outline" class="w-4 h-4" />
        <span>{{ comment.dislikes || 0 }}</span>
      </button>
    </div>
    <div
      v-if="comment.replies?.length"
      class="mt-6 ml-6 space-y-4 border-l-2 border-gray-200 pl-4"
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

defineProps<{
  comment: Comment
  isReplying: boolean
}>()

defineEmits<{
  (e: 'reply' | 'delete' | 'like' | 'dislike', comment: Comment): void
}>()

interface Comment {
  id: string
  content: string
  createdAt: string
  userId: string
  parentId: string | null
  user: { id: string; username: string } | null
  replies: Comment[]
  likes: number
  dislikes: number
  userReaction?: { type: 'LIKE' | 'DISLIKE' }
}

const { data: session } = useAuth()
const formatDate = (d: string) => format(new Date(d), 'dd.MM.yyyy, HH:mm')
</script>
