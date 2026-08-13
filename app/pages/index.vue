<template>
  <ArticleEmptyPage v-if="isBlankSite" :site="clientSite" :isOwner="isOwner" />

  <main v-else class="home-shell custom-ui">
    <section class="home-hero">
      <div class="home-hero__eyebrow">
        <span class="home-hero__eyebrow-line" />
        {{ $t('articles.title') }}
      </div>
      <NuxtImg
        v-if="clientSite?.logoUrl"
        :src="clientSite.logoUrl"
        class="home-hero__logo"
        :alt="$t('common.avatar.alt.company')"
        width="192"
        height="80"
        fit="inside"
      />
      <h1 v-if="clientSite?.logoUrl" class="sr-only">
        {{ clientSite.name }}
      </h1>
      <div v-else class="home-hero__heading">
        <h1 class="home-hero__title">
          {{ clientSite?.name ?? $t('common.labels.title') }}
        </h1>
      </div>
      <p v-if="clientSite?.description" class="home-hero__description">
        {{ clientSite.description }}
      </p>
      <div v-if="latestArticle" class="home-hero__meta">
        <span>{{ $t('stats.articleCount', { count: allArticles.length }) }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ $t('articles.latestArticle') }}</span>
        <NuxtLink
          :to="localePath({ name: 'clanky-slug', params: { slug: latestArticle.slug } })"
          class="home-hero__latest"
        >
          {{ latestArticle.title }}
        </NuxtLink>
      </div>
    </section>

    <section v-if="hasHighlights" class="home-highlights">
      <h2 class="sr-only">{{ $t('articles.latestArticle') }}</h2>
      <ArticleSkeletonCard
        v-if="featPending || featured"
        :pending="featPending"
        isFeatured
        :article="featured || undefined"
        :tags="featured?.tags"
        :index="0"
      />
      <div v-if="featPending || recommended.length" class="home-recommended">
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

    <section v-if="showFeed" id="articles" class="home-feed">
      <div class="home-section-heading">
        <span class="home-section-heading__index">01</span>
        <h2>{{ $t('articles.title') }}</h2>
      </div>

      <div v-if="hasContent || hasFilters" class="home-filters">
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
            class="home-search"
          />
        </div>
        <div class="home-tags">
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

      <div v-if="pending && !filteredArticles.length" class="home-grid">
        <ArticleSkeletonCard v-for="i in 6" :key="`skel-feed-${i}`" :pending="true" :index="i - 1" />
      </div>
      <div v-else-if="filteredArticles.length" class="home-grid">
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

    <section v-if="latestPoll || topArticles.length" class="home-secondary">
      <div v-if="latestPoll" class="space-y-4" :class="{ 'lg:col-span-2': !topArticles.length }">
        <h2 class="text-2xl font-bold tracking-tight border-l-4 border-blue-500 pl-3">
          {{ $t('articles.poll.hpTitle') }}
        </h2>
        <ArticlePoll :poll="latestPoll" :articleId="latestPoll.articleId" />
      </div>
      <aside v-if="topArticles.length" class="space-y-4" :class="{ 'lg:col-span-2': !latestPoll }">
        <h3 class="text-2xl font-bold tracking-tight border-l-4 border-blue-500 pl-3">
          {{ $t('stats.topArticle.pluralTitle') }}
        </h3>
        <NuxtLink
          v-for="(top, idx) in topArticles"
          :key="top.id"
          :to="localePath({ name: 'clanky-slug', params: { slug: top.slug } })"
          class="flex items-center gap-4 p-3 -mx-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition no-underline group"
        >
          <span class="flex-shrink-0 w-8 text-2xl font-black text-blue-500 dark:text-blue-400 text-center tabular-nums">
            {{ idx + 1 }}
          </span>
          <NuxtImg
            v-if="top.imageUrl"
            :src="top.imageUrl"
            class="w-16 h-16 object-cover rounded-lg"
            :alt="$t('articles.articleCard.imageAlt')"
            width="64"
            height="64"
            sizes="64px"
            format="webp"
            :quality="70"
            loading="lazy"
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
      </aside>
    </section>

    <section v-if="!auth" class="border-t border-gray-200 dark:border-gray-800 pt-12 pb-4 text-center space-y-4">
      <h3 class="text-3xl font-bold tracking-tight">{{ $t('common.auth.loginPrompt') }}</h3>
      <p class="max-w-xl mx-auto text-lg text-gray-600 dark:text-gray-300">
        {{ $t('common.auth.loginToComment') }}
      </p>
      <div class="flex justify-center pt-2"><LazyAuthForm /></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { PollOptionData } from '~~/shared/utils/polls'

