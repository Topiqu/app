<template>
  <div class="space-y-6">
    <header class="flex w-full min-w-0 items-center justify-between gap-3">
      <h1 class="truncate text-2xl font-bold tracking-tight text-highlighted">{{ $t('stats.title') }}</h1>
      <div class="flex items-center gap-2">
        <USelect
          v-model="range"
          :items="rangeItems"
          valueKey="value"
          labelKey="label"
          :aria-label="$t('stats.range.label')"
          class="w-28 sm:w-36"
          size="sm"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="mdi:refresh"
          :loading="isRefreshing"
          :aria-label="$t('common.messages.retry')"
          @click="refetch()"
        />
      </div>
    </header>

    <section>
      <div v-if="pending" class="space-y-8" :aria-label="$t('stats.loading')" aria-busy="true">
        <div
          class="grid grid-cols-1 gap-6 rounded-(--topiqu-surface-radius) border border-default p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div v-for="i in 4" :key="i" class="space-y-3">
            <USkeleton class="h-3 w-16" />
            <USkeleton class="h-9 w-24 max-w-full" />
            <USkeleton class="h-3 w-20 max-w-full" />
          </div>
        </div>
        <div class="grid gap-x-10 gap-y-7 lg:grid-cols-2">
          <div v-for="section in 4" :key="section" class="space-y-3">
            <USkeleton class="h-4 w-28" />
            <div v-for="row in 3" :key="row" class="flex gap-3 py-2">
              <USkeleton class="size-8 shrink-0" />
              <USkeleton class="h-8 flex-1" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="loadFailed" class="flex flex-col items-center gap-3 py-12 text-center">
        <UIcon name="mdi:alert-circle-outline" class="size-10 text-red-500" />
        <p class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {{ $t('common.messages.loadFailedTitle') }}
        </p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('common.messages.loadFailedText') }}</p>
        <UButton icon="mdi:refresh" color="neutral" variant="outline" @click="refetch()">{{
          $t('common.messages.retry')
        }}</UButton>
      </div>

      <div
        v-else-if="stats.articleCount === 0 && stats.value.generatedWords === 0"
        class="flex flex-col items-center gap-3 py-12 text-center"
      >
        <UIcon name="mdi:book-off-outline" class="size-10 text-neutral-300 dark:text-neutral-600" />
        <p class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ $t('stats.noArticles.title') }}</p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('stats.noArticles.description') }}</p>
      </div>

      <div v-else class="grid min-w-0 grid-cols-1 gap-x-10 gap-y-7 lg:grid-cols-2 lg:items-start">
        <!-- BASIC sees the offer before the half-empty report, not after scrolling past it. -->
        <div
          v-if="isBasicPlan"
          class="flex flex-col gap-3 rounded-(--topiqu-surface-radius) border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-800/40 lg:col-span-2"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ $t('stats.upgradePrompt.title') }}
            </p>
            <p class="mt-1 text-sm text-neutral-600 text-pretty dark:text-neutral-400">
              {{ $t('stats.upgradePrompt.description') }}
            </p>
          </div>
          <UButton :to="localePath({ name: 'settings', query: { tab: 'billing' } })">
            {{ $t('stats.upgradePrompt.button') }}
          </UButton>
        </div>

        <!-- Performance and completed work share one concise summary. -->
        <section
          class="grid min-w-0 grid-cols-1 gap-x-6 gap-y-6 rounded-[var(--topiqu-surface-radius)] border border-default bg-elevated/40 p-5 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-muted">
              {{ $t('stats.totalViews.title') }}
            </p>
            <p
              class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-neutral-900 sm:text-4xl dark:text-neutral-50"
            >
              {{ formatCount(stats.totalViews) }}
            </p>
            <p v-if="stats.totalViews > 0" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('stats.averageViews', { count: formatDecimal(stats.averageViews) }) }}
            </p>
          </div>

          <div class="min-w-0">
            <p class="text-sm font-medium text-muted">
              {{ $t('stats.articleCount') }}
            </p>
            <p
              class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-neutral-900 sm:text-4xl dark:text-neutral-50"
            >
              {{ formatCount(stats.publishedCount) }}
            </p>
            <p v-if="stats.draftCount > 0" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ plural('stats.draftCount', stats.draftCount) }}
            </p>
            <p
              v-if="stats.publishedCoverage.partialHistory && range === '30d'"
              class="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{
                stats.publishedCoverage.trackedSince
                  ? $t('stats.coverage.partial', { date: formatDate(stats.publishedCoverage.trackedSince) })
                  : $t('stats.coverage.unavailable')
              }}
            </p>
          </div>

          <div class="min-w-0">
            <div class="flex items-start gap-1.5 text-sm font-medium text-muted">
              <p class="min-w-0">{{ $t('stats.savedAmount.title') }}</p>
              <UPopover :content="{ align: 'end' }" :ui="{ content: 'w-80 max-w-[calc(100vw-2rem)]' }">
                <UButton
                  icon="mdi:help-circle-outline"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  :aria-label="$t('stats.savedAmount.method')"
                  :ui="{ base: '-my-0.5 size-6 shrink-0 p-0', leadingIcon: 'size-4' }"
                />
                <template #content>
                  <p class="whitespace-normal break-words p-4 text-sm font-normal leading-6 text-default">
                    {{ savingsTooltip }}
                  </p>
                </template>
              </UPopover>
            </div>
            <p class="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums text-primary sm:text-4xl">
              {{ headlineValue ? `~${formatMoney(headlineValue.estimatedAmountUsd)}` : '—' }}
            </p>
            <p v-if="usingLegacyEstimate" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{
                $t('stats.value.legacyEstimate', {
                  articles: plural('stats.value.legacyArticleCount', stats.value.legacyEstimate.articleCount),
                })
              }}
            </p>
            <p v-else-if="!headlineValue" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{
                range === '30d' && stats.value.legacyEstimate.generatedWords > 0
                  ? $t('stats.value.seeAllTime')
                  : $t('stats.value.noCompletedWriting')
              }}
            </p>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-muted">
              {{ $t('stats.savedTime.title') }}
            </p>
            <p class="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums text-highlighted sm:text-4xl">
              {{
                headlineValue
                  ? `~${headlineValue.estimatedMinutes > 0 ? formatDuration(headlineValue.estimatedMinutes) : $t('stats.duration.lessThanMinute')}`
                  : '—'
              }}
            </p>
            <p v-if="headlineValue" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{
                $t(usingLegacyEstimate ? 'stats.value.legacyWordCount' : 'stats.value.wordsCreated', {
                  count: formatCount(headlineValue.generatedWords),
                })
              }}
            </p>
            <p v-else-if="stats.value.partialHistory" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{
                stats.value.trackedSince
                  ? $t('stats.coverage.partial', { date: formatDate(stats.value.trackedSince) })
                  : $t('stats.coverage.unavailable')
              }}
            </p>
          </div>
        </section>

        <div class="grid min-w-0 grid-cols-1 gap-7 lg:col-span-2 lg:grid-cols-2 [&>section]:h-full [&>section]:min-w-0">
          <section class="flex flex-col rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5">
            <StatsSectionHeading :title="$t('stats.sections.content')" :note="concentrationNote" />
            <div class="mt-3 flex flex-1 flex-col justify-evenly gap-1">
              <StatsRow
                v-if="stats.topArticle"
                icon="mdi:trophy-outline"
                :label="stats.topArticle.title"
                :value="plural('stats.viewsUnit', stats.topArticle.views)"
                :to="
                  localePath(
                    { name: 'clanky-slug', params: { slug: stats.topArticle.slug } },
                    stats.topArticle.language,
                  )
                "
              />
              <StatsRow
                v-if="stats.topLikedArticle"
                icon="mdi:heart-outline"
                :label="stats.topLikedArticle.title"
                :value="plural('stats.topLikedArticle.likes', stats.topLikedArticle.likes)"
                :to="
                  localePath(
                    { name: 'clanky-slug', params: { slug: stats.topLikedArticle.slug } },
                    stats.topLikedArticle.language,
                  )
                "
              />
              <StatsRow
                v-if="stats.topCommentedArticle"
                icon="mdi:comment-outline"
                :label="stats.topCommentedArticle.title"
                :value="plural('articles.comments.unit', stats.topCommentedArticle.comments)"
                :to="
                  localePath(
                    { name: 'clanky-slug', params: { slug: stats.topCommentedArticle.slug } },
                    stats.topCommentedArticle.language,
                  )
                "
              />
              <p v-if="!hasContentHighlights" class="py-2 text-sm text-neutral-500 dark:text-neutral-400">
                {{ $t('stats.topArticle.noViews') }}
              </p>
            </div>
          </section>

          <section
            v-if="!isBasicPlan"
            class="rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5"
          >
            <StatsSectionHeading :title="$t('stats.topTag.title')">
              <template v-if="stats.topTags.length > COLLAPSED_TAGS" #action>
                <UButton
                  type="button"
                  color="primary"
                  variant="ghost"
                  size="xs"
                  :aria-expanded="showAllTags"
                  aria-controls="stats-top-tags"
                  @click="showAllTags = !showAllTags"
                >
                  {{ showAllTags ? $t('common.actions.showLess') : $t('stats.topTag.showAll') }}
                </UButton>
              </template>
            </StatsSectionHeading>

            <div v-if="stats.topTags.length" id="stats-top-tags" class="mt-3 space-y-1">
              <StatsRow
                v-for="(tag, i) in visibleTags"
                :key="tag.name"
                :rank="i + 1"
                :label="tag.name"
                :bar="topTagViews ? tag.views / topTagViews : 0"
                :value="plural('stats.viewsUnit', tag.views)"
              />
            </div>
            <p v-else class="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{{ $t('stats.topTag.noTags') }}</p>
          </section>

          <section class="rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5">
            <StatsSectionHeading :title="$t('stats.sections.audience')" />
            <div class="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('stats.followerCount') }}</p>
                <p class="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {{ formatCount(stats.followerCount) }}
                </p>
              </div>
              <div v-if="!isBasicPlan">
                <p
                  v-tippy="{ content: $t('stats.engagementRate.tooltip'), theme: 'light', placement: 'top' }"
                  class="inline-flex cursor-help items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {{ $t('stats.engagementRate.title') }}
                  <UIcon name="mdi:help-circle-outline" class="size-3.5" />
                </p>
                <p class="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {{ formatPercent(stats.engagementRate) }}
                </p>
              </div>
              <div v-if="!isBasicPlan">
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ $t('stats.totalShares.title') }}</p>
                <p class="mt-0.5 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {{ formatCount(stats.totalShares) }}
                </p>
              </div>
            </div>

            <div
              v-if="stats.topAuthor"
              class="mt-4 flex items-center gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800"
            >
              <UserPicture :url="stats.topAuthor.avatarUrl" :name="stats.topAuthor.username" />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {{ stats.topAuthor.username }}
                </p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ $t('stats.topAuthor.title') }} ·
                  {{ plural('stats.articlesWritten', stats.topAuthor.articleCount) }}
                </p>
              </div>
            </div>
          </section>

          <section
            v-if="aiShare !== null"
            class="flex flex-col rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5"
          >
            <StatsSectionHeading :title="$t('stats.sections.authorship')" />
            <p class="mt-2 text-xs text-muted">{{ $t('stats.aiInvolvement.inventoryNote') }}</p>
            <!-- Current article classification includes drafts; legacy words are deliberately not added to documented work. -->
            <div class="mt-3 lg:flex lg:flex-1 lg:flex-col lg:justify-center">
              <div class="flex h-2 overflow-hidden rounded-full bg-neutral-900/[0.06] dark:bg-white/10">
                <span class="bg-inverted/80" :style="{ width: `${aiShare.full * 100}%` }" />
                <span class="bg-inverted/35" :style="{ width: `${aiShare.assist * 100}%` }" />
              </div>
              <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div
                  v-for="entry in aiShare.legend"
                  :key="entry.key"
                  class="flex items-center gap-1.5 lg:flex-col lg:items-start lg:rounded-[var(--ui-radius)] lg:bg-elevated lg:p-3"
                >
                  <dt class="flex min-w-0 items-center gap-1.5 text-toned lg:flex-col lg:items-start">
                    <UIcon :name="entry.icon" class="hidden size-5 text-primary lg:block" />
                    <span class="size-2 shrink-0 rounded-full lg:hidden" :class="entry.dot" aria-hidden="true" />
                    <span class="truncate">
                      {{ $t(`stats.aiInvolvement.${entry.key}`) }}
                    </span>
                  </dt>
                  <dd class="font-semibold tabular-nums text-neutral-900 lg:text-lg dark:text-neutral-100">
                    {{ entry.count }}
                  </dd>
                </div>
              </dl>
              <div
                v-if="stats.value.legacyEstimate.articleCount > 0"
                class="mt-4 border-t border-default pt-3 text-xs text-muted"
              >
                {{
                  $t('stats.value.legacyWords', {
                    articles: plural('stats.value.legacyArticleCount', stats.value.legacyEstimate.articleCount),
                    words: formatCount(stats.value.legacyEstimate.generatedWords),
                  })
                }}
              </div>
            </div>
          </section>

          <section
            v-if="insight"
            class="rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5 lg:col-span-2"
          >
            <StatsSectionHeading :title="$t('stats.sentiment.title')" :note="$t('stats.sentiment.current')" />
            <div
              class="mt-3 rounded-(--topiqu-surface-radius) border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
            >
              <p class="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{{ insight.summary }}</p>
              <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span v-if="topEmotion" class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                  <UIcon name="mdi:emoticon-happy-outline" class="size-4 shrink-0 text-neutral-400" />
                  {{ topEmotion }}
                </span>
                <span class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                  <UIcon name="mdi:fire" class="size-4 shrink-0 text-neutral-400" />
                  {{ $t('stats.sentiment.toxicity', { value: formatPercent(insight.toxicity) }) }}
                </span>
                <span class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                  <UIcon name="mdi:lightbulb-on-outline" class="size-4 shrink-0 text-neutral-400" />
                  {{ insight.suggestion }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section v-if="!isBasicPlan" class="grid min-w-0 grid-cols-1 items-start gap-6 lg:col-span-2 lg:grid-cols-2">
          <div class="min-w-0">
            <LazyCharts
              kind="trend"
              :title="
                range === 'all'
                  ? $t('stats.charts.viewsByMonth')
                  : $t('stats.charts.viewsByDay', { days: viewsChart.labels.length })
              "
              :label="$t('stats.totalViews.title')"
              :categoryHeading="range === 'all' ? $t('stats.charts.month') : $t('stats.charts.day')"
              :labels="viewsChart.labels"
              :values="viewsChart.values"
            />
          </div>
          <LazyCharts
            v-if="stats.totalShares > 0"
            kind="breakdown"
            :title="$t('stats.charts.shareDistribution')"
            :label="$t('stats.totalShares.title')"
            :categoryHeading="$t('stats.charts.platform')"
            :labels="shareChart.labels"
            :values="shareChart.values"
            :icons="shareChart.icons"
          />
        </section>
        <p
          v-if="!isBasicPlan && stats.trackingSince"
          class="-mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400 lg:col-span-2"
        >
          {{ $t('stats.charts.trackingSince', { date: formatDate(stats.trackingSince) }) }}
        </p>
      </div>
    </section>

    <p v-if="stats.generatedAt" class="text-xs text-toned">
      {{ $t('stats.updatedAt') }} <NuxtTime :datetime="stats.generatedAt" timeStyle="short" :locale />
    </p>
  </div>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

import { directive as vTippy } from 'vue-tippy'

type DashboardStats = InternalApi['/api/stats/dashboard']['default']
type CommunityInsight = InternalApi['/api/clients/sentiment']['get']

// The trend window is whatever the endpoint sent — the chart title reads it off the series
// rather than restating the server's constant and drifting from it.
const COLLAPSED_TAGS = 3

const { data: authData } = useAuth()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const clientSite = await useClientSite()
const currency = clientSite?.currency || 'USD'
const fxRate = useCurrencyRate(currency)

const isBasicPlan = computed(() => authData.value?.user.plan === 'BASIC')
const showAllTags = shallowRef(false)
const range = shallowRef<'30d' | 'all'>('all')
const rangeItems = computed(() => [
  { value: '30d', label: t('stats.range.last30Days') },
  { value: 'all', label: t('stats.range.allTime') },
])

const {
  data: dashboard,
  isPending: pending,
  isLoading: isRefreshing,
  error,
  refetch,
} = useQuery({
  key: () => [...queryKeys.stats.dashboard, range.value],
  query: () => requestFetch<DashboardStats>('/api/stats/dashboard', { query: { range: range.value } }),
})

const loadFailed = computed(() => !!error.value && !dashboard.value)

const { data: rawInsight } = useQuery({
  key: () => queryKeys.stats.sentiment,
  query: () => requestFetch<CommunityInsight>('/api/clients/sentiment'),
  enabled: () => !isBasicPlan.value,
})

// `toLocaleString()` with no argument follows the browser locale, not the app's — a Czech UI on a
// US machine printed 1,234 next to "zobrazení".
const countFormat = computed(() => new Intl.NumberFormat(locale.value))
const decimalFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const percentFormat = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      style: 'percent',
      maximumFractionDigits: 1,
    }),
)
const dateFormat = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
)
const dayLabel = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'numeric' }))
const monthLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric' }))

