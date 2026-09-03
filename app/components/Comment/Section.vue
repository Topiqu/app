<template>
  <section class="mx-auto mt-14 w-full" :aria-label="$t('articles.comments.title')">
    <div class="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UIcon size="32" name="mdi:comment-multiple-outline" />
      <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
        {{ $t('articles.comments.title') }} <span class="text-xl text-muted">({{ commCount }})</span>
      </h2>
      <div class="flex items-center gap-2 sm:ml-auto">
        <UFormField :label="$t('articles.comments.title')" :ui="{ label: 'sr-only' }">
          <div class="min-w-48">
            <USelectMenu v-model="sort" valueKey="value" labelKey="label" :searchInput="false" :items="sortItems" />
          </div>
        </UFormField>
      </div>
    </div>
    <div v-if="session?.user && props.allowComments" ref="commentForm" class="mb-10">
      <UForm :state="commentState" @submit.prevent="submitComment">
        <div class="space-y-6">
          <UFormField :label="$t('articles.comments.yourComment')" name="comment">
            <div class="relative">
              <UTextarea
                id="comment"
                v-model="newComment"
                :maxlength="maxLength"
                class="min-h-[100px] w-full"
                :ui="{ base: 'pr-14', leading: 'items-center self-stretch' }"
                :placeholder="$t('articles.comments.commentPlaceholder')"
                required
                :disabled="isSubmitting"
              >
                <template #leading><UIcon name="mdi:comment-outline" size="20" class="text-muted" /></template>
              </UTextarea>
              <div class="absolute right-2 top-2 z-10">
                <GifSelector @select="handleGifSelect" />
              </div>
              <div class="mt-1 flex justify-between text-xs text-muted">
                <span>{{ characterCount }} / {{ maxLength }}</span>
                <UBadge v-if="characterCount >= maxLength" color="error" variant="soft" size="sm">
                  {{ $t('articles.comments.characterLimitReached') }}
                </UBadge>
              </div>
              <Gif v-model:content="selectedGifUrl" cancellable />
            </div>
          </UFormField>
          <div v-if="replyingTo" class="flex items-start gap-3 rounded-[var(--topiqu-surface-radius)] bg-elevated p-4">
            <UIcon name="mdi:reply" class="mt-0.5 size-5 shrink-0 text-primary" />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ $t('articles.comments.replyingTo', [replyingTo.user?.username || $t('common.user.notAvailable')]) }}
              </p>
              <p class="mt-1 line-clamp-2 text-sm text-muted">{{ replyingTo.content }}</p>
            </div>
            <UButton
              icon="mdi:close"
              size="sm"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('common.cancelAction')"
              @click="replyingTo = null"
            />
          </div>
          <UButton
            type="submit"
            :loading="isSubmitting"
            :disabled="isSubmitting || !!(replyingTo && replyingTo.deletedAt)"
          >
            {{ replyingTo ? $t('articles.comments.submitReply') : $t('articles.comments.addComment') }}
          </UButton>
        </div>
      </UForm>
    </div>
    <UAlert
      v-else-if="session?.user && !props.allowComments"
      color="neutral"
      variant="soft"
      :title="$t('articles.comments.commentsDisabled')"
    />
    <div
      v-else
      class="mb-10 flex flex-col gap-4 rounded-(--topiqu-surface-radius) border border-default bg-elevated p-4 sm:flex-row sm:items-center"
    >
      <UIcon name="mdi:comment-edit-outline" size="28" class="shrink-0 text-primary" />
      <p class="min-w-0 flex-1 text-sm leading-6 text-muted">{{ $t('common.auth.loginToComment') }}</p>
      <UButton :to="localePath({ name: 'autorizace' })" color="primary" variant="solid" size="sm">
        {{ $t('common.auth.login') }}
      </UButton>
    </div>
    <UProgress v-if="loading && !comments.length" class="mb-10" />
    <UAlert
      v-else-if="error"
      color="error"
      icon="mdi:alert-circle"
      :title="$t('articles.comments.errorLoadingComments', { 0: error.message })"
    />
    <div v-else-if="filteredComments.length" class="w-full max-w-full space-y-6">
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
      <div v-if="hasMore" ref="sentinel" class="h-px" aria-hidden="true" />
      <UProgress v-if="loading" />
    </div>
    <UEmpty v-else icon="mdi:comment-off-outline" :title="$t('articles.comments.noComments')" />
  </section>
</template>

<script lang="ts" setup>
import type { CommentWithReplies } from '~~/types/comment'

interface GiphyGif {
  id: string
  title: string
  images: { fixed_height: { url: string }; original: { url: string } }
}

const toast = useToast(),
  { data: session } = useAuth()
