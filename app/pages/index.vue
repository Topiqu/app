<template>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-12">
    <section class="text-center py-6 sm:py-10 space-y-4">
      <NuxtImg
        v-if="clientSite?.logoUrl"
        :src="clientSite.logoUrl"
        class="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full object-contain border border-gray-200 dark:border-gray-700"
        :alt="$t('common.avatar.alt.company')"
      />
      <div class="space-y-3">
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-gray-900 dark:text-gray-100 text-balance">
          {{ clientSite?.name ?? $t('common.labels.title') }}
        </h1>
        <div class="w-12 h-0.5 bg-blue-500 mx-auto rounded-full" />
      </div>
      <p
        v-if="clientSite?.description"
        class="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed text-balance"
      >
        {{ clientSite.description }}
      </p>
      <div
        v-if="allArticles.length && latestArticleSlug"
        class="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2"
      >
        <span>{{ $t('stats.articleCount', { count: allArticles.length }) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ $t('articles.latestArticle') }}</span>
        <NuxtLink
          :to="localePath({ name: 'clanky-slug', params: { slug: latestArticleSlug } })"
          class="font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition truncate max-w-[200px]"
        >
          {{ latestArticleTitle }}
        </NuxtLink>
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ArticleSkeletonCard
        :pending="featPending"
        isFeatured
        :article="featured || undefined"
        :tags="featured?.tags"
        :index="0"
      />
      <div class="space-y-6">
        <template v-if="featPending">
          <ArticleSkeletonCard v-for="i in 3" :key="`skel-rec-${i}`" :pending="true" :index="i - 1" />
        </template>
        <template v-else>
          <ArticleSkeletonCard
            v-for="(rec, idx) in recommended"
            :key="rec.id"
            :pending="false"
            :article="rec"
            :tags="rec.tags"
            :index="idx"
          />
        </template>
      </div>
    </section>

    <section id="articles" class="space-y-6">
      <div class="flex items-baseline justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-3">
        <h2 class="text-3xl font-bold tracking-tight">{{ $t('articles.title') }}</h2>
      </div>

      <div
        class="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 space-y-3"
      >
        <div class="relative w-full group">
          <label for="article-search" class="sr-only">{{ $t('articles.searchPlaceholder') }}</label>
          <span
            class="absolute inset-y-0 left-3 flex items-center text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none"
          >
            <Icon name="material-symbols:search-rounded" class="w-5 h-5" />
          </span>
          <input
            id="article-search"
            v-model="searchQuery"
            type="search"
            :placeholder="$t('articles.searchPlaceholder')"
            :aria-label="$t('articles.searchPlaceholder')"
            class="w-full pl-11 pr-4 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-150"
          />
        </div>
        <div class="flex flex-nowrap overflow-x-auto gap-2 -mx-1 px-1 pb-1">
          <Button
            size="sm"
            :variant="selectedTag === '' ? 'primary' : 'neutral'"
            class="flex-shrink-0"
            @click="selectedTag = ''"
          >
            {{ $t('articles.title') }}
          </Button>
          <Button
            v-for="tag in tags"
            :key="tag.id"
            size="sm"
            :variant="selectedTag === tag.name ? 'primary' : 'neutral'"
            class="flex-shrink-0"
            @click="selectedTag = selectedTag === tag.name ? '' : tag.name"
          >
            {{ tag.name }}
          </Button>
        </div>
      </div>

      <div v-if="pending && !filteredArticles.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <ArticleSkeletonCard v-for="i in 6" :key="`skel-feed-${i}`" :pending="true" :index="i - 1" />
      </div>
      <div v-else-if="filteredArticles.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <ArticleSkeletonCard
          v-for="(article, idx) in filteredArticles"
          :key="article.id"
          :pending="pending"
          :article="article"
          :tags="article.tags"
          :index="idx"
        />
      </div>
      <p v-else class="text-center text-lg text-gray-500 dark:text-gray-400 py-12">
        {{ $t('articles.noResults.message') }}
      </p>

      <div v-if="hasMore" class="text-center pt-4">
        <Button :disabled="pending" :loading="pending" @click="loadMore">
          {{ $t('common.pagination.next') }}
        </Button>
      </div>
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div v-if="latestPoll" class="space-y-4">
        <h2 class="text-2xl font-bold tracking-tight border-l-4 border-blue-500 pl-3">
          {{ $t('articles.poll.hpTitle') }}
        </h2>
        <ArticlePoll :poll="latestPoll" :articleId="latestPoll.articleId" />
      </div>
      <aside class="space-y-4" :class="{ 'lg:col-span-2': !latestPoll }">
        <h3 class="text-2xl font-bold tracking-tight border-l-4 border-blue-500 pl-3">
          {{ $t('stats.topArticle.pluralTitle') }}
        </h3>
        <template v-if="topArticles.length">
          <NuxtLink
            v-for="(top, idx) in topArticles"
            :key="top.id"
            :to="localePath({ name: 'clanky-slug', params: { slug: top?.slug } })"
            class="flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition no-underline group"
          >
            <span
              class="flex-shrink-0 w-8 text-2xl font-black text-blue-500 dark:text-blue-400 text-center tabular-nums"
            >
              {{ idx + 1 }}
            </span>
            <NuxtImg
              v-if="top.imageUrl"
              :src="top.imageUrl"
              class="w-16 h-16 object-cover rounded-lg"
              :alt="$t('articles.articleCard.imageAlt')"
            />
            <div
              v-else
              class="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg"
            >
              <Icon name="mdi:image-off" class="w-8 h-8 text-gray-400" />
            </div>
            <div class="min-w-0">
              <h4
                class="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-2"
              >
                {{ top.title }}
              </h4>
              <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ formatDate(top.createdAt ?? undefined) }}
              </div>
            </div>
          </NuxtLink>
        </template>
        <p v-else class="text-gray-500 dark:text-gray-400">{{ $t('articles.noResults.message') }}</p>
      </aside>
    </section>

    <section v-if="!auth" class="border-t border-gray-200 dark:border-gray-800 pt-12 pb-4 text-center space-y-4">
      <h3 class="text-3xl font-bold tracking-tight">{{ $t('common.auth.loginPrompt') }}</h3>
      <p class="max-w-xl mx-auto text-lg text-gray-600 dark:text-gray-300">
        {{ $t('common.auth.loginToComment') }}
      </p>
      <div class="flex justify-center pt-2"><AuthForm /></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import 'tippy.js/dist/tippy.css'
