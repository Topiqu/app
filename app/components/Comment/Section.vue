<template>
  <section id="comments" class="mx-auto mt-14 w-full scroll-mt-24" :aria-label="$t('articles.comments.title')">
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
                class="w-full"
                :ui="{ base: 'min-h-[100px] pe-14', leading: 'items-center self-stretch', trailing: 'items-start' }"
                :placeholder="$t('articles.comments.commentPlaceholder')"
                required
                :disabled="isSubmitting"
              >
                <template #leading><UIcon name="mdi:comment-outline" size="20" class="text-muted" /></template>
                <template v-if="allowGifs" #trailing><GifSelector @select="handleGifSelect" /></template>
              </UTextarea>
              <div class="mt-1 flex justify-between text-xs text-muted">
                <span>{{ characterCount }} / {{ maxLength }}</span>
                <UBadge v-if="characterCount >= maxLength" color="error" variant="soft" size="sm">
                  {{ $t('articles.comments.characterLimitReached') }}
                </UBadge>
              </div>
              <Gif v-if="allowGifs" v-model:content="selectedGifUrl" cancellable />
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
      v-else-if="!props.allowComments"
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
    <div v-if="loading && !comments.length" class="mb-10 space-y-4" aria-busy="true">
      <USkeleton v-for="index in 2" :key="index" class="h-40 w-full" />
    </div>
    <UAlert
      v-if="error"
      color="error"
      icon="mdi:alert-circle"
      :title="$t('articles.comments.errorLoadingComments', { 0: error.message })"
    >
      <template #actions>
        <UButton color="error" variant="soft" @click="refresh">{{ $t('common.messages.retry') }}</UButton>
      </template>
    </UAlert>
    <div v-if="comments.length" class="w-full max-w-full space-y-6">
      <div v-for="thread in visibleThreads" :key="thread[0]?.comment.id" class="space-y-4">
        <div v-for="{ comment, depth } in thread" :key="comment.id" :class="depth > 1 ? 'sm:pl-4' : ''">
          <Comment
            :comment="comment"
            :depth="Math.min(depth, 12)"
            :isReplying="!!replyingTo"
            :publication
            :allowReplies="allowComments"
            :allowGifs
            :pendingReplies
            :pendingContexts
            :class="optimisticCommentIds.has(comment.id) ? 'opacity-60' : ''"
            :aria-busy="optimisticCommentIds.has(comment.id) || deletingCommentIds.has(comment.id)"
            @reply="handleReply"
            @delete="handleDelete"
            @like="handleLike"
            @dislike="handleDislike"
            @refresh="refreshComment"
            @loadReplies="loadReplies"
            @loadContext="loadContext"
          />
        </div>
      </div>
      <div v-if="hasMore" ref="sentinel" class="h-px" aria-hidden="true" />
      <UButton v-if="hasMore" color="neutral" variant="soft" :loading="loading" :disabled="loading" @click="loadMore">
        {{ $t('articles.comments.loadMoreComments') }}
      </UButton>
      <UProgress v-if="loading" />
    </div>
    <UEmpty v-else-if="!loading && !error" icon="mdi:comment-off-outline" :title="$t('articles.comments.noComments')" />
  </section>
</template>

<script lang="ts" setup>
import type { CommentWithReplies } from '~~/types/comment'

import { flattenCommentThreads } from '~~/shared/utils/commentThreads'

interface GiphyGif {
  id: string
  title: string
  images: { fixed_height: { url: string }; original: { url: string } }
}

const toast = useToast(),
  { data: session } = useAuth()
const confirm = useConfirm()
const localePath = useLocalePath()
const publication = await useClientSite()
const props = defineProps<{
  articleId: string
  commCount: number
  allowComments: boolean
  allowGifs: boolean
}>()

const newComment = shallowRef(''),
  selectedGifUrl = shallowRef<string | null>(null),
  isSubmitting = shallowRef(false),
  replyingTo = ref<CommentWithReplies | null>(null),
  commentForm = useTemplateRef<HTMLElement>('commentForm'),
  sentinel = useTemplateRef('sentinel')
