<template>
  <div class="mt-10 px-4 sm:px-6">
    <div class="flex overflow-x-auto border-b border-gray-200 dark:border-neutral-700 gap-4 pb-2">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="relative px-6 py-3 text-sm font-medium transition-all duration-200 flex items-center gap-2 shrink-0 rounded-md"
        :class="
          activeTab === tab.id
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
        "
        @click="$emit('update:activeTab', tab.id)"
      >
        <Icon
          :name="tab.icon"
          class="w-4 h-4"
          :class="activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'"
        />
        {{ $t(tab.label) }}
        <span
          v-if="activeTab === tab.id"
          class="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600 dark:bg-indigo-400 rounded-t motion-safe:transition-[width,left] duration-300 ease-in-out"
        ></span>
      </button>
    </div>
    <div class="mt-6 space-y-6">
      <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="$t('common.search')"
          class="px-4 py-2.5 text-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg w-full sm:w-1/3 transition-colors duration-150 ease-in-out"
        />
        <div class="flex gap-2 overflow-x-auto">
          <button
            v-for="tag in availableTags"
            :key="tag"
            class="px-3 py-1 text-xs rounded-full shrink-0 transition-colors duration-150 ease-in-out"
            :class="
              selectedTags.includes(tag)
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-800'
            "
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
        <div v-if="activeTab === 'likedArticles'" class="flex items-center gap-2">
          <select
            v-model="sortOption"
            class="px-4 py-2.5 text-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg transition-colors duration-150 ease-in-out"
          >
            <option value="createdAt:desc">{{ $t('common.sortOptions.newest') }}</option>
            <option value="createdAt:asc">{{ $t('common.sortOptions.oldest') }}</option>
            <option value="likes:desc">{{ $t('common.sortOptions.mostInteresting') }}</option>
            <option value="views:desc">{{ $t('common.sortOptions.mostViews') }}</option>
          </select>
          <button
            class="p-2 rounded-lg bg-gray-100 dark:bg-neutral-800 transition-colors duration-150 ease-in-out"
            @click="isGrid = !isGrid"
          >
            <Icon :name="isGrid ? 'mdi:view-list' : 'mdi:view-grid'" class="w-5 h-5" />
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <select
            v-model="sortComment"
            class="px-4 py-2.5 text-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg transition-colors duration-150 ease-in-out"
          >
            <option value="createdAt:desc">{{ $t('common.sortOptions.newest') }}</option>
            <option value="createdAt:asc">{{ $t('common.sortOptions.oldest') }}</option>
            <option value="likes:desc">{{ $t('common.sortOptions.mostInteresting') }}</option>
          </select>
        </div>
      </div>
      <div v-if="pending" class="space-y-4">
        <div v-for="i in 3" :key="i" class="h-32 bg-gray-200 dark:bg-neutral-800 rounded-2xl animate-pulse"></div>
      </div>
      <div
        v-else-if="error"
        class="text-center p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl"
      >
        <p class="text-red-600 dark:text-red-400 font-medium">
          {{ error?.message || $t('common.error') }}
        </p>
      </div>
      <template v-else>
        <div v-if="activeTab === 'likedArticles'">
          <div v-if="!filteredArticles.length" class="text-center py-12">
            <NuxtImg
              src="/topik_empty_rm.png"
              alt="Empty state"
              class="w-16 h-16 mx-auto"
              format="webp"
              quality="80"
              loading="lazy"
            />
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">{{ $t('common.noResults') }}</p>
            <NuxtLink :to="localePath('/')" class="text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              {{ $t('articles.explore') }}
            </NuxtLink>
          </div>
          <div
            :class="isGrid ? 'grid gap-6 grid-cols-1 sm:grid-cols-2' : 'space-y-4'"
            class="transition-[margin,transform,opacity] duration-200 ease-in-out"
          >
            <div
              v-for="article in filteredArticles"
              :key="article.id"
              class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-150 ease-in-out"
              :class="isGrid ? 'flex flex-col gap-4' : 'flex items-start gap-5'"
            >
              <NuxtImg
                v-if="article.imageUrl"
                :src="article.imageUrl"
                :alt="$t('articles.articleCard.imageAlt', [article.title])"
                format="webp"
                quality="95"
                :class="
                  isGrid
                    ? 'w-full aspect-video rounded-xl object-cover transition-transform duration-150 ease-in-out hover:scale-[1.01]'
                    : 'w-20 h-20 rounded-xl object-cover flex-shrink-0 transition-transform duration-150 ease-in-out hover:scale-[1.01]'
                "
                loading="lazy"
              />
              <NuxtImg
                v-else
                src="/topik_empty_rm.png"
                alt="No image"
                format="webp"
                quality="95"
                :class="
                  isGrid
                    ? 'w-full aspect-video rounded-xl object-cover transition-transform duration-150 ease-in-out hover:scale-[1.01]'
                    : 'w-20 h-20 rounded-xl object-cover flex-shrink-0 transition-transform duration-150 ease-in-out hover:scale-[1.01]'
                "
                loading="lazy"
              />
              <div class="flex flex-col flex-1 gap-2 leading-relaxed">
                <NuxtLink
                  :to="localePath({ name: 'clanky-slug', params: { slug: article.slug } })"
                  class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold text-base sm:text-lg"
                >
                  {{ article.title }}
                </NuxtLink>
                <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <UserPicture :url="article.authorPfp" :name="article.authorUsername" :size="'sm'" />
                  <span class="text-sm">{{ article.authorUsername }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ $t('articles.status.published') }} {{ formatDate(article.createdAt || new Date().toISOString()) }}
                </p>
                <p
                  v-if="article.excerpt || article.content"
                  class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1"
                >
                  {{ (article.excerpt || article.content).replace(/<[^>]+>/g, '').substring(0, 120) }}…
                </p>
                <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1">
                      <Icon name="mdi:thumb-up-outline" class="w-3 h-3" />
                      <span>{{ article.likesCount }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <Icon name="mdi:eye-outline" class="w-3 h-3" />
                      <span>{{ article.views }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Button
                      :onClick="() => unlikeArticle(article.id)"
                      icon="mdi:heart-broken"
                      class="!border-none !text-red-500 hover:!text-red-600 transition-colors w-5 h-5"
                      square
                      size="md"
                      variant="neutral"
                      borderless
                    />
                    <Button
                      :onClick="() => shareArticle(article)"
                      icon="mdi:share-variant"
                      class="!border-none !text-indigo-500 hover:!text-indigo-600 transition-colors w-5 h-5"
                      square
                      size="md"
                      variant="neutral"
                      borderless
                    />
                  </div>
                </div>
                <div v-if="article.tags.length" class="flex flex-wrap gap-1.5 mt-3">
                  <span
                    v-for="tag in article.tags"
                    :key="tag"
                    class="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="activeTab === 'comments'">
          <div v-if="!filteredComments.length" class="text-center py-12">
            <NuxtImg
              src="/topik_empty_rm.png"
              alt="Empty state"
              class="w-16 h-16 mx-auto"
              format="webp"
              quality="80"
              loading="lazy"
            />
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">{{ $t('common.noResults') }}</p>
            <NuxtLink :to="localePath('/')" class="text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              {{ $t('articles.comments.commentsAction') }}
            </NuxtLink>
          </div>
          <div v-for="comment in filteredComments" :key="comment.id" class="space-y-5">
            <div
              v-if="!comment.deletedAt"
              class="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 ease-in-out"
            >
              <div class="flex items-center gap-2 mb-2">
                <UserPicture :name="comment.authorUsername" :url="comment.authorPfp" />
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">{{
                  comment.authorUsername
                }}</span>
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">{{ comment.content }}</p>
              <NuxtLink
                :to="
                  localePath({ name: 'clanky-slug', params: { slug: comment.articleSlug } }) + `#comment-${comment.id}`
                "
                class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs flex items-center gap-1"
              >
                <Icon name="mdi:file-document-outline" class="w-3 h-3" />
                {{ $t('common.labels.article') }} {{ comment.articleTitle }}
              </NuxtLink>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {{ $t('common.created') }} {{ formatDate(comment.createdAt) }}
              </p>
              <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2 items-center">
                <div class="flex items-center gap-1">
                  <Icon name="mdi:thumb-up-outline" class="w-3 h-3" />
                  <span>{{ comment.likesCount }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="mdi:thumb-down-outline" class="w-3 h-3" />
                  <span>{{ comment.dislikesCount }}</span>
                </div>
                <Button
                  v-if="session?.user?.id === comment.userId"
                  :onClick="() => handleDelete(comment.id)"
                  icon="mdi:delete-outline"
                  square
                  size="sm"
                  variant="danger"
                  borderless
                  class="w-5 h-5"
                />
              </div>
              <div v-if="comment.tags.length" class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="tag in comment.tags"
                  :key="tag"
                  class="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                >
                  {{ tag }}
                </span>
              </div>
              <div v-if="comment.replies?.length" class="mt-4 space-y-4">
                <div
                  v-for="reply in sortReplies(comment.replies as Comment[])"
                  :key="reply.id"
                  class="p-4 rounded-lg bg-gray-50 dark:bg-neutral-800 border-l-2 border-indigo-100 dark:border-indigo-900 ml-6 sm:ml-10 transition-all duration-150 ease-in-out"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <UserPicture :name="reply.authorUsername" :url="reply.authorPfp" />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">{{
                      reply.authorUsername
                    }}</span>
                  </div>
                  <p class="text-sm text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">{{ reply.content }}</p>
                  <NuxtLink
                    :to="
                      localePath({ name: 'clanky-slug', params: { slug: reply.articleSlug } }) + `#comment-${reply.id}`
                    "
                    class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs flex items-center gap-1"
                  >
                    <Icon name="mdi:file-document-outline" class="w-3 h-3" />
                    {{ $t('common.labels.article') }} {{ reply.articleTitle }}
                  </NuxtLink>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {{ $t('common.created') }} {{ formatDate(reply.createdAt) }}
                  </p>
                  <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2 items-center">
                    <div class="flex items-center gap-1">
                      <Icon name="mdi:thumb-up-outline" class="w-3 h-3" />
                      <span>{{ reply.likesCount }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <Icon name="mdi:thumb-down-outline" class="w-3 h-3" />
                      <span>{{ reply.dislikesCount }}</span>
                    </div>
                    <Button
                      v-if="session?.user?.id === reply.userId"
                      :onClick="() => handleDelete(reply.id)"
                      icon="mdi:delete-outline"
                      square
                      size="sm"
                      variant="danger"
                      borderless
                      class="w-5 h-5"
                    />
                  </div>
                  <div v-if="reply.tags.length" class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-for="tag in reply.tags"
                      :key="tag"
                      class="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hasMore[activeTab] && !loading" class="mt-8 text-center">
          <button
            :disabled="pending"
            class="bg-indigo-600 text-white px-6 py-2 rounded-full font-semibold text-lg hover:bg-indigo-700 dark:bg-indigo-800 dark:hover:bg-indigo-700 transition duration-300 disabled:opacity-50"
            @click="loadMore"
          >
            <span v-if="pending" class="animate-spin inline-block mr-2">↻</span>
            {{ $t('common.pagination.next') }}
          </button>
        </div>
        <div v-if="loading" class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm">
          {{ $t('common.loading') }}
        </div>
        <div
          v-if="!hasMore[activeTab] && (filteredArticles.length || filteredComments.length)"
          class="text-center text-neutral-500 dark:text-neutral-300 py-4 text-sm"
        >
          {{ $t('common.noResults') }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  replies: Comment[]
  createdAt: string
  deletedAt?: string
}

const props = defineProps<{ activeTab: 'likedArticles' | 'comments' }>()

defineEmits<{ (e: 'update:activeTab', value: 'likedArticles' | 'comments'): void }>()

const localePath = useLocalePath()
const toast = useToast()
const { data: session } = useAuth()

const tabs = [
  { id: 'likedArticles', label: 'articles.activity.tabs.likedArticles', icon: 'mdi:heart-outline' },
  { id: 'comments', label: 'articles.activity.tabs.comments', icon: 'mdi:comment-outline' },
] as const

const sortOption = shallowRef('createdAt:desc')
const sortComment = shallowRef('createdAt:desc')
const isGrid = shallowRef(true)
const searchQuery = shallowRef('')
const selectedTags = ref<string[]>([])
const page = shallowRef(1)
const limit = 5
const loading = shallowRef(false)
const hasMore = shallowRef({ likedArticles: true, comments: true })

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
})

