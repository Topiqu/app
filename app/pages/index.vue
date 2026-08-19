<template>
  <ArticleEmptyPage v-if="isBlankSite" :site="clientSite" :isOwner="isOwner" />

  <div v-else class="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <section
      class="grid gap-4 md:grid-cols-2 lg:min-h-[calc(100dvh-var(--topiqu-header-height)-6rem)] lg:grid-cols-12 lg:items-stretch"
      data-editorial-hero
    >
      <div
        class="editorial-enter flex max-w-2xl flex-col justify-center space-y-6 py-6 md:col-span-1 lg:col-span-5"
        style="--enter-order: 0"
      >
        <div class="flex items-center gap-4">
          <AppMedia
            :src="clientSite?.logoUrl"
            originalSrc="/app-logo.png"
            :fallbackText="clientSite?.name || 'Topiqu'"
            :alt="$t('common.avatar.alt.company')"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="72px"
            containerClass="size-16 shrink-0 rounded-[var(--topiqu-surface-radius)] bg-elevated sm:size-20"
          />
          <p v-if="clientSite?.tagline" class="text-sm font-semibold text-primary">{{ clientSite.tagline }}</p>
        </div>
        <h1
          class="max-w-[14ch] text-4xl font-black leading-[1.05] tracking-tight text-highlighted sm:text-5xl lg:text-6xl"
        >
          {{ clientSite?.name ?? $t('common.labels.title') }}
        </h1>
        <p v-if="clientSite?.description" class="line-clamp-4 max-w-[60ch] text-lg leading-8 text-muted">
          {{ clientSite.description }}
        </p>
        <div class="flex flex-wrap gap-3">
          <UButton
            :to="primaryCtaTo"
            icon="i-mdi-arrow-right"
            trailing
            class="publication-primary-cta"
            data-primary-cta
            color="neutral"
            variant="solid"
          >
            {{ $t('articles.home.latestStory') }}
          </UButton>
          <UButton
            v-if="heroArticle?.slug"
            to="#articles"
            color="neutral"
            variant="soft"
            icon="i-mdi-format-list-bulleted"
          >
            {{ $t('articles.home.browseArticles') }}
          </UButton>
        </div>
      </div>

      <article
        v-if="heroArticle?.slug"
        class="editorial-enter group relative flex min-h-[28rem] flex-col overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default bg-default md:col-span-1 lg:min-h-0"
        :class="hasHeroRail ? 'lg:col-span-5' : 'lg:col-span-7'"
        style="--enter-order: 1"
      >
        <NuxtLink
          :to="localePath({ name: 'clanky-slug', params: { slug: heroArticle.slug } })"
          class="absolute inset-0 z-10"
          :aria-label="heroArticle.title"
        />
        <AppMedia
          :src="heroArticle.imageUrl"
          :alt="heroArticle.title"
          priority
          aspectRatio="16 / 10"
          sizes="100vw md:50vw lg:42vw"
          containerClass="min-h-56 w-full flex-1"
        />
        <div class="space-y-3 p-5 sm:p-6">
          <div v-if="heroTags.length" class="flex flex-wrap gap-2">
            <UBadge v-for="tag in heroTags" :key="tag.id" color="primary" variant="soft">{{ tag.name }}</UBadge>
          </div>
          <h2 class="line-clamp-3 text-2xl font-black leading-tight tracking-tight text-highlighted sm:text-3xl">
            {{ heroArticle.title }}
          </h2>
          <p v-if="heroExcerpt" class="line-clamp-2 text-sm leading-6 text-muted">{{ heroExcerpt }}</p>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>{{ formatDate(heroArticle.publishedAt || heroArticle.createdAt) }}</span>
            <span v-if="heroArticle.readingTime">{{ $t('articles.readingTime', [heroArticle.readingTime]) }}</span>
            <span class="inline-flex items-center gap-1"
              ><UIcon name="i-mdi-eye-outline" size="16" />{{ heroArticle.views ?? 0 }}</span
            >
          </div>
        </div>
      </article>
      <USkeleton v-else-if="featPending" class="aspect-[4/3] w-full md:col-span-1 lg:col-span-7" />

      <aside
        v-if="hasHeroRail"
        class="editorial-enter grid gap-4 md:col-span-2 md:grid-cols-2 lg:col-span-2 lg:grid-cols-1"
        style="--enter-order: 2"
      >
        <article
          v-if="tags[0]"
          class="relative flex min-h-36 flex-col justify-between rounded-[var(--topiqu-surface-radius)] border border-default bg-elevated p-4"
        >
          <NuxtLink
            :to="localePath({ name: 'stitky-slug', params: { slug: tags[0].slug } })"
            class="absolute inset-0"
            :aria-label="tags[0].name"
          />
          <UIcon name="i-mdi-pound" size="24" class="text-primary" />
          <span class="line-clamp-2 text-lg font-bold text-highlighted">{{ tags[0].name }}</span>
        </article>
        <div
          v-if="feat?.totalArticles"
          class="flex min-h-36 flex-col justify-between rounded-[var(--topiqu-surface-radius)] border border-default p-4"
        >
          <span class="text-sm font-medium text-muted">{{ $t('stats.articleCount') }}</span>
          <strong class="text-4xl font-black tabular-nums text-highlighted">{{
            formatNumber(feat.totalArticles)
          }}</strong>
        </div>
      </aside>
    </section>

    <section v-if="tags.length" class="space-y-5" aria-labelledby="topic-explorer-title">
      <h2 id="topic-explorer-title" class="text-2xl font-bold tracking-tight text-highlighted">
        {{ $t('articles.home.exploreTopics') }}
      </h2>
      <div class="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-2">
        <UBadge
          v-for="tag in tags"
          :key="tag.id"
          as="button"
          type="button"
          size="lg"
          :color="selectedTag === tag.name ? 'primary' : 'neutral'"
          :variant="selectedTag === tag.name ? 'solid' : 'soft'"
          :aria-pressed="selectedTag === tag.name"
          class="shrink-0"
          @click="selectTopic(tag.name)"
        >
          {{ tag.name }}
        </UBadge>
      </div>
    </section>

    <section v-if="recommendedArticles.length" class="space-y-6" aria-labelledby="recommended-title">
      <h2 id="recommended-title" class="text-3xl font-bold tracking-tight text-highlighted">
        {{ $t('articles.home.recommended') }}
      </h2>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <ArticleCard :article="recommendedArticles[0]!" variant="featured" />
        <div v-if="recommendedArticles.length > 1" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <ArticleCard
            v-for="article in recommendedArticles.slice(1, 3)"
            :key="article.id"
            :article="article"
            variant="compact"
          />
        </div>
      </div>
    </section>

    <section v-if="showFeed" id="articles" class="space-y-6">
      <div class="flex items-baseline justify-between gap-4 border-b border-default pb-3">
        <h2 class="text-3xl font-bold tracking-tight">{{ $t('articles.title') }}</h2>
      </div>

      <div
        v-if="hasContent || hasFilters"
        class="sticky top-16 z-20 -mx-4 space-y-3 border-b border-default bg-default px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <UFormField :label="$t('articles.searchPlaceholder')" :ui="{ label: 'sr-only' }" class="w-full">
          <UInput
            id="article-search"
            v-model="searchQuery"
            type="search"
            :placeholder="$t('articles.searchPlaceholder')"
            :aria-label="$t('articles.searchPlaceholder')"
            icon="i-mdi-magnify"
            class="w-full"
          />
        </UFormField>
        <div class="flex flex-nowrap overflow-x-auto gap-2 -mx-1 px-1 pb-1">
          <UBadge
            as="button"
            type="button"
            size="sm"
            :color="selectedTag === '' ? 'primary' : 'neutral'"
            :variant="selectedTag === '' ? 'solid' : 'soft'"
            :aria-pressed="selectedTag === ''"
            @click="selectedTag = ''"
          >
            {{ $t('articles.title') }}
          </UBadge>
          <UBadge
            v-for="tag in tags"
            :key="tag.id"
            as="button"
            type="button"
            size="sm"
            :color="selectedTag === tag.name ? 'primary' : 'neutral'"
            :variant="selectedTag === tag.name ? 'solid' : 'soft'"
            :aria-pressed="selectedTag === tag.name"
            @click="selectedTag = selectedTag === tag.name ? '' : tag.name"
          >
            {{ tag.name }}
          </UBadge>
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
      <UEmpty v-else icon="i-mdi-file-search-outline" :title="$t('articles.noResults.message')" />

      <div v-if="hasMore" class="text-center pt-4">
        <UButton :disabled="pending" :loading="pending" @click="loadMore">
          {{ $t('common.pagination.next') }}
        </UButton>
      </div>
    </section>

    <section v-if="latestPoll || topArticles.length" class="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div v-if="latestPoll" class="space-y-4" :class="{ 'lg:col-span-2': !topArticles.length }">
        <h2 class="text-2xl font-bold tracking-tight text-highlighted">
          {{ $t('articles.poll.hpTitle') }}
        </h2>
        <ArticlePoll :poll="latestPoll" :articleId="latestPoll.articleId" />
      </div>
      <aside v-if="topArticles.length" class="space-y-5" :class="{ 'lg:col-span-2': !latestPoll }">
        <h3 class="text-2xl font-bold tracking-tight text-highlighted">
          {{ $t('stats.topArticle.pluralTitle') }}
        </h3>
        <ol class="grid gap-3">
          <li
            v-for="(top, idx) in topArticles"
            :key="top.id"
            class="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3"
          >
            <span class="pt-3 text-xl font-black tabular-nums text-primary">{{ idx + 1 }}</span>
            <ArticleCard :article="top" variant="compact" layout="responsive-row" />
          </li>
        </ol>
      </aside>
    </section>

    <section class="grid gap-8 border-t border-default py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div class="max-w-3xl space-y-4">
        <h2 class="text-3xl font-bold tracking-tight text-highlighted">{{ clientSite?.name }}</h2>
        <p v-if="clientSite?.description" class="leading-7 text-muted">{{ clientSite.description }}</p>
        <dl class="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt class="text-sm text-muted">{{ $t('stats.articleCount') }}</dt>
            <dd class="mt-1 text-2xl font-bold text-highlighted">
              {{ formatNumber(feat?.totalArticles || allArticles.length) }}
            </dd>
          </div>
          <div v-if="tags.length">
            <dt class="text-sm text-muted">{{ $t('articles.tags.title') }}</dt>
            <dd class="mt-1 text-2xl font-bold text-highlighted">{{ formatNumber(tags.length) }}</dd>
          </div>
        </dl>
      </div>
      <div class="flex flex-col items-start gap-4 lg:items-end">
        <ClientSocials v-if="clientSite?.id" :clientSiteId="clientSite.id" />
        <div v-if="!auth" class="max-w-md lg:text-right">
          <h3 class="text-xl font-bold tracking-tight text-highlighted">{{ $t('common.auth.loginPrompt') }}</h3>
          <p class="mt-2 text-sm text-muted">{{ $t('common.auth.loginToComment') }}</p>
          <div class="mt-4">
            <UButton :to="localePath({ name: 'autorizace' })" color="neutral" variant="solid" icon="i-mdi-login">
              {{ $t('common.auth.login') }}
            </UButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PollOptionData } from '~~/shared/utils/polls'