import { formatDate } from '~~/shared/utils'

interface HomeArticle {
  id: string
  slug: string
  title: string
  content?: string | null
  excerpt: string | null
  imageUrl: string | null
  createdAt: string
  readingTime: number | null
  views: number
  user: { id: string; username: string; avatarUrl: string | null } | null
  tags: { tag: { id: string; name: string; slug: string } }[]
  _count: { comments: number; reactions: number } | null
}

const { data: auth } = useAuth()
const localePath = useLocalePath()
const { locale } = useI18n()
const clientSite = await useClientSite()

const { data: feat, pending: featPending } = await useFetch(`/api/articles/featured/${clientSite?.name}`, {
  query: { locale },
})
const page = shallowRef<number>(1)
const limit = shallowRef<number>(15)
const selectedTag = shallowRef<string>('')
const searchQuery = shallowRef<string>('')

const query = computed(() => ({
  page: page.value,
  limit: limit.value,
  locale: locale.value,
  ...(selectedTag.value ? { tag: selectedTag.value } : {}),
  ...(searchQuery.value ? { query: searchQuery.value } : {}),
}))

const isBlankSite = (feat.value?.totalArticles ?? 0) === 0

const {
  data: feed,
  refresh,
  pending,
} = await useLazyFetch(`/api/articles/by-clientsite/${clientSite?.name}`, {
  query,
  watch: false,
  immediate: !isBlankSite,
})

// Keep the view model shallow. Inferring this from the ZenStack-enhanced endpoint response makes
// Volar recursively instantiate the full policy-aware payload type in every template binding.
const articleMap = ref<Map<string, HomeArticle>>(new Map())
const hasMore = shallowRef<boolean>(true)
const latestPoll = ref<{
  type: string
  pollId: string
  question: string
  options: PollOptionData[]
  articleId: string
} | null>(null)

watch(
  feed,
  (d) => {
    const next = (d?.items ?? []).filter((a) => !articleMap.value.has(a.id))
    for (const article of next) {
      articleMap.value.set(article.id, article as HomeArticle)
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
const featuredId = computed<string | undefined>(() => feat.value?.featured?.id)
const recommended = computed(() => feat.value?.recommended ?? [])
const tags = computed(() => feed.value?.tags ?? [])
const topArticles = computed(() =>
  allArticles.value.length
    ? [...allArticles.value].sort((a, b) => (b._count?.reactions ?? 0) - (a._count?.reactions ?? 0)).slice(0, 3)
    : [],
)
const filteredArticles = computed(() => allArticles.value.filter((article) => article.id !== featuredId.value))
const latestArticle = computed(
  () =>
    [...allArticles.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
)

const hasFilters = computed(() => Boolean(searchQuery.value || selectedTag.value))
const hasContent = computed(() => allArticles.value.length > 0)
const showFeed = computed(() => pending.value || hasFilters.value || filteredArticles.value.length > 0)
const hasHighlights = computed(() => featPending.value || Boolean(featured.value) || recommended.value.length > 0)

const isOwner = computed(() => {
  const user = auth.value?.user
  if (!user) return false
  if (user.role === 'superadmin') return true
  return user.role === 'admin' && Boolean(clientSite?.id) && user.clientSiteId === clientSite?.id
})

const hasPublishedArticles = computed(() => (feat.value?.totalArticles ?? 0) > 0)

useSeoMeta({
  robots: () => (hasPublishedArticles.value ? 'index, follow' : 'noindex, follow'),
})

const loadMore = async () => {
  if (!hasMore.value) return
  page.value++
  await refresh()
}
</script>

<style scoped>
.home-shell {
  --home-ink: #17211b;
  --home-muted: #657068;
  --home-accent: var(--client-accent, #2563eb);
  --home-line: rgb(23 33 27 / 12%);
  width: min(100% - 2rem, 80rem);
  margin-inline: auto;
  padding: clamp(5.5rem, 10vw, 8rem) 0 5rem;
  display: grid;
  gap: clamp(3.5rem, 7vw, 7rem);
  color: var(--home-ink);
}

.home-hero {
  display: grid;
  justify-items: center;
  gap: 1rem;
  padding: clamp(1.5rem, 4vw, 3rem) clamp(0.5rem, 3vw, 2rem) clamp(2.5rem, 6vw, 4.5rem);
  text-align: center;
  border-bottom: 1px solid var(--home-line);
}

.home-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--home-muted);
}

.home-hero__eyebrow-line {
  width: 1.5rem;
  height: 2px;
  background: var(--home-accent);
}
.home-hero__logo {
  width: auto;
  height: auto;
  max-width: min(12rem, 70vw);
  max-height: 5rem;
  object-fit: contain;
}
.home-hero__heading {
  max-width: 62rem;
}
.home-hero__title {
  font-size: clamp(2.5rem, 7vw, 5.5rem);
  line-height: 1;
  letter-spacing: -0.055em;
  font-weight: 750;
  text-wrap: balance;
}
.home-hero__description {
  max-width: 44rem;
  font-size: clamp(1rem, 2vw, 1.25rem);
  line-height: 1.65;
  color: var(--home-muted);
  text-wrap: balance;
}
.home-hero__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem 0.65rem;
  margin-top: 0.5rem;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--home-muted);
}
.home-hero__latest {
  max-width: min(17rem, 75vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--home-ink);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--home-accent) 45%, transparent);
  text-underline-offset: 0.25rem;
}

