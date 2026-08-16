<template>
  <div class="mt-10 px-4 sm:px-6">
    <div class="flex gap-4 overflow-x-auto border-b border-default pb-2">
      <UButton
        v-for="tab in tabs"
        :key="tab.id"
        :color="activeTab === tab.id ? 'primary' : 'neutral'"
        :variant="activeTab === tab.id ? 'soft' : 'ghost'"
        :icon="tab.icon"
        class="shrink-0"
        @click="$emit('update:activeTab', tab.id)"
      >
        {{ $t(tab.label) }}
      </UButton>
    </div>
    <div class="mt-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <UFormField :label="$t('common.search')" :ui="{ label: 'sr-only' }" class="w-full sm:w-1/3">
          <UInput
            v-model="searchQuery"
            type="text"
            :placeholder="$t('common.search')"
            icon="i-mdi-magnify"
            class="w-full"
          />
        </UFormField>
        <div class="flex gap-2 overflow-x-auto">
          <UBadge
            v-for="tag in availableTags"
            :key="tag"
            as="button"
            type="button"
            :color="selectedTags.includes(tag) ? 'primary' : 'neutral'"
            :variant="selectedTags.includes(tag) ? 'solid' : 'soft'"
            :aria-pressed="selectedTags.includes(tag)"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </UBadge>
        </div>
        <div v-if="activeTab === 'likedArticles'" class="flex items-center gap-2">
          <UFormField :label="$t('common.search')" :ui="{ label: 'sr-only' }">
            <USelectMenu
              v-model="sortOption"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="sortItems"
            />
          </UFormField>
          <UButton
            color="neutral"
            variant="ghost"
            square
            :icon="isGrid ? 'i-mdi-view-list' : 'i-mdi-view-grid'"
            :aria-label="$t('common.actions.toggleLayout')"
            :title="$t('common.actions.toggleLayout')"
            @click="isGrid = !isGrid"
          />
        </div>
        <div v-else class="flex items-center gap-2">
          <UFormField :label="$t('common.search')" :ui="{ label: 'sr-only' }">
            <USelectMenu
              v-model="sortComment"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="sortItems.filter((item) => item.value !== 'views:desc')"
            />
          </UFormField>
        </div>
      </div>
      <div v-if="pending" class="space-y-4">
        <USkeleton v-for="i in 3" :key="i" class="h-32 w-full" />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        icon="i-mdi-alert-circle-outline"
        :description="error?.message || $t('common.error')"
      />
      <template v-else>
        <div v-if="activeTab === 'likedArticles'">
          <UEmpty v-if="!filteredArticles.length" :description="$t('common.noResults')">
            <template #actions>
              <UButton :to="localePath({ name: 'index' })" variant="soft">{{ $t('articles.explore') }}</UButton>
            </template>
          </UEmpty>
          <div :class="isGrid ? 'grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2' : 'grid gap-4'">
            <ArticleCard
              v-for="article in filteredArticles"
              :key="article.id"
              :article="toArticleCard(article)"
              :variant="isGrid ? 'standard' : 'compact'"
            >
              <template #actions>
                <UButton
                  :onClick="() => unlikeArticle(article.id)"
                  icon="i-mdi-heart-broken"
                  square
                  size="md"
                  color="error"
                  variant="ghost"
                  :aria-label="$t('common.actions.unlike')"
                  :title="$t('common.actions.unlike')"
                />
                <UButton
                  :onClick="() => shareArticle(article)"
                  icon="i-mdi-share-variant"
                  square
                  size="md"
                  color="neutral"
                  variant="ghost"
                  :aria-label="$t('common.actions.share')"
                  :title="$t('common.actions.share')"
                />
              </template>
            </ArticleCard>
          </div>
        </div>
        <div v-if="activeTab === 'comments'">
          <UEmpty v-if="!filteredComments.length" :description="$t('common.noResults')">
            <template #actions>
              <UButton :to="localePath({ name: 'index' })" variant="soft">
                {{ $t('articles.comments.commentsAction') }}
              </UButton>
            </template>
          </UEmpty>
          <div v-for="comment in filteredComments" :key="comment.id" class="space-y-5">
            <UCard v-if="!comment.deletedAt">
              <div class="flex items-center gap-2 mb-2">
                <UserPicture :name="comment.authorUsername" :url="comment.authorPfp" />
                <span class="text-sm font-medium leading-relaxed text-highlighted">{{ comment.authorUsername }}</span>
              </div>
              <p class="mb-2 text-sm leading-relaxed text-muted">{{ comment.content }}</p>
              <NuxtLink
                :to="
                  localePath({ name: 'clanky-slug', params: { slug: comment.articleSlug } }) + `#comment-${comment.id}`
                "
                class="flex items-center gap-1 text-xs text-primary"
              >
                <UIcon size="12" name="i-mdi-file-document-outline" />
                {{ $t('common.labels.article') }} {{ comment.articleTitle }}
              </NuxtLink>
              <p class="mt-1 text-xs leading-relaxed text-muted">
                {{ $t('common.created') }} {{ formatDate(comment.createdAt) }}
              </p>
              <div class="mt-2 flex items-center gap-4 text-xs text-muted">
                <div class="flex items-center gap-1">
                  <UIcon size="12" name="i-mdi-thumb-up-outline" />
                  <span>{{ comment.likesCount }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <UIcon size="12" name="i-mdi-thumb-down-outline" />
                  <span>{{ comment.dislikesCount }}</span>
                </div>
                <UButton
                  v-if="session?.user?.id === comment.userId"
                  :onClick="() => handleDelete(comment.id)"
                  icon="i-mdi-delete-outline"
                  square
                  size="sm"
                  color="error"
                  variant="ghost"
                  :aria-label="$t('common.actions.deleteComment')"
                  :title="$t('common.actions.deleteComment')"
                />
              </div>
              <div v-if="comment.tags.length" class="flex flex-wrap gap-1 mt-2">
                <UBadge v-for="tag in comment.tags" :key="tag" color="primary" variant="soft">
                  {{ tag }}
                </UBadge>
              </div>
              <div v-if="comment.replies?.length" class="mt-4 space-y-4">
                <UCard v-for="reply in sortReplies(comment.replies as Comment[])" :key="reply.id" class="ml-6 sm:ml-10">
                  <div class="flex items-center gap-2 mb-2">
                    <UserPicture :name="reply.authorUsername" :url="reply.authorPfp" />
                    <span class="text-sm font-medium leading-relaxed text-highlighted">{{ reply.authorUsername }}</span>
                  </div>
                  <p class="mb-2 text-sm leading-relaxed text-muted">{{ reply.content }}</p>
                  <NuxtLink
                    :to="
                      localePath({ name: 'clanky-slug', params: { slug: reply.articleSlug } }) + `#comment-${reply.id}`
                    "
                    class="flex items-center gap-1 text-xs text-primary"
                  >
                    <UIcon size="12" name="i-mdi-file-document-outline" />
                    {{ $t('common.labels.article') }} {{ reply.articleTitle }}
                  </NuxtLink>
                  <p class="mt-1 text-xs leading-relaxed text-muted">
                    {{ $t('common.created') }} {{ formatDate(reply.createdAt) }}
                  </p>
                  <div class="mt-2 flex items-center gap-4 text-xs text-muted">
                    <div class="flex items-center gap-1">
                      <UIcon size="12" name="i-mdi-thumb-up-outline" />
                      <span>{{ reply.likesCount }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <UIcon size="12" name="i-mdi-thumb-down-outline" />
                      <span>{{ reply.dislikesCount }}</span>
                    </div>
                    <UButton
                      v-if="session?.user?.id === reply.userId"
                      :onClick="() => handleDelete(reply.id)"
                      icon="i-mdi-delete-outline"
                      square
                      size="sm"
                      color="error"
                      variant="ghost"
                      :aria-label="$t('common.actions.deleteComment')"
                      :title="$t('common.actions.deleteComment')"
                    />
                  </div>
                  <div v-if="reply.tags.length" class="flex flex-wrap gap-1 mt-2">
                    <UBadge v-for="tag in reply.tags" :key="tag" color="primary" variant="soft">
                      {{ tag }}
                    </UBadge>
                  </div>
                </UCard>
              </div>
            </UCard>
          </div>
        </div>
        <div v-if="hasMore[activeTab] && !pending" class="mt-8 text-center">
          <UButton color="primary" variant="solid" :loading="pending" :disabled="pending" @click="loadMore">
            {{ $t('common.pagination.next') }}
          </UButton>
        </div>
        <div v-if="pending" class="py-4 text-center text-sm text-muted">
          {{ $t('common.loading') }}
        </div>
        <div
          v-if="!hasMore[activeTab] && (filteredArticles.length || filteredComments.length)"
          class="py-4 text-center text-sm text-muted"
        >
          {{ $t('common.noResults') }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'
import type { Article as _Article, Comment as _Comment } from '@prisma/client'

import { formatDate } from '~~/shared/utils'

type Article = Pick<_Article, 'id' | 'slug' | 'title' | 'content' | 'excerpt' | 'imageUrl' | 'views'> & {
  authorUsername: string
  authorPfp?: string | null
  tags: string[]
  likesCount: number
  createdAt: string | null
}

type Comment = Pick<_Comment, 'id' | 'content' | 'userId' | 'parentId'> & {
  articleSlug: string
  articleTitle: string
  authorUsername: string
  authorPfp?: string | null
  tags: string[]
  likesCount: number
  dislikesCount: number
  replies?: Comment[]
  createdAt: string
  deletedAt?: string | null
}

const toArticleCard = (article: Article): ArticleCardData => ({
  id: article.id,
  slug: article.slug,
  title: article.title,
  imageUrl: article.imageUrl,
  excerpt: article.excerpt,
  content: article.content,
  createdAt: article.createdAt || new Date(0).toISOString(),
  views: article.views,
  likes: article.likesCount,
  user: { username: article.authorUsername, avatarUrl: article.authorPfp },
  tags: article.tags.map((name) => ({ name })),
})

const props = defineProps<{ activeTab: 'likedArticles' | 'comments' }>()

defineEmits<{ (e: 'update:activeTab', value: 'likedArticles' | 'comments'): void }>()

const localePath = useLocalePath()
const toast = useToast()
const confirm = useConfirm()
const { data: session } = useAuth()

const tabs = [
  { id: 'likedArticles', label: 'articles.activity.tabs.likedArticles', icon: 'i-mdi-heart-outline' },
  { id: 'comments', label: 'articles.activity.tabs.comments', icon: 'i-mdi-comment-outline' },
] as const

const sortOption = shallowRef('createdAt:desc')
const sortComment = shallowRef('createdAt:desc')
const isGrid = shallowRef(true)
const searchQuery = shallowRef('')
const selectedTags = ref<string[]>([])
const page = shallowRef(1)
const limit = 2
const hasMore = shallowRef({ likedArticles: true, comments: true })
const allArticles = ref<Article[]>([])
const allComments = ref<Comment[]>([])

const sortItems = [
  { label: $t('common.sortOptions.newest'), value: 'createdAt:desc', icon: 'i-mdi-clock-outline' },
  { label: $t('common.sortOptions.oldest'), value: 'createdAt:asc', icon: 'i-mdi-clock-time-twelve-outline' },
  { label: $t('common.sortOptions.mostInteresting'), value: 'likes:desc', icon: 'i-mdi-heart' },
  { label: $t('common.sortOptions.mostViews'), value: 'views:desc', icon: 'i-mdi-eye-outline' },
]

const { data, pending, error, refresh } = await useFetch('/api/users/activity', {
  query: {
    page,
    limit,
    sort: computed(() => (props.activeTab === 'likedArticles' ? sortOption.value : sortComment.value)),
  },
  default: () => ({
    likedArticles: [] as Article[],
    comments: [] as Comment[],
    hasMore: { likedArticles: true, comments: true },
  }),
  watch: false,
})

watch(
  data,
  (v) => {
    if (!v) return
    const existingArticleIds = new Set(allArticles.value.map((a) => a.id))
    const existingCommentIds = new Set(allComments.value.map((c) => c.id))
    allArticles.value = [...allArticles.value, ...(v.likedArticles || []).filter((a) => !existingArticleIds.has(a.id))]
    allComments.value = [...allComments.value, ...(v.comments || []).filter((c) => !existingCommentIds.has(c.id))]
    hasMore.value = v.hasMore || { likedArticles: true, comments: true }
  },
  { immediate: true },
)

watch([sortOption, sortComment, () => props.activeTab, searchQuery, selectedTags], () => {
  page.value = 1
  allArticles.value = []
  allComments.value = []
  hasMore.value = { likedArticles: true, comments: true }
  refresh()
})

const availableTags = computed(() => {
  const tags = new Set<string>()
  allArticles.value.forEach((a) => a.tags.forEach((t) => tags.add(t)))
  allComments.value.forEach((c) => {
    c.tags.forEach((t) => tags.add(t))
    c.replies?.forEach((r) => r.tags.forEach((t) => tags.add(t)))
  })
  return [...tags]
})

const toggleTag = (tag: string) => {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((t) => t !== tag)
  } else {
    selectedTags.value.push(tag)
  }
}

const filteredArticles = computed(() => {
  const [field, order] = sortOption.value.split(':')
  return [...allArticles.value]
    .filter((article) => {
      const matchesSearch = article.title.toLowerCase().includes(searchQuery.value.toLowerCase())
      const matchesTags = selectedTags.value.length
        ? selectedTags.value.every((tag) => article.tags.includes(tag))
        : true
      return matchesSearch && matchesTags
    })
    .sort((a, b) => {
      let av: number, bv: number
      if (field === 'createdAt') {
        av = new Date(a.createdAt || 0).getTime()
        bv = new Date(b.createdAt || 0).getTime()
      } else if (field === 'likes') {
        av = a.likesCount || 0
        bv = b.likesCount || 0
      } else {
        av = a.views || 0
        bv = b.views || 0
      }
      return order === 'asc' ? av - bv : bv - av
    })
})

const sortReplies = (replies: Comment[]) => {
  const [field, order] = sortComment.value.split(':')
  return [...(replies || [])]
    .filter((reply) => {
      const matchesSearch = reply.content.toLowerCase().includes(searchQuery.value.toLowerCase())
      const matchesTags = selectedTags.value.length ? selectedTags.value.every((tag) => reply.tags.includes(tag)) : true
      return matchesSearch && matchesTags
    })
    .sort((a, b) => {
      const av = field === 'createdAt' ? new Date(a.createdAt).getTime() : a.likesCount || 0
      const bv = field === 'createdAt' ? new Date(b.createdAt).getTime() : b.likesCount || 0
      return order === 'asc' ? av - bv : bv - av
    })
}

const filteredComments = computed(() => {
  const [field, order] = sortComment.value.split(':')
  return [...allComments.value]
    .filter((comment) => {
      const matchesSearch = comment.content.toLowerCase().includes(searchQuery.value.toLowerCase())
      const matchesTags = selectedTags.value.length
        ? selectedTags.value.every((tag) => comment.tags.includes(tag))
        : true
      return matchesSearch && matchesTags && !comment.parentId
    })
    .sort((a, b) => {
      const av = field === 'createdAt' ? new Date(a.createdAt).getTime() : a.likesCount || 0
      const bv = field === 'createdAt' ? new Date(b.createdAt).getTime() : b.likesCount || 0
      return order === 'asc' ? av - bv : bv - av
    })
})

const unlikeArticle = async (articleId: string) => {
  try {
    await $fetch(`/api/articles/${articleId}/reaction`, { method: 'POST' })
    allArticles.value = allArticles.value.filter((a) => a.id !== articleId)
    await refresh()
    toast.add({ color: 'success', title: $t('common.messages.successGeneral') })
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || e.message || $t('common.messages.operationFailed') })
  }
}

const shareArticle = (article: Article) => {
  const url = `${window.location.origin}${localePath({ name: 'clanky-slug', params: { slug: article.slug } })}`
  navigator.clipboard.writeText(url)
  toast.add({ color: 'success', title: $t('common.actions.copySuccess') })
}

const handleDelete = async (commentId: string) => {
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
  try {
    await $fetch(`/api/comments/${commentId}`, { method: 'DELETE', body: { reason: '' } })
    const updateComments = (comments: Comment[]): Comment[] => {
      return comments
        .map((c) => {
          if (c.id === commentId) {
            return { ...c, deletedAt: new Date().toISOString() }
          }
          if (c.replies?.length) {
            return { ...c, replies: updateComments(c.replies) }
          }
          return c
        })
        .filter((c) => !c.deletedAt)
    }
    allComments.value = updateComments(allComments.value)
    await refresh()
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || e.message || $t('common.messages.operationFailed') })
  }
}

const loadMore = async () => {
  if (!hasMore.value[props.activeTab] || pending.value) return
  page.value++
  await refresh()
}
</script>
