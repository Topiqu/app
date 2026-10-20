<template>
  <UContainer v-if="featuredError && !featuredData" class="flex min-h-[60dvh] items-center py-16">
    <UAlert
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('articles.home.loadError')"
      :description="$t('articles.home.loadErrorDescription')"
    >
      <template #actions>
        <UButton color="error" variant="soft" @click="refreshFeatured()">{{ $t('common.entry.retry') }}</UButton>
      </template>
    </UAlert>
  </UContainer>

  <ArticleEmptyPage v-else-if="isBlankSite" :site="clientSite" :isOwner="isOwner" />

  <UContainer v-else class="@container space-y-16 pb-16 sm:space-y-20">
    <section
      ref="heroSection"
      class="relative grid gap-6 py-8 sm:py-12 @2xl:min-h-[calc(100dvh-var(--topiqu-header-height))] @2xl:grid-cols-12 @2xl:items-center"
      data-editorial-hero
    >
      <div
        class="flex max-w-2xl flex-col items-center justify-center space-y-6 py-8 text-center @2xl:col-span-5 @2xl:py-0"
        style="transform: translateY(0.75rem)"
      >
        <AppMedia
          priority
          :src="clientSite?.logoUrl"
          :fallbackText="clientSite?.name || 'Topiqu'"
          :fallbackBorder="false"
          :alt="$t('common.avatar.alt.company')"
          aspectRatio="1 / 1"
          fit="contain"
          sizes="224px sm:288px"
          :width="576"
          containerClass="aspect-square w-full max-w-56 rounded-(--topiqu-surface-radius) bg-transparent @2xl:max-w-[min(16rem,24dvh)]"
        />
        <h1 v-if="clientSite?.logoUrl" class="sr-only">
          {{ clientSite?.name ?? $t('common.labels.title') }}
        </h1>
        <div v-else class="home-hero__heading">
          <h1
            class="max-w-[14ch] text-4xl font-black leading-[1.05] tracking-tight text-highlighted @2xl:text-5xl @5xl:text-6xl"
          >
            {{ clientSite?.name ?? $t('common.labels.title') }}
          </h1>
        </div>
        <p
          v-if="clientSite?.tagline"
          class="max-w-[46ch] text-balance break-words border-b-2 border-[var(--topiqu-tenant-accent)] px-4 pb-3 text-base font-semibold leading-snug text-highlighted"
        >
          {{ clientSite.tagline }}
        </p>
        <p v-if="clientSite?.description" class="line-clamp-4 max-w-[60ch] text-lg leading-8 text-muted">
          {{ clientSite.description }}
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton
            :to="primaryCtaTo"
            icon="mdi:arrow-right"
            trailing
            class="publication-primary-cta"
            data-primary-cta
            color="neutral"
            variant="solid"
          >
            {{ $t('articles.home.latestStory') }}
          </UButton>
          <UButton
            v-if="leadArticle?.slug"
            to="#articles"
            color="neutral"
            variant="soft"
            icon="mdi:format-list-bulleted"
          >
            {{ $t('articles.home.browseArticles') }}
          </UButton>
        </div>
      </div>

      <article
        v-if="leadArticle?.slug"
        class="group relative flex min-w-0 min-h-[28rem] flex-col overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default @2xl:col-span-7 @2xl:grid @2xl:h-[calc(100dvh-var(--topiqu-header-height)-6rem)] @2xl:grid-rows-[minmax(0,1fr)_auto] @2xl:self-center"
        :class="hasHeroRail ? '@5xl:col-span-5' : ''"
      >
        <NuxtLink :to="articlePath(leadArticle)" class="absolute inset-0 z-10" :aria-label="leadArticle.title" />
        <AppMedia
          v-if="leadArticle.imageUrl"
          :src="leadArticle.imageUrl"
          :alt="leadArticle.title"
          priority
          aspectRatio="16 / 10"
          sizes="100vw md:50vw lg:42vw"
          containerClass="min-h-56 w-full flex-1 @2xl:h-full @2xl:min-h-0 @2xl:aspect-auto!"
        />
        <div
          v-else
          class="grid min-h-28 place-items-center border-b border-dashed border-default bg-elevated text-primary"
        >
          <UIcon name="mdi:newspaper-variant-outline" size="36" aria-hidden="true" />
          <span class="sr-only">{{ leadArticle.title }}</span>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6">
          <div v-if="leadTags.length" class="flex flex-wrap gap-2">
            <UBadge v-for="tag in leadTags" :key="tag.id" color="primary" variant="soft">{{ tag.name }}</UBadge>
          </div>
          <h2
            class="text-balance text-2xl font-black leading-tight tracking-tight text-highlighted sm:text-3xl @2xl:line-clamp-3"
          >
            {{ leadArticle.title }}
          </h2>
          <p v-if="leadArticle.excerpt" class="text-pretty text-sm leading-6 text-muted @2xl:line-clamp-2">
            {{ leadArticle.excerpt }}
          </p>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>{{ formatDate(leadArticle.publishedAt || leadArticle.createdAt, locale) }}</span>
            <span v-if="leadArticle.readingTime">{{ $t('articles.readingTime', [leadArticle.readingTime]) }}</span>
            <span class="inline-flex items-center gap-1"
              ><UIcon name="mdi:eye-outline" size="16" />{{ leadArticle.views ?? 0 }}</span
            >
          </div>
          <div class="relative z-20 mt-auto space-y-3 pt-2" data-article-footer>
            <USeparator />
            <div class="flex min-h-9 items-center justify-between gap-3">
              <UserCard
                v-if="leadArticle.user?.id"
                :user="{ ...leadArticle.user, id: leadArticle.user.id, bio: null }"
              />
              <span v-else />
              <div class="flex shrink-0 items-center gap-1">
                <UButton
                  :icon="leadLiked ? 'mdi:heart' : 'mdi:heart-outline'"
                  :color="leadLiked ? 'error' : 'neutral'"
                  variant="ghost"
                  square
                  :loading="leadReactionPending"
                  :aria-label="$t('common.actions.like')"
                  @click="toggleLeadLike"
                />
                <UButton
                  icon="mdi:share-variant-outline"
                  color="neutral"
                  variant="ghost"
                  square
                  :aria-label="$t('common.actions.share')"
                  @click="shareLeadArticle"
                />
              </div>
            </div>
          </div>
        </div>
      </article>
      <USkeleton v-else-if="featuredPending" class="aspect-[4/3] w-full @2xl:col-span-7" />

      <aside
        v-if="hasHeroRail"
        class="editorial-enter grid gap-4 @2xl:hidden @5xl:col-span-2 @5xl:grid @5xl:h-[36dvh] @5xl:max-h-[23rem] @5xl:min-h-[18rem] @5xl:grid-cols-1 @5xl:grid-rows-2 @5xl:self-center"
        style="--enter-order: 2"
      >
        <article
          v-if="tags[0]"
          class="relative flex min-h-36 flex-col justify-between rounded-(--topiqu-surface-radius) border border-default bg-elevated p-4"
        >
          <NuxtLink
            :to="localePath({ name: 'stitky-slug', params: { slug: tags[0].slug } })"
            class="absolute inset-0"
            :aria-label="tags[0].name"
          />
          <UIcon name="mdi:pound" size="24" class="text-primary" />
          <span class="line-clamp-2 text-lg font-bold text-highlighted">{{ tags[0].name }}</span>
        </article>
        <div
          v-if="featuredData?.totalArticles"
          class="flex min-h-36 flex-col justify-between rounded-(--topiqu-surface-radius) border border-default p-4"
        >
          <span class="text-sm font-medium text-muted">{{ $t('stats.articleCount') }}</span>
          <strong class="text-4xl font-black tabular-nums text-highlighted">{{
            formatNumber(featuredData.totalArticles)
          }}</strong>
        </div>
      </aside>

      <Transition name="fade-slide">
        <UButton
          v-if="showScrollCue"
          type="button"
          square
          color="neutral"
          variant="soft"
          icon="mdi:chevron-down"
          class="absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 animate-bounce rounded-full @5xl:inline-flex motion-reduce:animate-none"
          :aria-label="$t('articles.home.browseArticles')"
          @click="scrollPastHero"
        />
      </Transition>
    </section>

    <WidgetSlot name="HOME_TOP" />

    <section
      v-if="recommendedArticles.length"
      id="recommended"
      ref="recommendedSection"
      class="scroll-mt-24 space-y-6"
      aria-labelledby="recommended-heading"
    >
      <div class="flex items-baseline justify-between gap-4 border-b border-default pb-4">
        <h2 id="recommended-heading" class="text-2xl font-bold tracking-tight text-highlighted sm:text-3xl">
          {{ $t('articles.home.recommended') }}
        </h2>
      </div>
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <article v-for="article in recommendedArticles" :key="article.id" class="min-w-0">
          <NuxtLink
            :to="articlePath(article)"
            class="group block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AppMedia
              :src="article.imageUrl"
              :alt="''"
              :fallbackText="article.title"
              :fallbackBorder="false"
              aspectRatio="4 / 3"
              sizes="100vw md:50vw lg:33vw"
              containerClass="w-full rounded-(--topiqu-surface-radius) bg-elevated"
            />
            <div class="min-w-0 space-y-2 pt-4">
              <h3
                class="break-words text-balance text-lg font-bold leading-snug text-highlighted group-hover:text-primary sm:text-xl"
              >
                {{ article.title }}
              </h3>
              <p v-if="article.excerpt" class="line-clamp-2 text-sm leading-6 text-muted">{{ article.excerpt }}</p>
              <p class="text-xs text-muted">{{ formatDate(article.publishedAt || article.createdAt, locale) }}</p>
            </div>
          </NuxtLink>
        </article>
      </div>
    </section>

    <HomeSeries v-if="clientSite?.name" :site="clientSite.name" />

    <section
      v-if="tags.length"
      ref="topicsSection"
      aria-labelledby="topics-heading"
      class="grid scroll-mt-24 gap-6 border-t border-default pt-8 lg:grid-cols-[minmax(0,0.3fr)_minmax(0,0.7fr)] lg:gap-10"
    >
      <div class="space-y-2">
        <h2 id="topics-heading" class="text-3xl font-black tracking-tight text-highlighted sm:text-4xl">
          {{ $t('articles.home.exploreTopics') }}
        </h2>
        <p class="text-sm text-muted">{{ $t('articles.home.chooseTopic') }}</p>
      </div>
      <div
        class="topic-strip -mx-1 flex max-w-full snap-x gap-3 overflow-x-auto px-1 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        role="group"
        tabindex="0"
        :aria-label="$t('articles.home.exploreTopics')"
      >
        <UButton
          v-for="tag in tags"
          :key="tag.id"
          :color="selectedTag === tag.name ? 'primary' : 'neutral'"
          :variant="selectedTag === tag.name ? 'solid' : 'outline'"
          size="lg"
          leadingIcon="mdi:pound"
          trailingIcon="mdi:arrow-up-right"
          class="min-h-16 min-w-40 shrink-0 snap-start justify-between px-5 text-left"
          :aria-pressed="selectedTag === tag.name"
          @click="selectTopic(tag.name)"
        >
          {{ tag.name }}
        </UButton>
      </div>
    </section>

    <WidgetSlot name="HOME_MIDDLE" />

    <section
      v-if="showFeed"
      id="articles"
      ref="feedSection"
      aria-labelledby="articles-heading"
      class="scroll-mt-24 space-y-8"
    >
      <div class="flex flex-wrap items-end justify-between gap-4 border-b border-default pb-5">
        <h2 id="articles-heading" class="text-3xl font-black tracking-tight text-highlighted sm:text-4xl">
          {{ $t('articles.home.latestArticles') }}
        </h2>
        <span v-if="!hasFilters && featuredData?.totalArticles" class="text-sm tabular-nums text-muted">
          {{ $t('articles.articlesCount', featuredData.totalArticles) }}
        </span>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <UFormField
          :label="$t('articles.searchPlaceholder')"
          :ui="{ label: 'sr-only' }"
          class="min-w-0 flex-1 sm:max-w-md"
        >
          <UInput
            id="article-search"
            v-model="searchQuery"
            type="search"
            icon="mdi:magnify"
            :loading="feedBusy"
            :placeholder="$t('articles.searchPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UButton v-if="hasFilters" color="neutral" variant="soft" icon="mdi:close" @click="resetFilters">
          {{ $t('articles.home.clearFilters') }}
        </UButton>
      </div>
      <p v-if="selectedTag" class="text-sm text-muted">
        {{ $t('articles.home.selectedTopic', { topic: selectedTag }) }}
      </p>

      <UAlert
        v-if="feedError"
        color="error"
        variant="subtle"
        icon="mdi:alert-circle-outline"
        :title="$t('articles.home.feedError')"
      >
        <template #actions>
          <UButton color="error" variant="soft" @click="refreshFeed()">{{ $t('common.entry.retry') }}</UButton>
        </template>
      </UAlert>

      <div
        ref="feedResults"
        data-feed-results
        :style="{ minHeight: hasFilters ? `${Math.min(feedResultsHeight, viewportHeight)}px` : undefined }"
        :aria-busy="feedBusy"
      >
        <div
          v-if="feedBusy && !visibleArticles.length"
          class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
        >
          <ArticleSkeletonCard
            v-for="index in hasFilters ? 3 : 6"
            :key="index"
            :pending="true"
            :class="hasFilters && index > 1 ? 'hidden sm:block' : ''"
          />
        </div>
        <ol v-else-if="visibleArticles.length" class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <template v-for="(article, index) in visibleArticles" :key="article.id">
            <li class="min-w-0" data-editorial-article>
              <ArticleCard :article="article" />
            </li>
            <li
              v-if="feedAd && index === FEED_AD_AFTER - 1 && visibleArticles.length > FEED_AD_AFTER"
              class="col-span-full"
            >
              <HomeFeedAd :provider="feedAd" />
            </li>
          </template>
        </ol>
        <UEmpty
          v-else-if="!feedError && !feedBusy"
          icon="mdi:file-search-outline"
          :title="$t('articles.home.noMatches')"
        />
      </div>

      <div v-if="hasMore && !feedError" class="flex justify-center border-t border-default pt-6">
        <UButton
          color="neutral"
          variant="outline"
          :to="nextPageTo"
          :loading="feedBusy"
          :disabled="feedBusy"
          @click.prevent="loadMore"
        >
          {{ $t('common.pagination.next') }}
        </UButton>
      </div>
    </section>

    <HomeDiscussions v-if="clientSite?.name" :site="clientSite.name" />

    <section
      v-if="topArticles.length || latestPoll"
      class="grid gap-12 border-t border-default pt-10 lg:grid-cols-2 lg:gap-16"
    >
      <div v-if="topArticles.length" class="min-w-0" :class="{ 'lg:col-span-2': !latestPoll }">
        <h2 class="mb-6 text-3xl font-black tracking-tight text-highlighted sm:text-4xl">
          {{ $t('articles.home.popular') }}
        </h2>
        <ol class="divide-y divide-default border-y border-default">
          <li v-for="(article, index) in topArticles" :key="article.id" class="py-6">
            <NuxtLink
              :to="articlePath(article)"
              class="group grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_1.5rem] items-start gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid-cols-[3rem_minmax(0,1fr)_1.5rem]"
            >
              <span class="text-3xl font-black leading-none tabular-nums text-primary sm:text-4xl" aria-hidden="true">{{
                index + 1
              }}</span>
              <span class="min-w-0 space-y-2">
                <span
                  class="block break-words text-balance text-lg font-bold leading-snug text-highlighted group-hover:text-primary sm:text-xl"
                  >{{ article.title }}</span
                >
                <span v-if="article.excerpt" class="line-clamp-2 text-sm leading-6 text-muted">{{
                  article.excerpt
                }}</span>
                <span class="block text-xs text-muted">{{
                  formatDate(article.publishedAt || article.createdAt, locale)
                }}</span>
              </span>
              <UIcon name="mdi:arrow-up-right" size="20" class="text-primary" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ol>
      </div>
      <div
        v-if="latestPoll"
        class="min-w-0 space-y-5"
        :class="topArticles.length ? 'lg:border-l lg:border-default lg:pl-12' : 'lg:col-span-2'"
      >
        <h2 class="text-3xl font-black tracking-tight text-highlighted sm:text-4xl">
          {{ $t('articles.poll.hpTitle') }}
        </h2>
        <ArticlePoll :poll="latestPoll" :articleId="latestPoll.articleId" />
      </div>
    </section>

    <WidgetSlot name="HOME_BOTTOM" />

    <div v-if="clientSite?.id" class="border-t border-default pt-6">
      <ClientSocials :clientSiteId="clientSite.id" />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'