import { formatDate } from '~~/shared/utils'
import { formatNumber } from '~~/shared/utils/number'

definePageMeta({ shell: 'publication' })

const { data: auth } = useAuth()
const localePath = useLocalePath()
const clientSite = await useClientSite()

const { data: feat, pending: featPending } = await useFetch(`/api/articles/featured/${clientSite?.name}`)
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

const articleMap = ref<Map<string, NonNullable<typeof feed.value>['items'][number]>>(new Map())
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
const reservedIds = computed(
  () => new Set([featured.value?.id, ...recommended.value.map((article) => article.id)].filter(Boolean)),
)
const recommendedArticles = computed(() => recommended.value.filter((article) => article.id !== featured.value?.id))
const topArticles = computed(() =>
  allArticles.value.length
    ? [...allArticles.value].sort((a, b) => (b._count?.reactions ?? 0) - (a._count?.reactions ?? 0)).slice(0, 3)
    : [],
)
const filteredArticles = computed(() => allArticles.value.filter((article) => !reservedIds.value.has(article.id)))
const latestArticle = computed(
  () =>
    [...allArticles.value].sort(
      (a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime(),
    )[0] ?? null,
)
const heroArticle = computed(() => featured.value || latestArticle.value)
const primaryCtaArticle = computed(() => latestArticle.value || featured.value)
const primaryCtaTo = computed(() =>
  primaryCtaArticle.value?.slug
    ? localePath({ name: 'clanky-slug', params: { slug: primaryCtaArticle.value.slug } })
    : '#articles',
)
const heroTags = computed(() =>
  (heroArticle.value?.tags ?? [])
    .map((item: any, index: number) => ({
      id: item.tag?.id || item.id || String(index),
      name: item.tag?.name || item.name || '',
    }))
    .filter((tag) => tag.name)
    .slice(0, 2),
)
const heroExcerpt = computed(() =>
  (heroArticle.value?.excerpt || heroArticle.value?.content || '').replace(/<[^>]+>/g, '').trim(),
)
const hasHeroRail = computed(() => Boolean(tags.value[0] || feat.value?.totalArticles))

const hasFilters = computed(() => Boolean(searchQuery.value || selectedTag.value))
const hasContent = computed(() => allArticles.value.length > 0)
const showFeed = computed(() => pending.value || hasFilters.value || filteredArticles.value.length > 0)

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

const selectTopic = (tagName: string) => {
  selectedTag.value = selectedTag.value === tagName ? '' : tagName
  nextTick(() => document.querySelector('#articles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
</script>