const commentState = computed(() => ({ comment: newComment.value }))
const optimisticCommentIds = ref(new Set<string>())
const deletingCommentIds = ref(new Set<string>())
const optimisticStatus = useOptimisticStatus()
const { invalidateArticleDetail } = useCacheInvalidation()
let disposed = false
let articleVersion = 0
onScopeDispose(() => {
  disposed = true
  articleVersion++
})
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
const maxLength = 1000,
  characterCount = computed(() => newComment.value.length),
  commCount = shallowRef(props.commCount)
watch(
  () => props.articleId,
  () => {
    articleVersion++
    commCount.value = props.commCount
    newComment.value = ''
    selectedGifUrl.value = null
    replyingTo.value = null
    isSubmitting.value = false
    optimisticCommentIds.value.clear()
    deletingCommentIds.value.clear()
  },
  { flush: 'sync' },
)
const {
  ready,
  comments,
  index: commentIndex,
  error,
  refresh,
  loading,
  hasMore,
  loadMore,
  loadReplies,
  loadContext,
  refreshComment,
  pendingReplies,
  pendingContexts,
} = useCommentThreads(toRef(props, 'articleId'), sort)
const visibleThreads = computed(() => comments.value.map((root) => flattenCommentThreads([root])))
await ready
useCommentAnchor(toRef(props, 'articleId'), comments)
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
useInfiniteScroll(sentinel, loadMore, {
  distance: 100,
  interval: 300,
  canLoadMore: () => hasMore.value && !loading.value && !error.value,
})
const handleGifSelect = (g: GiphyGif) => (selectedGifUrl.value = g.images.original.url)

const insertReply = (parentId: string, comment: CommentWithReplies): boolean => {
  const parent = commentIndex.value.get(parentId)
  if (!parent) return false
  parent.replies.push(comment)
  return true
}

const removeComment = (id: string) => {
  const comment = commentIndex.value.get(id)
  const parent = comment?.parentId && commentIndex.value.get(comment.parentId)
  if (parent) {
    parent.replies = parent.replies.filter((child) => child.id !== id)
    triggerRef(comments)
  } else comments.value = comments.value.filter((comment) => comment.id !== id)
}

const replaceComment = (id: string, patch: Partial<CommentWithReplies>) => {
  const comment = commentIndex.value.get(id)
  if (comment) {
    Object.assign(comment, patch)
    triggerRef(comments)
  }
}

const refreshAfterMutation = async (articleId: string, current: boolean) => {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => invalidateArticleDetail(articleId)),
    ...(current ? [Promise.resolve().then(refresh)] : []),
  ])
  if (results.some((result) => result.status === 'rejected'))
    console.warn('[CommentSection] Could not refresh saved comment data.')
}