.home-highlights {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(17rem, 1fr);
  gap: clamp(1rem, 2.5vw, 2rem);
  align-items: stretch;
}
.home-recommended {
  display: grid;
  gap: 1rem;
}
.home-feed {
  display: grid;
  gap: 1.75rem;
  scroll-margin-top: 5rem;
}
.home-section-heading {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--home-line);
}
.home-section-heading h2 {
  font-size: clamp(2rem, 5vw, 3.75rem);
  line-height: 1;
  letter-spacing: -0.045em;
  font-weight: 780;
}
.home-section-heading__index {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--home-accent);
}
.home-filters {
  position: sticky;
  top: 0.75rem;
  z-index: 20;
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--home-line);
  border-radius: 1.25rem;
  background: rgb(251 250 246 / 90%);
  box-shadow: 0 12px 35px rgb(23 33 27 / 8%);
  backdrop-filter: blur(16px);
}
.home-search {
  width: 100%;
  min-height: 3rem;
  padding: 0.7rem 1rem 0.7rem 2.75rem !important;
  border-radius: 0.85rem !important;
  background: rgb(255 255 255 / 72%) !important;
}
.home-tags {
  display: flex;
  gap: 0.5rem;
  max-width: 100%;
  overflow-x: auto;
  padding: 0 0.1rem 0.2rem;
  scrollbar-width: none;
}
.home-tags::-webkit-scrollbar {
  display: none;
}
.home-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 2.5vw, 2rem);
}
.home-secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(2rem, 5vw, 4rem);
  padding-top: clamp(2rem, 5vw, 4rem);
  border-top: 1px solid var(--home-line);
}

:global(html.dark) .home-shell {
  --home-ink: #f1eee7;
  --home-muted: #a9b2ab;
  --home-line: rgb(241 238 231 / 14%);
}
:global(html.dark) .home-filters {
  background: rgb(23 32 26 / 90%);
}
:global(html.dark) .home-search {
  background: rgb(31 41 55 / 75%) !important;
}

@media (max-width: 900px) {
  .home-highlights,
  .home-secondary {
    grid-template-columns: 1fr;
  }
  .home-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .home-shell {
    width: min(100% - 1rem, 80rem);
    padding-top: 4.75rem;
    gap: 3.5rem;
  }
  .home-hero {
    justify-items: start;
    padding: 1rem 0.5rem 2.5rem;
    text-align: left;
  }
  .home-hero__eyebrow {
    font-size: 0.65rem;
  }
  .home-hero__title {
    font-size: clamp(2.5rem, 15vw, 4.1rem);
  }
  .home-hero__description {
    font-size: 1rem;
  }
  .home-hero__meta {
    justify-content: flex-start;
    text-align: left;
  }
  .home-hero__logo {
    max-width: min(10rem, 70vw);
    max-height: 4rem;
  }
  .home-grid {
    grid-template-columns: 1fr;
  }
  .home-filters {
    top: 0.5rem;
    border-radius: 1rem;
  }
  .home-secondary {
    gap: 3rem;
  }
}
</style>