import type { PollOptionData } from '~~/shared/utils/polls'
import type { ArticleCardData } from '~~/shared/types/article'

import { formatDate } from '~~/shared/utils'
import { formatNumber } from '~~/shared/utils/number'
import { FEED_AD_AFTER, adProviderFor } from '~~/shared/utils/advertising'

definePageMeta({ shell: 'publication' })

type HomeArticle = ArticleCardData & { id: string; slug: string; title: string; createdAt: string }

const { data: auth } = useAuth()
const preview = useWidgetPagePreview()
const localePath = useLocalePath()
const { locale } = useI18n()
const clientSite = await useClientSite()
const { marketingGranted } = useConsent(() => clientSite)
const adsenseSlot = String(useRuntimeConfig().public.adsenseFeedSlot || '')
const feedAd = computed(() =>
  preview.active.value ? null : adProviderFor(clientSite, { marketing: marketingGranted.value, adsenseSlot }),
)
const {
  data: featuredData,
  pending: featuredPending,
  error: featuredError,
  refresh: refreshFeatured,
} = await useFetch(`/api/articles/featured/${clientSite?.name}`, { query: { locale } })

const route = useRoute()
const requestedPage = () => Math.max(1, Number.parseInt(String(route.query.page ?? ''), 10) || 1)
const page = shallowRef(requestedPage())
const selectedTag = shallowRef('')
const searchQuery = shallowRef('')
const appliedFilters = shallowRef({ tag: '', query: '', locale: locale.value })
const filtersWaiting = computed(
  () =>
    selectedTag.value !== appliedFilters.value.tag ||
    searchQuery.value !== appliedFilters.value.query ||
    locale.value !== appliedFilters.value.locale,
)
const feedResults = useTemplateRef<HTMLElement>('feedResults')
const { height: viewportHeight } = useWindowSize()
const feedResultsHeight = shallowRef(384)
useResizeObserver(feedResults, ([entry]) => {
  if (entry)
    feedResultsHeight.value = Math.max(
      feedResultsHeight.value,
      Math.min(entry.contentRect.height, viewportHeight.value),
    )
})
const feedSection = useTemplateRef<HTMLElement>('feedSection')
const recommendedSection = useTemplateRef<HTMLElement>('recommendedSection')
const topicsSection = useTemplateRef<HTMLElement>('topicsSection')
const heroSection = useTemplateRef<HTMLElement>('heroSection')
const showScrollCue = shallowRef(false)
const reducedMotion = usePreferredReducedMotion()
let scrollCueTimer: ReturnType<typeof setTimeout> | null = null

