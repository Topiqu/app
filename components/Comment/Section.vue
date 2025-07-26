<template>
  <div class="w-full max-w-[90%] xl:max-w-[1280px] mx-auto mt-14 px-4 sm:px-8">
    <div class="flex items-center gap-3 mb-10">
      <Icon name="mdi:comment-multiple-outline" class="w-8 h-8 text-blue-600" />
      <h2 class="text-4xl font-extrabold text-gray-900 tracking-tight">
        Komentáře
      </h2>
    </div>
    <div
      v-if="session?.user"
      class="mb-14 bg-white p-8 rounded-3xl shadow-xl border border-gray-200"
    >
      <form class="space-y-6" @submit.prevent="submitComment">
        <div class="space-y-2">
          <label
            for="comment"
            class="block text-base font-semibold text-gray-700 flex items-center gap-2"
          >
            <Icon name="mdi:pencil-outline" class="w-5 h-5 text-gray-500" />
            Váš komentář
          </label>
          <div class="relative">
            <Icon
              name="mdi:comment-outline"
              class="absolute left-3 top-3 w-6 h-6 text-gray-400"
            />
            <textarea
              id="comment"
              v-model="newComment"
              class="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm resize-y min-h-[100px] placeholder-gray-400"
              placeholder="Napište svůj komentář..."
              required
              maxlength="1000"
              :disabled="isSubmitting"
            />
          </div>
        </div>
        <div
          v-if="replyingTo"
          class="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-gray-500" />
          <span
            >Odpovídáte na:
            <strong>{{
              replyingTo.user?.username || 'Není k dispozici'
            }}</strong></span
          >
          <button
            type="button"
            class="ml-auto text-red-500 hover:text-red-700 font-semibold"
            @click="replyingTo = null"
          >
            <Icon name="mdi:close-circle" class="w-4 h-4" />
          </button>
        </div>
        <button
          type="submit"
          class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition flex items-center gap-2"
          :disabled="isSubmitting"
        >
          <Icon
            v-if="isSubmitting"
            name="mdi:loading"
            class="w-4 h-4 animate-spin"
          />
          {{ replyingTo ? 'Odeslat odpověď' : 'Přidat komentář' }}
        </button>
      </form>
    </div>
    <p v-else class="text-gray-600 mb-14 text-base">
      <NuxtLink to="/login" class="text-blue-600 hover:underline font-medium"
        >Přihlaste se</NuxtLink
      >
      pro přidání komentáře.
    </p>
    <div v-if="isLoading" class="flex justify-center mb-10">
      <Icon name="mdi:loading" class="w-8 h-8 text-blue-600 animate-spin" />
    </div>
    <div
      v-else-if="error"
      class="text-center p-6 bg-white rounded-2xl shadow border border-red-200"
    >
      <Icon name="mdi:alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p class="text-gray-700">
        Nepodařilo se načíst komentáře: {{ error.message }}
      </p>
    </div>
    <div v-else-if="topLevelComments.length" class="space-y-6">
      <Comment
        v-for="comment in topLevelComments"
        :key="comment.id"
        :comment="comment"
        :is-replying="!!replyingTo"
        @reply="handleReply"
        @delete="handleDelete"
        @like="handleLike"
        @dislike="handleDislike"
      />
    </div>
    <p v-else class="text-gray-600 text-center text-base">
      Zatím žádné komentáře.
    </p>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  articleId: string
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
const toast = useToast()
const newComment = ref('')
const replyingTo = ref<Comment | null>(null)
const isSubmitting = ref(false)

const {
  data: commentsData,
  error,
  pending: isLoading,
  refresh,
} = useFetch<Comment[]>(`/api/comments/${props.articleId}`, {
  default: () => [],
  immediate: true,
})

const topLevelComments = computed(() => commentsData.value || [])
console.log(session.value)
const submitComment = async () => {
  if (!newComment.value.trim() || isSubmitting.value) return
  isSubmitting.value = true
  try {
    await $fetch('/api/comments', {
      method: 'POST',
      body: {
        articleId: props.articleId,
        content: newComment.value,
        parentId: replyingTo.value?.id,
        userId: session.value?.user?.id || null,
      },
    })
    toast.success({
      message: replyingTo.value ? 'Odpověď odeslána' : 'Komentář přidán',
    })
    newComment.value = ''
    replyingTo.value = null
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat komentář' })
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (comment: Comment) => {
  replyingTo.value = comment
}

const handleDelete = async (comment: Comment) => {
  if (!confirm('Opravdu chcete smazat tento komentář?')) return
  try {
    await $fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    toast.success({ message: 'Komentář smazán' })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se smazat komentář' })
  }
}

const handleLike = async (comment: Comment) => {
  if (!session?.value?.user) return
  try {
    await $fetch('/api/comments/reaction', {
      method: 'POST',
      body: { commentId: comment.id, type: 'LIKE' },
    })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat reakci' })
  }
}

const handleDislike = async (comment: Comment) => {
  if (!session?.value?.user) return
  try {
    await $fetch('/api/comments/reaction', {
      method: 'POST',
      body: { commentId: comment.id, type: 'DISLIKE' },
    })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat reakci' })
  }
}
</script>
