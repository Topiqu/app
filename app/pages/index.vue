<template>
  <main
    class="sm:min-w-md md:min-w-lg lg:min-w-xl xl:min-w-2xl max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-12"
  >
    <section class="text-center py-2 sm:py-3 space-y-2 relative">
      <div class="absolute top-2 right-2">
        <div
          class="w-12 h-12 flex flex-col items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm"
        >
          <span class="text-base font-semibold text-gray-900 dark:text-gray-100 leading-none">
            {{ new Date().getDate() }}
          </span>
          <span class="text-[0.65rem] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ new Date().toLocaleDateString(locale, { month: 'short' }) }}
          </span>
        </div>
      </div>
      <NuxtImg
        v-if="clientSite?.logoUrl"
        :src="clientSite.logoUrl"
        class="w-16 h-16 mx-auto mb-2 rounded-full object-contain border border-gray-200 dark:border-gray-700"
        :alt="$t('common.avatar.alt.company')"
      />
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {{ clientSite?.name ?? $t('common.labels.title') }}
        </h1>
        <div class="w-8 h-1 bg-blue-500 mx-auto mt-2 rounded"></div>
      </div>
      <p class="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
        {{ clientSite?.description ?? $t('common.preferences.companyDescription.placeholder') }}
      </p>
      <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
        <span>{{ $t('stats.articleCount', { count: allArticles.length }) }}</span>
        <span>•</span>
        <span>{{ $t('articles.latestArticle') }}</span>
        <NuxtLink
          :to="localePath({ name: 'clanky-slug', params: { slug: latestArticleSlug ?? '' } })"
          class="underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400 transition truncate max-w-[180px]"
        >
          {{ latestArticleTitle }}
        </NuxtLink>
      </div>
      <div class="mt-3 max-w-2xl mx-auto">
        <div class="flex flex-wrap justify-center gap-1.5">
          <NuxtLink
            :to="localePath({ name: 'stitky-slug', params: { slug: '' } })"
            class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700 transition"
          >
            {{ $t('articles.title') }}
          </NuxtLink>
          <NuxtLink
            v-for="tag in tags"
            :key="tag.id"
            :to="localePath({ name: 'stitky-slug', params: { slug: tag.name } })"
            class="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700 transition"
            role="listitem"
          >
            {{ tag.name }}
          </NuxtLink>
        </div>
      </div>
      <hr class="mt-4 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
    </section>

    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ArticleSkeletonCard :pending="featPending" isFeatured :article="featured || undefined" :tags="featured?.tags" />
      <div class="space-y-6">
        <ArticleSkeletonCard
          v-for="(rec, idx) in recommended"
          :key="rec.id"
          :pending="featPending"
          :article="rec"
          :tags="rec.tags"
          :index="idx"
        />
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section id="articles" class="bg-gray-100 dark:bg-gray-900 rounded-xl py-8 px-6">
      <div class="max-w-5xl mx-auto" style="background-color: transparent !important">
        <div class="flex flex-col items-center mb-6 gap-4" style="background-color: transparent !important">
          <h2 class="text-3xl font-bold">{{ $t('articles.title') }}</h2>
        </div>
        <div class="w-full mb-6" style="background-color: transparent !important">
          <div class="flex flex-col items-center gap-4" style="background-color: transparent !important">
            <div class="w-full max-w-3xl">
              <label for="article-search" class="sr-only">{{ $t('articles.searchPlaceholder') }}</label>
              <div class="relative w-full group">
                <span
                  class="absolute inset-y-0 left-4 flex items-center text-gray-400 group-focus-within:text-blue-500 transition-colors"
                >
                  <Icon name="material-symbols:search-rounded" class="w-5 h-5 z-50" />
                </span>
                <input
                  id="article-search"
                  v-model="searchQuery"
                  type="search"
                  :placeholder="$t('articles.searchPlaceholder')"
                  :aria-label="$t('articles.searchPlaceholder')"
                  class="w-full pl-12 pr-10 py-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:shadow-lg transition-all duration-200"
                />
              </div>
            </div>
            <div class="w-full flex flex-wrap justify-center gap-2" style="background-color: transparent !important">
              <Button :variant="selectedTag === '' ? 'primary' : 'neutral'" @click="selectedTag = ''">
                {{ $t('articles.title') }}
              </Button>
              <Button
                v-for="tag in tags"
                :key="tag.id"
                role="listitem"
                :variant="selectedTag === tag.name ? 'primary' : 'neutral'"
                @click="selectedTag = selectedTag === tag.name ? '' : tag.name"
              >
                {{ tag.name }}
              </Button>
            </div>
          </div>
        </div>
        <div
          v-if="filteredArticles.length"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          style="background-color: transparent !important"
        >
          <ArticleSkeletonCard
            v-for="(article, idx) in filteredArticles"
            :key="article.id"
            :pending="pending"
            :article="article"
            :tags="article.tags"
            :index="idx"
          />
        </div>
        <p v-else class="text-center text-lg text-gray">{{ $t('articles.noResults.message') }}</p>
        <div v-if="hasMore" class="mt-8 text-center" style="background-color: transparent !important">
          <button
            :disabled="pending"
            class="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold text-lg hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 transition duration-300 disabled:opacity-50"
            @click="loadMore"
          >
            <span v-if="pending" class="animate-spin inline-block mr-2">↻</span>
            {{ $t('common.pagination.next') }}
          </button>
        </div>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-gray-100 dark:bg-gray-900 rounded-xl py-8 px-6">
        <h2 class="text-3xl font-bold text-center mb-6">{{ $t('articles.poll.hpTitle') }}</h2>
        <ArticlePoll v-if="latestPoll" :poll="latestPoll" :articleId="latestPoll.articleId" />
        <p v-else class="text-center text-lg text-gray">{{ $t('articles.poll.noPolls') }}</p>
      </div>
      <aside class="space-y-8">
        <div>
          <h3 class="text-xl font-bold mb-4">{{ $t('stats.topArticle.pluralTitle') }}</h3>
          <template v-if="topArticles.length">
            <NuxtLink
              v-for="(top, idx) in topArticles"
              :key="top.id"
              :to="localePath({ name: 'clanky-slug', params: { slug: top?.slug } })"
              class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4 flex items-center gap-4 hover:shadow-xl hover:shadow-blue-500/20 dark:hover:shadow-blue-600/20 transition duration-300 group no-underline relative"
            >
              <div
                class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
              />
              <NuxtImg
                v-if="top.imageUrl"
                :src="top.imageUrl"
                class="w-16 h-16 object-cover rounded-lg group-hover:shadow-md transition duration-500 relative z-20"
                :alt="$t('articles.articleCard.imageAlt')"
              />
              <div v-else class="w-16 h-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg">
                <Icon name="mdi:image-off" class="w-8 h-8 text-gray-400" />
              </div>
              <div class="relative z-20">
                <h4
                  class="text-base font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
                >
                  #{{ idx + 1 }} {{ top.title }}
                </h4>
                <div class="mt-1 text-sm">
                  {{ formatDate(top.createdAt ?? undefined) }}
                </div>
              </div>
            </NuxtLink>
          </template>
          <p v-else class="text-gray">{{ $t('articles.noResults.message') }}</p>
        </div>
      </aside>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section
      v-if="!auth"
      class="text-center bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-xl py-12 shadow-lg"
    >
      <h3 class="text-2xl font-bold">{{ $t('common.auth.loginPrompt') }}</h3>
      <p class="mt-3 max-w-xl mx-auto text-lg">{{ $t('common.auth.loginToComment') }}</p>
      <div class="mt-6 flex justify-center"><AuthForm /></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import 'tippy.js/dist/tippy.css'
import { formatDate } from '~~/shared/utils'

const { data: auth } = useAuth()
const localePath = useLocalePath()
const { locale } = useI18n()
const clientSite = await useClientSite()

const { data: feat, pending: featPending } = await useFetch(`/api/articles/featured/${clientSite?.name}`, {
  lazy: true,
})
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
} = await useFetch(`/api/articles/by-clientsite/${clientSite?.name}`, {
  query,
  lazy: true,
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