import { formatDate } from '~~/shared/utils'

const { data: auth } = useAuth()
const localePath = useLocalePath()
const clientSite = await useClientSite()

const { data: feat, pending: featPending } = await useLazyFetch(`/api/articles/featured/${clientSite?.name}`)
const page = shallowRef<number>(1)
const limit = shallowRef<number>(15)
const selectedTag = shallowRef<string>('')
const searchQuery = shallowRef<string>('')

const query = computed(() => ({
  page: page.value,
  limit: limit.value,
  ...(selectedTag.value ? { tag: selectedTag.value } : {}),
  ...(searchQuery.value ? { query: searchQuery.value } : {}),
}))

const {
  data: feed,
  refresh,
  pending,
} = await useLazyFetch(`/api/articles/by-clientsite/${clientSite?.name}`, {
  query,
  watch: false,
})

const articleMap = ref<Map<string, NonNullable<typeof feed.value>['items'][number]>>(new Map())
const hasMore = shallowRef<boolean>(true)
const latestPoll = ref<{ type: string; pollId: string; question: string; options: string[]; articleId: string } | null>(
  null,
)

watch(
  feed,
  (d) => {
    const next = (d?.items ?? []).filter((a) => !articleMap.value.has(a.id))
    for (const article of next) {
      articleMap.value.set(article.id, article)
    }

    if (d?.latestPoll) {
      latestPoll.value = d.latestPoll as unknown as typeof latestPoll.value
    } else {
      latestPoll.value = null
    }

    hasMore.value = !!d?.hasMore
  },
  { immediate: true },
)

const debouncedRefresh = useDebounceFn(() => {
  page.value = 1
  articleMap.value.clear()
  hasMore.value = true
  refresh()
}, 400)

watch([selectedTag, searchQuery], debouncedRefresh)

const allArticles = computed(() => Array.from(articleMap.value.values()))
const featured = computed(() => feat.value?.featured ?? null)
const recommended = computed(() => feat.value?.recommended ?? [])
const tags = computed(() => feed.value?.tags ?? [])
const topArticles = computed(() =>
  allArticles.value.length
    ? [...allArticles.value].sort((a, b) => (b._count?.reactions ?? 0) - (a._count?.reactions ?? 0)).slice(0, 3)
    : [],
)
const filteredArticles = computed(() => allArticles.value.filter((a) => a.id !== featured.value?.id))
const latestArticleTitle = computed(() => {
  if (!allArticles.value.length) return $t('common.noItems')
  const latestArticle = [...allArticles.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]
  return latestArticle?.title ?? $t('common.noItems')
})
const latestArticleSlug = computed(() => {
  if (!allArticles.value.length) return null
  const latestArticle = [...allArticles.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]
  return latestArticle?.slug ?? null
})

const loadMore = async () => {
  if (!hasMore.value) return
  page.value++
  await refresh()
}
</script>
