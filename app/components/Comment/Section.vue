<template>
  <div class="w-full mx-auto mt-14">
    <div class="flex items-center gap-3 mb-10">
      <Icon name="mdi:comment-multiple-outline" class="w-8 h-8 text-blue-600" />
      <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
        Komentáře <span class="text-xl text-gray-500">({{ props.commCount }})</span>
      </h2>
      <div class="ml-auto flex items-center gap-2">
        <select
          v-model="sort"
          class="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="createdAt:desc">Nejnovější</option>
          <option value="createdAt:asc">Nejstarší</option>
          <option value="likes:desc">Nejzajímavější</option>
        </select>
      </div>
    </div>
    <div
      v-if="session?.user && props.allowComments"
      ref="commentForm"
      class="mb-14 p-8 rounded-3xl shadow-xl border border-gray-200"
    >
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
              v-model="newComment"
              :maxlength="maxLength"
              class="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm resize-y min-h-[100px]"
              placeholder="Napište svůj komentář..."
              required
              :disabled="isSubmitting"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>{{ characterCount }} / {{ maxLength }}</span>
              <span v-if="characterCount >= maxLength" class="text-red-500 font-medium">Dosáhli jste limitu!</span>
            </div>
          </div>
        </div>
        <div
          v-if="replyingTo"
          class="flex flex-col gap-3 text-sm text-gray-700 bg-blue-50/60 p-3 rounded-xl border border-blue-200"
        >
          <div class="flex items-center gap-3">
            <Icon name="mdi:reply" class="w-4 h-4 text-gray-500" />
            <span
              >Odpovídáte na: <strong>{{ replyingTo.user?.username || 'Není k dispozici' }}</strong></span
            >
            <Button
              icon="mdi:close"
              size="sm"
              variant="danger"
              title="Zrušit odpověď"
              class="!rounded-full ml-auto"
              @click="replyingTo = null"
            />
          </div>
          <div class="text-sm text-gray-600 italic bg-white p-2 rounded-lg border border-gray-100">
            {{ replyingTo.content }}
          </div>
        </div>
        <Button
          type="submit"
          :loading="isSubmitting"
          :disabled="isSubmitting || !!(replyingTo && replyingTo.deletedAt)"
        >
          {{ replyingTo ? 'Odeslat odpověď' : 'Přidat komentář' }}
        </Button>
      </form>
    </div>
    <p v-else-if="session?.user && !props.allowComments" class="text-gray-600 mb-14 text-base text-center">
      Komentování tohoto článku není povoleno.
    </p>
    <p v-else class="text-gray-600 mb-14 text-base text-center">
      <NuxtLink to="/autorizace" class="text-blue-600 hover:underline font-medium cursor-pointer"
        >Přihlaste se</NuxtLink
      >
      pro přidání komentáře.
    </p>
    <div v-if="loading && !comments.length" class="flex justify-center mb-10">
      <Icon name="mdi:loading" class="w-8 h-8 text-blue-600 animate-spin" />
    </div>
    <div v-else-if="error" class="text-center p-6 bg-red-50 rounded-2xl shadow border border-gray-200">
      <Icon name="mdi:alert-circle" class="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p class="text-gray-700">Nepodařilo se načíst komentáře: {{ error.message }}</p>
    </div>
    <div
      v-else-if="filteredComments.length"
      ref="scroll"
      class="w-full max-w-full p-0.25 space-y-6 overflow-y-auto fixed-height"
      :style="{ minHeight: '50vh', maxHeight: '80vh', height: '80vh' }"
    >
      <Comment
        v-for="comment in filteredComments"
        :key="comment.id"
        :comment="comment"
        :depth="1"
        :isReplying="!!replyingTo"
        @reply="handleReply"
        @delete="handleDelete"
        @like="handleLike"
        @dislike="handleDislike"
        @refresh="refresh"
      />
      <div ref="sentinel" class="h-4"></div>
      <div v-if="loading" class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm">Načítání...</div>
      <div v-if="!hasMore && comments.length" class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm">
        Žádné další komentáře
      </div>
    </div>
    <p v-else class="text-gray-600 text-center text-base">Zatím žádné komentáře.</p>
  </div>
