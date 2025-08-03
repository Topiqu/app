<template>
  <div class="w-full mx-auto mt-14">
    <div class="flex items-center gap-3 mb-10">
      <Icon name="mdi:comment-multiple-outline" class="w-8 h-8 text-blue-600" />
      <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
        Komentáře <span class="text-xl text-gray-500">({{ props.commCount }})</span>
      </h2>
    </div>
    <div v-if="session?.user" class="mb-14 p-8 rounded-3xl shadow-xl border border-gray-200">
      <form class="space-y-6" @submit.prevent="submitComment">
        <div class="space-y-2">
          <label for="comment" class="block text-base font-semibold flex items-center gap-2">
            <Icon name="mdi:pencil-outline" class="w-5 h-5" />
            Váš komentář
          </label>
          <div class="relative">
            <Icon name="mdi:comment-outline" class="absolute left-4 top-4 w-5 h-5 text-gray-400 pointer-events-none" />
            <textarea
              id="comment"
              ref="comment"
              v-model="newComment"
              :maxlength="maxLength"
              class="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm resize-y min-h-[100px]"
              placeholder="Napište svůj komentář..."
              required
              :disabled="isSubmitting"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>{{ characterCount }} / {{ maxLength }}</span>
              <span v-if="characterCount >= maxLength" class="text-red-500 font-medium"> Dosáhli jste limitu! </span>
            </div>
          </div>
        </div>
        <div
          v-if="replyingTo"
          class="flex items-center gap-3 text-sm text-gray-700 bg-blue-50/60 p-3 rounded-xl border border-blue-200"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-gray-500" />
          <span
            >Odpovídáte na: <strong>{{ replyingTo.user?.username || 'Není k dispozici' }}</strong></span
          >
          <button
            type="button"
            class="ml-auto text-red-500 hover:text-red-600 bg-white border border-red-100 hover:border-red-300 rounded-full p-1.5 transition duration-150 focus:outline-none focus:ring-2 focus:ring-red-300 cursor-pointer"
            title="Zrušit odpověď"
            @click="replyingTo = null"
          >
            <Icon name="mdi:close" class="w-4 h-4" />
          </button>
        </div>
        <button
          type="submit"
          class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all duration-150 flex items-center gap-2 shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          :disabled="isSubmitting || !!(replyingTo && replyingTo.deletedAt)"
        >
          <Icon v-if="isSubmitting" name="mdi:loading" class="w-4 h-4 animate-spin" />
          {{ replyingTo ? 'Odeslat odpověď' : 'Přidat komentář' }}
        </button>
      </form>
    </div>
    <p v-else class="text-gray-600 mb-14 text-base text-center">
      <NuxtLink to="/login" class="text-blue-600 hover:underline font-medium cursor-pointer">Přihlaste se</NuxtLink>
      pro přidání komentáře.
    </p>
    <div v-if="isLoading" class="flex justify-center mb-10">
      <Icon name="mdi:loading" class="w-8 h-8 text-blue-600 animate-spin" />
    </div>
    <div v-else-if="error" class="text-center p-6 bg-red-50 rounded-2xl shadow border border-red-200">
      <Icon name="mdi:alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p class="text-gray-700">Nepodařilo se načíst komentáře: {{ error.message }}</p>
    </div>
    <div v-else-if="topLevelComments.length" class="w-full max-w-full p-0.25 space-y-6 overflow-x-auto">
      <Comment
        v-for="comment in topLevelComments"
        :key="comment.id"
        :comment="comment"
        :depth="1"
        :isReplying="!!replyingTo"
        @reply="handleReply"
        @delete="handleDelete"
        @like="handleLike"
        @dislike="handleDislike"
        @refresh="refresh()"
      />
    </div>
    <p v-else class="text-gray-600 text-center text-base">Zatím žádné komentáře.</p>
  </div>
</template>

<script lang="ts" setup>
import type { CommentWithReplies } from '~~/types/comment'

const props = defineProps<{ articleId: string; commCount: number }>()

const toast = useToast()
const { data: session } = useAuth()

const newComment = shallowRef<string>('')
const isSubmitting = shallowRef<boolean>(false)
const replyingTo = ref<CommentWithReplies | null>(null)
const textarea = useTemplateRef<HTMLElement>('comment')

const {
  data: commentsData,
  error,
  pending: isLoading,
  refresh,
} = await useFetch<CommentWithReplies[]>(`/api/comments/${props.articleId}`, { default: () => [] })

const maxLength = 1000
const characterCount = computed(() => newComment.value.length)
const topLevelComments = computed(() => commentsData.value || [])

watch(textarea, (val) => {
  console.log('Textarea ref changed', val)
})

onClickOutside(
  textarea,
  (event) => {
    console.log('Click outside triggered', {
      textarea: textarea.value,
      replyingTo: replyingTo.value,
      target: event.target,
      targetIsTextarea: textarea.value?.contains(event.target as Node),
      session: session.value,
    })
    if (replyingTo.value && textarea.value && !textarea.value.contains(event.target as Node)) {
      console.log('Cancelling reply mode')
      replyingTo.value = null
    }
  },
  { ignore: [] },
)

const submitComment = async () => {
  if (!newComment.value.trim() || isSubmitting.value || (replyingTo.value && replyingTo.value.deletedAt)) return
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
    toast.success({ message: replyingTo.value ? 'Odpověď odeslána' : 'Komentář přidán' })
    newComment.value = ''
    replyingTo.value = null
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat komentář' })
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (comment: CommentWithReplies) => {
  if (comment.deletedAt) return
  replyingTo.value = comment
  nextTick(() => {
    console.log('handleReply: textarea ref', textarea.value)
    if (textarea.value) {
      textarea.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      textarea.value.focus()
    } else {
      console.error('handleReply: Textarea not found')
    }
  })
}

const handleDelete = async (comment: CommentWithReplies) => {
  if (!confirm('Opravdu chcete smazat tento komentář?')) return
  try {
    await $fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
    toast.success({ message: 'Komentář smazán' })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se smazat komentář' })
  }
}

const handleLike = async (comment: CommentWithReplies) => {
  if (!session?.value?.user || comment.deletedAt) return
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

const handleDislike = async (comment: CommentWithReplies) => {
  if (!session?.value?.user || comment.deletedAt) return
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
