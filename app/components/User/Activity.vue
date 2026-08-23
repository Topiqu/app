<template>
  <div class="space-y-5">
    <div class="flex w-fit gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800/60" role="tablist">
      <UButton
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors"
        :class="
          activeTab === tab.id
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
        "
        @click="$emit('update:activeTab', tab.id)"
      >
        <Icon :name="tab.icon" class="size-4 shrink-0" />
        {{ $t(tab.label) }}
      </UButton>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <UFormField :label="$t('common.search')" class="sm:max-w-xs">
        <UInput v-model="searchQuery" name="activitySearch" icon="i-mdi-magnify" :placeholder="$t('common.search')" />
      </UFormField>
      <div class="flex items-center gap-2 sm:ml-auto">
        <UFormField :label="$t('common.labels.sortBy')">
          <USelect v-model="sortOption" :items="sortItems" valueKey="value" labelKey="label" />
        </UFormField>
        <UButton
          v-if="activeTab === 'likedArticles'"
          square
          borderless
          variant="ghost"
          :icon="isGrid ? 'mdi:view-list' : 'mdi:view-grid'"
          :aria="$t('common.actions.toggleLayout')"
          :title="$t('common.actions.toggleLayout')"
          @click="isGrid = !isGrid"
        />
      </div>
    </div>

    <div v-if="availableTags.length" class="flex flex-wrap gap-1.5">
      <UButton
        v-for="tag in availableTags"
        :key="tag"
        type="button"
        class="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="
          selectedTags.includes(tag)
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
        "
        :aria-pressed="selectedTags.includes(tag)"
        @click="toggleTag(tag)"
      >
        {{ tag }}
      </UButton>
    </div>

    <div v-if="pending && !items.length" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/60 dark:bg-red-900/20"
    >
      <p class="text-sm font-medium text-red-600 dark:text-red-400">{{ error?.message || $t('common.error') }}</p>
    </div>

    <template v-else>
      <div v-if="!items.length" class="py-12 text-center">
        <NuxtImg src="/topik_empty_rm.png" alt="" class="mx-auto size-16" format="webp" quality="80" loading="lazy" />
        <p class="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{{ $t('common.noResults') }}</p>
        <NuxtLink
          :to="localePath({ name: 'index' })"
          class="mt-1 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
        >
          {{ activeTab === 'likedArticles' ? $t('articles.explore') : $t('articles.comments.commentsAction') }}
        </NuxtLink>
      </div>

      <div
        v-else-if="activeTab === 'likedArticles'"
        :class="isGrid ? 'grid gap-4 grid-cols-1 sm:grid-cols-2' : 'space-y-3'"
      >
        <UserActivityArticle
          v-for="article in filteredArticles"
          :key="article.id"
          :article="article"
          :grid="isGrid"
          @unlike="unlikeArticle"
          @share="shareArticle"
        />
      </div>

      <div v-else class="space-y-3">
        <UserActivityComment
          v-for="comment in filteredComments"
          :key="comment.id"
          :comment="comment"
          @delete="confirmDelete"
        >
          <template #replies>
            <UserActivityComment
              v-for="reply in sortReplies(comment.replies ?? [])"
              :key="reply.id"
              :comment="reply"
              nested
              @delete="confirmDelete"
            />
          </template>
        </UserActivityComment>
      </div>

      <div class="text-center">
        <UButton
          v-if="hasMore[activeTab]"
          :loading="pending"
          :disabled="pending"
          color="neutral"
          variant="soft"
          @click="loadMore"
        >
          {{ $t('common.pagination.next') }}
        </UButton>
        <p v-else-if="items.length" class="text-sm text-neutral-400 dark:text-neutral-500">
          {{ $t('common.pagination.end') }}
        </p>
      </div>
    </template>

    <AppConfirmDialog ref="deleteDialog" />
  </div>
</template>

<script setup lang="ts">
import { compareBySort, matchesFilters } from '~/utils/activityFilters'

import type { ActivityArticle } from './ActivityArticle.vue'
import type { ActivityComment } from './ActivityComment.vue'

const { activeTab } = defineProps<{ activeTab: 'likedArticles' | 'comments' }>()

defineEmits<{ (e: 'update:activeTab', value: 'likedArticles' | 'comments'): void }>()

const localePath = useLocalePath()
const toast = useAppToast()
const { copy } = useClipboard({ legacy: true })
const deleteDialog = useTemplateRef<{ ask: (options?: Record<string, unknown>) => Promise<'ok' | 'no'> }>(
  'deleteDialog',
)

const tabs = [
  { id: 'likedArticles', label: 'articles.activity.tabs.likedArticles', icon: 'mdi:heart-outline' },
  { id: 'comments', label: 'articles.activity.tabs.comments', icon: 'mdi:comment-outline' },
] as const

const sortOption = shallowRef('createdAt:desc')
const isGrid = shallowRef(true)
const searchQuery = shallowRef('')
const selectedTags = ref<string[]>([])
const page = shallowRef(1)
const limit = 10
const hasMore = shallowRef({ likedArticles: true, comments: true })
const allArticles = ref<ActivityArticle[]>([])
const allComments = ref<ActivityComment[]>([])