const formatCount = (value: number) => countFormat.value.format(value)

// Czech picks between four forms (`shared/utils/plural.ts`), so a unit label cannot be a fixed
// noun glued onto a number — "4 článků" is wrong where "4 články" is right. The raw count selects
// the form; the interpolated one is locale-formatted.
const plural = (key: string, count: number) => t(key, { count: formatCount(count) }, { plural: count })
const formatDecimal = (value: number) => decimalFormat.value.format(value)
const formatPercent = (value: number) => percentFormat.value.format(value)
const formatDate = (iso: string) => dateFormat.value.format(new Date(`${iso}T00:00:00Z`))

const formatDuration = (totalMinutes: number) => {
  const compact = (unit: 'days' | 'hours' | 'minutes', count: number) =>
    t(`stats.duration.compact.${unit}`, { count: formatCount(count) })
  if (!totalMinutes) return compact('minutes', 0)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (days > 0) {
    const remainingHours = hours % 24
    return [compact('days', days), remainingHours ? compact('hours', remainingHours) : ''].filter(Boolean).join(' ')
  }
  if (hours === 0) return compact('minutes', minutes)
  return [compact('hours', hours), minutes ? compact('minutes', minutes) : ''].filter(Boolean).join(' ')
}

// Savings arrive in USD (the platform's money base) and are converted for display, the same
// way Billing.vue and AI.vue do it.
const formatMoney = (usd: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(usd * fxRate.value)

const insight = computed(() => {
  if (!rawInsight.value) return null
  return typeof rawInsight.value === 'string' ? JSON.parse(rawInsight.value) : rawInsight.value
})
const topEmotion = computed(() => {
  const emotion = communityEmotion(insight.value?.topEmotion)
  return emotion ? t(`stats.sentiment.emotions.${emotion}`) : null
})

const stats = computed(() => ({
  generatedAt: dashboard.value?.generatedAt ?? null,
  totalViews: dashboard.value?.totalViews || 0,
  averageViews: dashboard.value?.averageViews || 0,
  topThreeShare: dashboard.value?.topThreeShare || 0,
  articleCount: dashboard.value?.articleCount || 0,
  publishedCount: dashboard.value?.publishedCount || 0,
  draftCount: dashboard.value?.draftCount || 0,
  aiInvolvement: dashboard.value?.aiInvolvement ?? {
    NONE: 0,
    ASSIST: 0,
    FULL: 0,
  },
  savings: dashboard.value?.savings ?? {
    words: 0,
    minutes: 0,
    amountUsd: 0,
    hourlyRateUsd: DEFAULT_HOURLY_RATE_USD,
    wordsPerHour: DEFAULT_WORDS_PER_HOUR,
  },
  value: dashboard.value?.value ?? {
    generatedWords: 0,
    estimatedMinutes: 0,
    estimatedAmountUsd: 0,
    hourlyRateUsd: DEFAULT_HOURLY_RATE_USD,
    wordsPerHour: DEFAULT_WORDS_PER_HOUR,
    breakdown: [],
    legacyEstimate: {
      generatedWords: 0,
      estimatedMinutes: 0,
      estimatedAmountUsd: 0,
      hourlyRateUsd: DEFAULT_HOURLY_RATE_USD,
      wordsPerHour: DEFAULT_WORDS_PER_HOUR,
      breakdown: [],
      articleCount: 0,
    },
    trackedSince: null,
    partialHistory: false,
    activityCoverage: { writing: null },
  },
  publishedCoverage: dashboard.value?.publishedCoverage ?? { trackedSince: null, partialHistory: false },
  totalShares: dashboard.value?.totalShares || 0,
  sharesDistribution: dashboard.value?.sharesDistribution || {
    TWITTER: 0,
    LINKEDIN: 0,
    FACEBOOK: 0,
    EMAIL: 0,
    OTHER: 0,
  },
  topArticle: dashboard.value?.topArticle ?? null,
  topTags: dashboard.value?.topTags || [],
  topLikedArticle: dashboard.value?.topLikedArticle ?? null,
  topCommentedArticle: dashboard.value?.topCommentedArticle ?? null,
  followerCount: dashboard.value?.followerCount || 0,
  engagementRate: dashboard.value?.engagementRate || 0,
  topAuthor: dashboard.value?.topAuthor ?? null,
  trackingSince: dashboard.value?.trackingSince ?? null,
}))

// A historical article total is only a fallback, never added to receipt-backed work.
const writingEstimate = computed(() =>
  selectWritingEstimate(stats.value.value, stats.value.value.legacyEstimate, range.value === 'all'),
)
const usingLegacyEstimate = computed(() => writingEstimate.value.basis === 'legacy')
const headlineValue = computed(() => writingEstimate.value.value)

const hasContentHighlights = computed(
  () => !!(stats.value.topArticle || stats.value.topLikedArticle || stats.value.topCommentedArticle),
)

const concentrationNote = computed(() => {
  const share = stats.value.topThreeShare
  if (!share || stats.value.publishedCount < 4) return undefined
  return t('stats.concentration', { share: formatPercent(share) })
})

const visibleTags = computed(() =>
  showAllTags.value ? stats.value.topTags : stats.value.topTags.slice(0, COLLAPSED_TAGS),
)

const topTagViews = computed(() => stats.value.topTags[0]?.views ?? 0)

const aiShare = computed(() => {
  const { FULL, ASSIST, NONE } = stats.value.aiInvolvement
  const total = FULL + ASSIST + NONE
  if (!total) return null

  return {
    full: FULL / total,
    assist: ASSIST / total,
    legend: [
      { key: 'FULL', count: FULL, dot: 'bg-inverted/80', icon: 'mdi:robot-outline' },
      { key: 'ASSIST', count: ASSIST, dot: 'bg-inverted/35', icon: 'mdi:account-edit-outline' },
      {
        key: 'NONE',
        count: NONE,
        dot: 'bg-neutral-900/[0.15] dark:bg-white/20',
        icon: 'mdi:pencil-outline',
      },
    ],
  }
})

const savingsTooltip = computed(() =>
  t(usingLegacyEstimate.value ? 'stats.savedAmount.legacyTooltip' : 'stats.savedTime.tooltip', {
    speed: formatCount(stats.value.value.wordsPerHour),
    rate: formatMoney(stats.value.value.hourlyRateUsd),
  }),
)

const viewsChart = computed(() => {
  const history = dashboard.value?.viewsHistory ?? []

  return {
    labels: history.map((v) =>
      (range.value === 'all' ? monthLabel.value : dayLabel.value).format(new Date(`${v.date}T00:00:00Z`)),
    ),
    values: history.map((v) => v.views),
  }
})

// Every platform, always, in this order — a platform must keep its colour even in a week
// nobody used it. The previous version omitted EMAIL from the data while keeping its label,
// so every slice from Email onwards showed another platform's count.
const SHARE_PLATFORMS = ['TWITTER', 'LINKEDIN', 'FACEBOOK', 'EMAIL', 'OTHER'] as const

const PLATFORM_ICONS: Record<(typeof SHARE_PLATFORMS)[number], string> = {
  TWITTER: 'mdi:alpha-x-circle',
  LINKEDIN: 'mdi:linkedin',
  FACEBOOK: 'mdi:facebook',
  EMAIL: 'mdi:email-outline',
  OTHER: 'mdi:link-variant',
}

const shareChart = computed(() => ({
  labels: SHARE_PLATFORMS.map((platform) => t(`stats.platforms.${platform}`)),
  values: SHARE_PLATFORMS.map((platform) => stats.value.sharesDistribution[platform] || 0),
  icons: SHARE_PLATFORMS.map((platform) => PLATFORM_ICONS[platform]),
}))
</script>
