<template>
  <div class="space-y-4">
    <div
      v-for="comment in comments"
      :key="comment.id"
      class="bg-white p-6 rounded-3xl shadow border border-gray-200"
    >
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <Icon
            name="mdi:account-circle-outline"
            class="w-6 h-6 text-blue-500"
          />
          <span class="font-semibold text-gray-800">{{
            comment.user?.username || 'Není k dispozici'
          }}</span>
          <span class="text-gray-400 text-sm"
            >• {{ formatDate(comment.createdAt) }}</span
          >
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="session?.user && !replyingTo"
            class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 transition"
            @click="replyingTo = comment"
          >
            <Icon name="mdi:reply" class="w-4 h-4" /> Odpovědět
          </button>
          <button
            v-if="session?.user && session.user.id === comment.userId"
            class="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 transition"
            @click="deleteComment(comment.id)"
          >
            <Icon name="mdi:delete" class="w-4 h-4" /> Smazat
          </button>
        </div>
      </div>
      <p class="mt-4 text-gray-700 whitespace-pre-line">
        {{ comment.content }}
      </p>
      <div
        v-if="comment.replies?.length"
        class="mt-6 ml-6 space-y-4 border-l-2 border-gray-200 pl-4"
      >
        <CommentReplies :comments="comment.replies" :article-id="articleId" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { format } from 'date-fns'

const props = defineProps<{
  articleId: string
  comments: Comment[]
}>()

interface Comment {
  id: string
  content: string
  createdAt: string
  user: { id: string; username: string } | null
  userId: string
  parentId: string | null
  replies?: Comment[]
}

const { data: session } = useAuth()
const toast = useToast()
const replyingTo = ref<Comment | null>(null)

const formatDate = (d: string) => format(new Date(d), 'dd.MM.yyyy, HH:mm')

const deleteComment = async (commentId: string) => {
  if (!confirm('Opravdu chcete smazat tento komentář?')) return
  try {
    await $fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
    })
    toast.success({ message: 'Komentář smazán' })
    await refreshNuxtData(`/api/comments/${props.articleId}`)
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se smazat komentář' })
  }
}

const emit = defineEmits<{
  (e: 'reply', comment: Comment): void
}>()

watch(replyingTo, (newValue) => {
  if (newValue) emit('reply', newValue)
})
</script>