const allSortItems = [
  { label: $t('common.sortOptions.newest'), value: 'createdAt:desc', icon: 'mdi:clock-outline' },
  { label: $t('common.sortOptions.oldest'), value: 'createdAt:asc', icon: 'mdi:clock-time-twelve-outline' },
  { label: $t('common.sortOptions.mostInteresting'), value: 'likes:desc', icon: 'mdi:heart' },
  { label: $t('common.sortOptions.mostViews'), value: 'views:desc', icon: 'mdi:eye-outline' },
]
// Comments have no view count to sort by.
const sortItems = computed(() =>
  activeTab === 'likedArticles' ? allSortItems : allSortItems.filter((i) => i.value !== 'views:desc'),
)

const { data, pending, error, refresh } = await useFetch('/api/users/activity', {
  query: { page, limit, sort: sortOption },
  default: () => ({
    likedArticles: [] as ActivityArticle[],
    comments: [] as ActivityComment[],
    hasMore: { likedArticles: true, comments: true },
  }),
  watch: false,
})

watch(
  data,
  (v) => {
    if (!v) return
    const knownArticles = new Set(allArticles.value.map((a) => a.id))
    const knownComments = new Set(allComments.value.map((c) => c.id))
    allArticles.value = [...allArticles.value, ...(v.likedArticles || []).filter((a) => !knownArticles.has(a.id))]
    allComments.value = [...allComments.value, ...(v.comments || []).filter((c) => !knownComments.has(c.id))]
    hasMore.value = v.hasMore || { likedArticles: true, comments: true }
  },
  { immediate: true },
)

// `activeTab` is a prop — it needs a getter here, otherwise the tab switch never refetches.
watch([sortOption, () => activeTab], () => {
  page.value = 1
  allArticles.value = []
  allComments.value = []
  hasMore.value = { likedArticles: true, comments: true }
  // A sort the current tab does not offer would be sent to the API verbatim.
  if (activeTab === 'comments' && sortOption.value === 'views:desc') sortOption.value = 'createdAt:desc'
  refresh()
})

const availableTags = computed(() => {
  const tags = new Set<string>()
  if (activeTab === 'likedArticles') {
    allArticles.value.forEach((a) => a.tags.forEach((t) => tags.add(t)))
  } else {
    allComments.value.forEach((c) => {
      c.tags.forEach((t) => tags.add(t))
      c.replies?.forEach((r) => r.tags.forEach((t) => tags.add(t)))
    })
  }
  return [...tags]
})

function toggleTag(tag: string) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((t) => t !== tag)
    : [...selectedTags.value, tag]
}

const keep = (text: string, tags: string[]) => matchesFilters(text, tags, searchQuery.value, selectedTags.value)

const filteredArticles = computed(() =>
  allArticles.value.filter((a) => keep(a.title, a.tags)).sort(compareBySort(sortOption.value)),
)

const filteredComments = computed(() =>
  allComments.value.filter((c) => !c.parentId && keep(c.content, c.tags)).sort(compareBySort(sortOption.value)),
)

function sortReplies(replies: ActivityComment[]) {
  return replies.filter((r) => keep(r.content, r.tags)).sort(compareBySort(sortOption.value))
}

const items = computed(() => (activeTab === 'likedArticles' ? filteredArticles.value : filteredComments.value))

async function unlikeArticle(articleId: string) {
  try {
    await $fetch(`/api/articles/${articleId}/reaction`, { method: 'POST' })
    allArticles.value = allArticles.value.filter((a) => a.id !== articleId)
    await refresh()
    toast.success({ message: $t('common.messages.successGeneral') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || e.message || $t('common.messages.operationFailed') })
  }
}

async function shareArticle(article: ActivityArticle) {
  const url = `${window.location.origin}${localePath({ name: 'clanky-slug', params: { slug: article.slug } })}`
  await copy(url)
  toast.success({ message: $t('common.actions.copySuccess') })
}

async function confirmDelete(commentId: string) {
  const answer = await deleteDialog.value?.ask({
    title: $t('common.messages.deleteConfirmTitle'),
    message: $t('common.messages.deleteConfirmText'),
    icon: 'mdi:delete-outline',
    confirmText: $t('common.actions.delete'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (answer !== 'ok') return

  try {
    await $fetch(`/api/comments/${commentId}`, { method: 'DELETE', body: { reason: '' } })
    const prune = (comments: ActivityComment[]): ActivityComment[] =>
      comments
        .filter((c) => c.id !== commentId)
        .map((c) => (c.replies?.length ? { ...c, replies: prune(c.replies) } : c))
    allComments.value = prune(allComments.value)
    await refresh()
    toast.success({ message: $t('common.messages.deleteSuccess') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || e.message || $t('common.messages.operationFailed') })
  }
}

async function loadMore() {
  if (!hasMore.value[activeTab] || pending.value) return
  page.value++
  await refresh()
}
</script>