</template>

<script lang="ts" setup>
import type { CommentWithReplies } from '~~/types/comment'

const toast = useToast()

const { data: session } = useAuth()

const props = defineProps<{ articleId: string; commCount: number; allowComments: boolean }>()

const newComment = shallowRef<string>('')
const isSubmitting = shallowRef<boolean>(false)
const replyingTo = ref<CommentWithReplies | null>(null)
const commentForm = useTemplateRef<HTMLElement>('commentForm')
const scroll = useTemplateRef('scroll')
const sentinel = useTemplateRef('sentinel')

const sort = shallowRef('createdAt:desc')
const page = shallowRef<number>(1)
const limit = 20
const max = 100
const hasMore = shallowRef<boolean>(true)
const loading = shallowRef<boolean>(false)
const comments = shallowRef<CommentWithReplies[]>([])
const maxLength = 1000
const characterCount = computed(() => newComment.value.length)

const {
  data: commentsData,
  error,
  refresh,
} = await useFetch<{ comments: CommentWithReplies[]; hasMore: boolean }>(`/api/comments/${props.articleId}`, {
  query: { page, limit },
  default: () => ({ comments: [], hasMore: true }),
})

const filteredComments = computed(() => {
  const [field, order] = sort.value.split(':')
  return [...comments.value].sort((a, b) => {
    const av = field === 'createdAt' ? new Date(a.createdAt).getTime() : a.likes || 0
    const bv = field === 'createdAt' ? new Date(b.createdAt).getTime() : b.likes || 0
    return order === 'asc' ? av - bv : bv - av
  })
})

watch(
  commentsData,
  (v) => {
    if (!v) return
    comments.value = page.value === 1 ? v.comments : [...comments.value, ...v.comments]
    hasMore.value = v.hasMore && comments.value.length < max
  },
  { immediate: true },
)

watch(error, (e) => e && toast.error({ message: `Chyba při načítání: ${e.message || 'Neznámá chyba'}` }))

watch(sort, () => nextTick(() => scroll.value && (scroll.value.scrollTop = 0)))

const initObserver = () => {
  if (!sentinel.value || !scroll.value) return
  const obs = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !loading.value && hasMore.value) {
        loading.value = true
        page.value++
        refresh().finally(() => (loading.value = false))
      }
    },
    { root: scroll.value, threshold: 0.1 },
  )
  obs.observe(sentinel.value)
  onUnmounted(() => obs.disconnect())
}

onMounted(initObserver)

onClickOutside(commentForm, (e) => {
  if (replyingTo.value && commentForm.value && !commentForm.value.contains(e.target as Node)) replyingTo.value = null
})

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
    page.value = 1
    comments.value = []
    await refresh()
    nextTick(initObserver)
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat komentář' })
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (c: CommentWithReplies) => {
  if (c.deletedAt) return
  replyingTo.value = c
  nextTick(() => commentForm.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

const handleDelete = async (c: CommentWithReplies, reason: string | null) => {
  if (!confirm('Opravdu chcete smazat tento komentář?')) return
  try {
    await $fetch(`/api/comments/${c.id}`, { method: 'DELETE', body: { reason } })
    toast.success({ message: 'Komentář smazán' })
    await refresh()
    nextTick(initObserver)
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se smazat komentář' })
  }
}

const react = async (c: CommentWithReplies, type: 'LIKE' | 'DISLIKE') => {
  if (c.deletedAt) return
  try {
    await $fetch('/api/comments/reaction', { method: 'POST', body: { commentId: c.id, type } })
    await refresh()
    nextTick(initObserver)
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se přidat reakci' })
  }
}

const handleLike = (c: CommentWithReplies) => react(c, 'LIKE')
const handleDislike = (c: CommentWithReplies) => react(c, 'DISLIKE')
</script>

<style scoped>
.fixed-height {
  max-height: 80vh !important;
  height: 80vh !important;
}
</style>