const confirm = useConfirm()
const localePath = useLocalePath()
const props = defineProps<{
  articleId: string
  commCount: number
  allowComments: boolean
}>()

const newComment = shallowRef(''),
  selectedGifUrl = shallowRef<string | null>(null),
  isSubmitting = shallowRef(false),
  replyingTo = ref<CommentWithReplies | null>(null),
  commentForm = useTemplateRef<HTMLElement>('commentForm'),
  sentinel = useTemplateRef('sentinel')
const commentState = computed(() => ({ comment: newComment.value }))
const sort = shallowRef('createdAt:desc'),
  sortItems = [
    {
      label: $t('common.sortOptions.newest'),
      value: 'createdAt:desc',
      icon: 'mdi:clock-outline',
    },
    {
      label: $t('common.sortOptions.oldest'),
      value: 'createdAt:asc',
      icon: 'mdi:clock-time-twelve-outline',
    },
    {
      label: $t('common.sortOptions.mostInteresting'),
      value: 'likes:desc',
      icon: 'mdi:heart',
    },
  ]
const page = shallowRef(1),
  limit = 2,
  max = 100,
  hasMore = shallowRef(true),
  loading = shallowRef(false),
  comments = shallowRef<CommentWithReplies[]>([]),
  maxLength = 1000,
  characterCount = computed(() => newComment.value.length),
  commCount = shallowRef(props.commCount)
const {
  data: commentsData,
  error,
  refresh,
} = await useFetch<{ comments: CommentWithReplies[]; hasMore: boolean }>(`/api/comments/${props.articleId}`, {
  query: { page, limit },
  default: () => ({ comments: [], hasMore: true }),
  watch: false,
})

const filteredComments = computed(() => {
  const [f, o] = sort.value.split(':')
  return [...comments.value].sort((a, b) => {
    const av = f === 'createdAt' ? new Date(a.createdAt).getTime() : a.likes || 0,
      bv = f === 'createdAt' ? new Date(b.createdAt).getTime() : b.likes || 0
    return o === 'asc' ? av - bv : bv - av
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
watch(
  error,
  (e) =>
    e &&
    toast.add({
      color: 'error',
      title: $t('articles.comments.errorLoadingComments', {
        0: e.message || $t('common.error'),
      }),
    }),
)
useInfiniteScroll(
  sentinel,
  async () => {
    if (!hasMore.value || loading.value) return
    page.value++
    await refresh()
  },
  { distance: 100, interval: 300 },
)
const handleGifSelect = (g: GiphyGif) => (selectedGifUrl.value = g.images.original.url)

const submitComment = async () => {
  if (!newComment.value.trim() || isSubmitting.value || (replyingTo.value && replyingTo.value.deletedAt)) return
  isSubmitting.value = true
  try {
    await $fetch('/api/comments', {
      method: 'POST',
      body: {
        articleId: props.articleId,
        content: newComment.value,
        gifUrl: selectedGifUrl.value,
        parentId: replyingTo.value?.id,
        userId: session?.value?.user?.id,
      },
    })
    toast.add({
      color: 'success',
      title: replyingTo.value ? $t('articles.comments.replySubmitted') : $t('articles.comments.commentAdded'),
    })
    newComment.value = ''
    selectedGifUrl.value = null
    replyingTo.value = null
    page.value = 1
    comments.value = []
    commCount.value += 1
    await refresh()
  } catch (e: any) {
    toast.add({
      color: 'error',
      title: e.data?.message || $t('common.messages.operationFailed'),
    })
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (c: CommentWithReplies) =>
  c.deletedAt ||
  ((replyingTo.value = c), nextTick(() => commentForm.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })))

const markAsDeleted = (list: CommentWithReplies[], id: string): boolean => {
  for (const comment of list) {
    if (comment.id === id) {
      comment.deletedAt = new Date()
      return true
    }
    if (comment.replies.length > 0) {
      if (markAsDeleted(comment.replies, id)) return true
    }
  }
  return false
}

const handleDelete = async (c: CommentWithReplies, r: string | null) => {
  if (
    !(await confirm({
      title: $t('common.messages.deleteConfirmTitle'),
      message: $t('common.messages.deleteConfirmText'),
      confirmText: $t('common.actions.delete'),
      cancelText: $t('common.messages.deleteCancel'),
      variant: 'danger',
    }))
  )
    return

  markAsDeleted(comments.value, c.id)
  triggerRef(comments)

  try {
    await $fetch(`/api/comments/${c.id}`, {
      method: 'DELETE',
      body: { reason: r },
    })
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
  } catch (e) {
    console.error(e)
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') })
  }
}
const handleLike = (c: CommentWithReplies) => !c.deletedAt
const handleDislike = (c: CommentWithReplies) => !c.deletedAt
</script>