const scheduleScrollCue = () => {
  if (scrollCueTimer) clearTimeout(scrollCueTimer)
  showScrollCue.value = false
  const scroller = heroSection.value?.closest<HTMLElement>('.topiqu-dashboard-scroll')
  if ((scroller?.scrollTop ?? window.scrollY) >= 8) return
  scrollCueTimer = setTimeout(() => {
    showScrollCue.value = (scroller?.scrollTop ?? window.scrollY) < 8
  }, 4000)
}

onMounted(scheduleScrollCue)
useEventListener(
  () => heroSection.value?.closest<HTMLElement>('.topiqu-dashboard-scroll') ?? window,
  'scroll',
  scheduleScrollCue,
  { passive: true },
)
onBeforeUnmount(() => {
  if (scrollCueTimer) clearTimeout(scrollCueTimer)
})

const scrollPastHero = () => {
  const target = recommendedSection.value ?? topicsSection.value ?? feedSection.value
  target?.scrollIntoView({ behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth', block: 'start' })
  showScrollCue.value = false
}
const isBlankSite = computed(() => !featuredError.value && featuredData.value?.totalArticles === 0)
const query = computed(() => ({
  page: page.value,
  limit: 15,
  locale: appliedFilters.value.locale,
  ...(appliedFilters.value.tag ? { tag: appliedFilters.value.tag } : {}),
  ...(appliedFilters.value.query ? { query: appliedFilters.value.query } : {}),
}))
const {
  data: feed,
  pending: feedPending,
  error: feedError,
  refresh: refreshFeed,
} = await useLazyFetch(`/api/articles/by-clientsite/${clientSite?.name}`, {
  query,
  watch: false,
  immediate: !isBlankSite.value && !featuredError.value,
})
const feedBusy = computed(() => feedPending.value || filtersWaiting.value)

const articleMap = ref<Map<string, HomeArticle>>(new Map())
const replaceResults = shallowRef(true)
const hasMore = shallowRef(false)
const latestPoll = shallowRef<{
  type: string
  pollId: string
  question: string
  options: PollOptionData[]
  articleId: string
} | null>(null)

watch(
  feed,
  (result) => {
    if (!result || filtersWaiting.value) return
    if (replaceResults.value) articleMap.value.clear()
    for (const article of result.items ?? []) articleMap.value.set(article.id, article as HomeArticle)
    hasMore.value = Boolean(result.hasMore)
    latestPoll.value = result.latestPoll ? (result.latestPoll as typeof latestPoll.value) : null
  },
  { immediate: true },
)

const resetFeed = useDebounceFn(async () => {
  page.value = 1
  replaceResults.value = true
  appliedFilters.value = { tag: selectedTag.value, query: searchQuery.value, locale: locale.value }
  await refreshFeed()
}, 350)
watch([selectedTag, searchQuery, locale], () => {
  hasMore.value = false
  if (!selectedTag.value && !searchQuery.value) feedResultsHeight.value = 384
  resetFeed()
})
watch(
  () => route.query.page,
  () => {
    page.value = requestedPage()
    replaceResults.value = true
    hasMore.value = true
    refreshFeed()
  },
)
const nextPageTo = computed(() => ({ query: { ...route.query, page: page.value + 1 } }))
watch(featuredData, (result, previous) => {
  if (result?.totalArticles && !previous && !feed.value) refreshFeed()
})

const allArticles = computed(() => Array.from(articleMap.value.values()))
const hasFilters = computed(() => Boolean(selectedTag.value || searchQuery.value))
const leadArticle = computed(() => (featuredData.value?.featured as HomeArticle | null) ?? allArticles.value[0] ?? null)
const latestArticle = computed(
  () =>
    [...allArticles.value].sort(
      (a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime(),
    )[0] ?? null,
)
const primaryCtaTo = computed(() =>
  latestArticle.value
    ? articlePath(latestArticle.value)
    : leadArticle.value
      ? articlePath(leadArticle.value)
      : '#articles',
)
const recommendedArticles = computed(() =>
  ((featuredData.value?.recommended ?? []) as HomeArticle[]).filter((article) => article.id !== leadArticle.value?.id),
)
const highlightedIds = computed(
  () => new Set([leadArticle.value?.id, ...recommendedArticles.value.map((article) => article.id)]),
)
const visibleArticles = computed(() =>
  hasFilters.value ? allArticles.value : allArticles.value.filter((article) => !highlightedIds.value.has(article.id)),
)
const tags = computed(() => feed.value?.tags ?? [])
const hasHeroRail = computed(() => Boolean(tags.value[0] || featuredData.value?.totalArticles))
const topArticles = computed(() => (featuredData.value?.topArticles ?? []) as HomeArticle[])
const leadTags = computed(() =>
  (leadArticle.value?.tags ?? []).flatMap((item) => (item.tag ? [item.tag] : [])).slice(0, 2),
)
const showFeed = computed(
  () => feedBusy.value || hasFilters.value || visibleArticles.value.length > 0 || Boolean(feedError.value),
)
const isOwner = computed(() => {
  const user = auth.value?.user
  return user?.role === 'superadmin' || (user?.role === 'admin' && user.clientSiteId === clientSite?.id)
})

const articlePath = (article: { slug: string; language?: Language }) =>
  localePath({ name: 'clanky-slug', params: { slug: article.slug } }, article.language)

const {
  liked: leadLiked,
  isPending: leadReactionPending,
  toggle: toggleLeadLike,
} = useArticleReaction(
  () => leadArticle.value?.id,
  () => ({
    liked: Boolean(leadArticle.value?.likedByUser),
    likes: leadArticle.value?._count?.reactions ?? 0,
  }),
)
const toast = useToast()
const trackShare = useArticleShare()
const shareLeadArticle = async () => {
  const article = leadArticle.value
  if (!article) return
  const url = new URL(articlePath(article), window.location.origin).href
  try {
    if (navigator.share) await navigator.share({ title: article.title, url })
    else await navigator.clipboard.writeText(url)
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError')
      toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
    return
  }
  await trackShare(article.id, 'OTHER')
}

const selectTopic = async (name: string) => {
  selectedTag.value = selectedTag.value === name ? '' : name
  await nextTick()
  feedSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const resetFilters = () => {
  selectedTag.value = ''
  searchQuery.value = ''
}
const loadMore = async () => {
  if (!hasMore.value || feedBusy.value) return
  replaceResults.value = false
  page.value++
  await refreshFeed()
}

useSeoMeta({
  robots: () =>
    preview.active.value
      ? 'noindex, nofollow'
      : isBlankSite.value ||
          (featuredError.value && !featuredData.value) ||
          (requestedPage() > 1 && !feedPending.value && !feed.value?.items?.length)
        ? 'noindex, follow'
        : 'index, follow',
})
</script>