watch(
  data,
  (v) => {
    if (!v) return
    if (page.value === 1) {
      data.value.likedArticles = v.likedArticles || []
      data.value.comments = v.comments || []
    } else {
      data.value.likedArticles = [...(data.value.likedArticles || []), ...(v.likedArticles || [])]
      data.value.comments = [...(data.value.comments || []), ...(v.comments || [])] as Comment[]
    }
    hasMore.value = v.hasMore || { likedArticles: true, comments: true }
  },
  { immediate: true },
)

watch([sortOption, sortComment, props.activeTab, searchQuery, selectedTags], () => {
  page.value = 1
  hasMore.value = { likedArticles: true, comments: true }
  refresh()
})

const availableTags = computed(() => {
  const tags = new Set<string>()
  data.value?.likedArticles?.forEach((a) => a.tags.forEach((t) => tags.add(t)))
  data.value?.comments?.forEach((c) => {
    c.tags.forEach((t) => tags.add(t))
    c.replies.forEach((r) => r.tags.forEach((t) => tags.add(t)))
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
  return [...(data.value?.likedArticles || [])]
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
  return [...(data.value?.comments || [])]
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
    data.value.likedArticles = (data.value.likedArticles || []).filter((a) => a.id !== articleId)
    await refresh()
    toast.success({ message: $t('common.messages.successGeneral') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
  }
}

const shareArticle = (article: Article) => {
  const url = `${window.location.origin}${localePath({ name: 'clanky-slug', params: { slug: article.slug } })}`
  navigator.clipboard.writeText(url)
  toast.success({ message: $t('common.actions.copySuccess') })
}

const handleDelete = async (commentId: string) => {
  if (!confirm($t('common.messages.deleteConfirmTitle'))) return
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
    data.value.comments = updateComments((data.value.comments || []) as Comment[])
    await refresh()
    toast.success({ message: $t('common.messages.deleteSuccess') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
  }
}

const loadMore = async () => {
  if (!hasMore.value[props.activeTab]) return
  loading.value = true
  page.value++
  await refresh().finally(() => (loading.value = false))
}
</script>