const submitComment = async () => {
  if (
    disposed ||
    !props.allowComments ||
    !newComment.value.trim() ||
    isSubmitting.value ||
    (replyingTo.value && replyingTo.value.deletedAt)
  )
    return
  const draft = {
    articleId: props.articleId,
    content: newComment.value,
    gifUrl: props.allowGifs ? selectedGifUrl.value : null,
    parent: replyingTo.value,
  }
  const version = articleVersion
  const current = () => !disposed && articleVersion === version
  const currentUser = session.value?.user
  const optimisticId = `optimistic-${crypto.randomUUID?.() ?? Date.now()}`
  const optimisticComment: CommentWithReplies = {
    id: optimisticId,
    content: draft.content,
    gifUrl: draft.gifUrl,
    createdAt: new Date(),
    userId: currentUser?.id ?? '',
    parentId: draft.parent?.id ?? null,
    deletedAt: null,
    articleId: draft.articleId,
    user: {
      username: currentUser?.name ?? '',
      avatarUrl: currentUser?.avatarUrl ?? undefined,
      isBanned: false,
    },
    article: { clientSiteId: currentUser?.clientSiteId ?? '' },
    likes: 0,
    dislikes: 0,
    replies: [],
    userReaction: null,
    emojiReactions: [],
    depth: draft.parent ? (draft.parent.depth ?? 0) + 1 : 0,
    publicationLikes: 0,
  }

  isSubmitting.value = true
  optimisticCommentIds.value = new Set([...optimisticCommentIds.value, optimisticId])
  if (!draft.parent || !insertReply(draft.parent.id, optimisticComment))
    comments.value = [optimisticComment, ...comments.value]
  else triggerRef(comments)
  commCount.value += 1
  newComment.value = ''
  selectedGifUrl.value = null
  replyingTo.value = null
  const sequence = optimisticStatus.saving()
  let committed = false

  try {
    const created = await $fetch<
      {
        id: string
        content: string
        gifUrl: string | null
        createdAt: string
        parentId: string | null
      },
      '/api/comments'
    >('/api/comments', {
      method: 'POST',
      body: {
        articleId: draft.articleId,
        content: draft.content,
        gifUrl: draft.gifUrl,
        parentId: draft.parent?.id,
      },
    })
    committed = true
    optimisticStatus.saved(sequence)
    if (!current()) {
      await refreshAfterMutation(draft.articleId, false)
      return
    }
    replaceComment(optimisticId, {
      id: created.id,
      content: created.content,
      gifUrl: created.gifUrl,
      createdAt: new Date(created.createdAt),
      parentId: created.parentId,
    })
    triggerRef(comments)
    toast.add({
      color: 'success',
      title: draft.parent ? $t('articles.comments.replySubmitted') : $t('articles.comments.commentAdded'),
    })
    await refreshAfterMutation(draft.articleId, true)
  } catch (e: unknown) {
    if (committed) {
      console.warn('[CommentSection] Could not refresh saved comment data.')
      return
    }
    optimisticStatus.reverted(sequence)
    if (!current()) return
    removeComment(optimisticId)
    commCount.value = Math.max(0, commCount.value - 1)
    if (!newComment.value && !replyingTo.value) {
      newComment.value = draft.content
      selectedGifUrl.value = draft.gifUrl
      replyingTo.value = draft.parent
    }
    toast.add({
      color: 'error',
      title: fetchErrorMessage(e, $t('common.messages.operationFailed')),
    })
  } finally {
    if (current()) {
      const nextOptimistic = new Set(optimisticCommentIds.value)
      nextOptimistic.delete(optimisticId)
      optimisticCommentIds.value = nextOptimistic
      isSubmitting.value = false
    }
  }
}

const handleReply = (c: CommentWithReplies) =>
  !props.allowComments ||
  c.deletedAt ||
  ((replyingTo.value = c), nextTick(() => commentForm.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })))

const handleDelete = async (c: CommentWithReplies, r: string | null) => {
  if (disposed || deletingCommentIds.value.has(c.id)) return
  const version = articleVersion
  const articleId = props.articleId
  const current = () => !disposed && version === articleVersion
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
  if (!current() || deletingCommentIds.value.has(c.id)) return

  const previousDeletedAt = c.deletedAt
  replaceComment(c.id, { deletedAt: new Date() })
  triggerRef(comments)
  deletingCommentIds.value = new Set([...deletingCommentIds.value, c.id])
  const sequence = optimisticStatus.saving()

  try {
    await $fetch<unknown, '/api/comments/:id'>(`/api/comments/${c.id}` as '/api/comments/:id', {
      method: 'DELETE',
      body: { reason: r },
    })
    optimisticStatus.saved(sequence)
    await refreshAfterMutation(articleId, false)
    if (!current()) return
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
    await nextTick()
    document.getElementById(`comment-${c.id}`)?.focus?.()
  } catch {
    optimisticStatus.reverted(sequence)
    if (!current()) return
    c.deletedAt = previousDeletedAt
    triggerRef(comments)
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') })
  } finally {
    if (current()) {
      const nextDeleting = new Set(deletingCommentIds.value)
      nextDeleting.delete(c.id)
      deletingCommentIds.value = nextDeleting
    }
  }
}
const handleLike = (c: CommentWithReplies) => !c.deletedAt
const handleDislike = (c: CommentWithReplies) => !c.deletedAt
</script>
