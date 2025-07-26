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
      <div
        v-for="comment in topLevelComments"
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
          <CommentReplies
            :article-id="articleId"
            :comments="comment.replies"
            @reply="replyingTo = $event"
          />
        </div>
      </div>
    </div>
    <p v-else class="text-gray-600 text-center text-base">
      Zatím žádné komentáře.
    </p>
  </div>
</template>

<script lang="ts" setup>
import { format } from 'date-fns'

const props = defineProps<{
  articleId: string
  comments?: Comment[]
  isReply?: boolean
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

const comments = computed(() => props.comments || commentsData.value || [])
const topLevelComments = computed(() => {
  const filtered = comments.value.filter((comment) => !comment.parentId)
  return filtered
})

const formatDate = (d: string) => format(new Date(d), 'dd.MM.yyyy, HH:mm')

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
        userId: session?.value?.user?.id,
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

const deleteComment = async (commentId: string) => {
  if (!confirm('Opravdu chcete smazat tento komentář?')) return
  try {
    await $fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
    })
    toast.success({ message: 'Komentář smazán' })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se smazat komentář' })
  }
}
</script>
