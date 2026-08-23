<template>
  <UModal v-model:open="open" :title="$t('stats.title')" class="max-w-5xl">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #header="{ close }">
      <div class="flex w-full min-w-0 items-center justify-between gap-3">
        <h2 class="truncate text-lg font-semibold text-highlighted">{{ $t('stats.title') }}</h2>
        <UButton
          icon="i-mdi-close"
          color="neutral"
          variant="ghost"
          square
          :aria-label="$t('common.close')"
          @click="close"
        />
      </div>
    </template>

    <template #body>
      <div v-if="pending" class="space-y-8" :aria-label="$t('stats.loading')" aria-busy="true">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div v-for="i in 3" :key="i" class="space-y-2">
            <div class="h-3 w-16 animate-pulse rounded bg-neutral-900/[0.08] dark:bg-white/10" />
            <div class="h-9 w-24 animate-pulse rounded bg-neutral-900/[0.08] dark:bg-white/10" />
          </div>
        </div>
        <div v-for="section in 3" :key="section" class="space-y-3">
          <div class="h-3 w-28 animate-pulse rounded bg-neutral-900/[0.08] dark:bg-white/10" />
          <div
            v-for="row in 3"
            :key="row"
            class="h-8 animate-pulse rounded bg-neutral-900/[0.05] dark:bg-white/[0.06]"
          />
        </div>
      </div>

      <div v-else-if="loadFailed" class="flex flex-col items-center gap-3 py-12 text-center">
        <Icon name="mdi:alert-circle-outline" class="size-10 text-red-500" />
        <p class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {{ $t('common.messages.loadFailedTitle') }}
        </p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('common.messages.loadFailedText') }}</p>
        <UButton icon="mdi:refresh" @click="refetch()">{{ $t('common.messages.retry') }}</UButton>
      </div>

      <div v-else-if="stats.articleCount === 0" class="flex flex-col items-center gap-3 py-12 text-center">
        <Icon name="mdi:book-off-outline" class="size-10 text-neutral-300 dark:text-neutral-600" />
        <p class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ $t('stats.noArticles.title') }}</p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('stats.noArticles.description') }}</p>
      </div>

      <div v-else class="space-y-10">
        <!-- BASIC sees the offer before the half-empty report, not after scrolling past it. -->
        <div
          v-if="isBasicPlan"
          class="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-800/40"
        >
          <div class="min-w-0">
            <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ $t('stats.upgradePrompt.title') }}
            </p>
            <p class="mt-1 text-sm text-neutral-600 text-pretty dark:text-neutral-400">
              {{ $t('stats.upgradePrompt.description') }}
            </p>
          </div>
          <!-- Closing first, the way TrialEnded/TrialExpired do it — the dialog is not dismissed
               by navigation and would otherwise sit on top of the billing tab it just opened. -->
          <UButton :to="localePath({ name: 'settings', query: { tab: 'billing' } })" @click="open = false">
            {{ $t('stats.upgradePrompt.button') }}
          </UButton>
        </div>

        <!-- The payload: three numbers the whole modal exists to deliver. -->
        <section
          class="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-neutral-200 dark:sm:divide-neutral-800"
        >
          <div class="sm:pr-6">
            <p class="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {{ $t('stats.totalViews.title') }}
            </p>
            <p
              class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-neutral-900 sm:text-4xl dark:text-neutral-50"
            >
              {{ formatCount(stats.totalViews) }}
            </p>
            <p v-if="stats.publishedCount > 0" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('stats.averageViews', { count: formatDecimal(stats.averageViews) }) }}
            </p>
          </div>

          <div class="sm:px-6">
            <p class="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
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
          </div>

          <div class="sm:pl-6">
            <p
              class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            >
              {{ $t('stats.savedAmount.title') }}
              <span v-tippy="{ content: savingsTooltip, theme: 'light', placement: 'top' }" class="inline-flex">
                <Icon name="mdi:help-circle-outline" class="size-3.5 cursor-help" />
              </span>
            </p>
            <p
              class="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-emerald-600 sm:text-4xl dark:text-emerald-400"
            >
              {{ formatMoney(stats.savings.amountUsd) }}
            </p>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('stats.savedTime.basis', { time: formatDuration(stats.savings.minutes), words: wordCount }) }}
            </p>
          </div>
        </section>

        <section>
          <StatsSectionHeading :title="$t('stats.sections.content')" :note="concentrationNote" />
          <div class="mt-3 space-y-1">
            <StatsRow
              v-if="stats.topArticle"
              icon="mdi:trophy-outline"
              :label="stats.topArticle.title"
              :value="plural('stats.viewsUnit', stats.topArticle.views)"
              :to="localePath({ name: 'clanky-slug', params: { slug: stats.topArticle.slug } })"
            />
            <StatsRow
              v-if="stats.topLikedArticle"
              icon="mdi:heart-outline"
              :label="stats.topLikedArticle.title"
              :value="plural('stats.topLikedArticle.likes', stats.topLikedArticle.likes)"
              :to="localePath({ name: 'clanky-slug', params: { slug: stats.topLikedArticle.slug } })"
            />
            <StatsRow
              v-if="stats.topCommentedArticle"
              icon="mdi:comment-outline"
              :label="stats.topCommentedArticle.title"
              :value="plural('articles.comments.unit', stats.topCommentedArticle.comments)"
              :to="localePath({ name: 'clanky-slug', params: { slug: stats.topCommentedArticle.slug } })"
            />
            <p v-if="!hasContentHighlights" class="py-2 text-sm text-neutral-500 dark:text-neutral-400">
              {{ $t('stats.topArticle.noViews') }}
            </p>
          </div>
        </section>

        <section v-if="!isBasicPlan">
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

        <section>
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
                <Icon name="mdi:help-circle-outline" class="size-3.5" />
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
                {{ $t('stats.topAuthor.title') }} · {{ plural('stats.articlesWritten', stats.topAuthor.articleCount) }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="aiShare !== null">
          <StatsSectionHeading :title="$t('stats.sections.authorship')" />
          <!-- The savings figure above only counts FULL articles; this is why it is what it is. -->
          <div class="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-900/[0.06] dark:bg-white/10">
            <span class="bg-emerald-500/80" :style="{ width: `${aiShare.full * 100}%` }" />
            <span class="bg-emerald-500/35" :style="{ width: `${aiShare.assist * 100}%` }" />
          </div>
          <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <div v-for="entry in aiShare.legend" :key="entry.key" class="flex items-center gap-1.5">
              <span class="size-2 shrink-0 rounded-full" :class="entry.dot" />
              <dt class="text-neutral-500 dark:text-neutral-400">{{ $t(`stats.aiInvolvement.${entry.key}`) }}</dt>
              <dd class="font-medium tabular-nums text-neutral-900 dark:text-neutral-100">{{ entry.count }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="insight">
          <StatsSectionHeading :title="$t('stats.sentiment.title')" />
          <div
            class="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40"
          >
            <p class="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{{ insight.summary }}</p>
            <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <span class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                <Icon name="mdi:emoticon-happy-outline" class="size-4 shrink-0 text-neutral-400" />
                {{ insight.topEmotion }}
              </span>
              <span class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                <Icon name="mdi:fire" class="size-4 shrink-0 text-neutral-400" />
                {{ $t('stats.sentiment.toxicity', { value: formatPercent(insight.toxicity) }) }}
              </span>
              <span class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
                <Icon name="mdi:lightbulb-on-outline" class="size-4 shrink-0 text-neutral-400" />
                {{ insight.suggestion }}
              </span>
            </div>
          </div>
        </section>

        <section v-if="!isBasicPlan">
          <LazyCharts
            kind="trend"
            :title="$t('stats.charts.viewsByDay', { days: viewsChart.labels.length })"
            :label="$t('stats.totalViews.title')"
            :categoryHeading="$t('stats.charts.day')"
            :labels="viewsChart.labels"
            :values="viewsChart.values"
          />
          <p v-if="stats.trackingSince" class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {{ $t('stats.charts.trackingSince', { date: formatDate(stats.trackingSince) }) }}
          </p>
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
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full items-center justify-between gap-4">
        <p v-if="stats.generatedAt" class="text-xs text-neutral-400 dark:text-neutral-500">
          {{ $t('stats.updatedAt') }} <NuxtTime :datetime="stats.generatedAt" timeStyle="short" :locale />
        </p>
        <div class="ml-auto flex items-center gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="mdi:refresh"
            :loading="isRefreshing"
            :aria="$t('common.messages.retry')"
            @click="refetch()"
          />
          <UButton size="lg" @click="close">{{ $t('common.close') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

import { directive as vTippy } from 'vue-tippy'
import { DEFAULT_HOURLY_RATE_USD, DEFAULT_WORDS_PER_HOUR } from '~~/shared/utils/savings'

type DashboardStats = InternalApi['/api/stats/dashboard']['default']
type CommunityInsight = InternalApi['/api/clients/sentiment']['get']

// The trend window is whatever the endpoint sent — the chart title reads it off the series
// rather than restating the server's constant and drifting from it.
const COLLAPSED_TAGS = 3

const open = defineModel<boolean>()
const { data: authData } = useAuth()
const { locale, t } = useI18n()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const clientSite = await useClientSite()
const currency = clientSite?.currency || 'USD'
const fxRate = await useCurrencyRate(currency)

const isBasicPlan = computed(() => authData.value?.user.plan === 'BASIC')
const showAllTags = shallowRef(false)

const {
  data: dashboard,
  isPending: pending,
  isLoading: isRefreshing,
  error,
  refetch,
} = useQuery({
  key: () => queryKeys.stats.dashboard,
  query: () => requestFetch<DashboardStats>('/api/stats/dashboard'),
  enabled: () => !!open.value,
})

const loadFailed = computed(() => !!error.value && !dashboard.value)

const { data: rawInsight } = useQuery({
  key: () => queryKeys.stats.sentiment,
  query: () => requestFetch<CommunityInsight>('/api/clients/sentiment'),
  enabled: () => !!open.value && !isBasicPlan.value,
})

// `toLocaleString()` with no argument follows the browser locale, not the app's — a Czech UI on a
// US machine printed 1,234 next to "zobrazení".
const countFormat = computed(() => new Intl.NumberFormat(locale.value))
const decimalFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const percentFormat = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }),
)
const dateFormat = computed(
  () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', year: 'numeric' }),
)
const dayLabel = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'numeric' }))

const formatCount = (value: number) => countFormat.value.format(value)

// Czech picks between four forms (`shared/utils/plural.ts`), so a unit label cannot be a fixed
// noun glued onto a number — "4 článků" is wrong where "4 články" is right. The raw count selects
// the form; the interpolated one is locale-formatted.
const plural = (key: string, count: number) => t(key, { count: formatCount(count) }, { plural: count })
const formatDecimal = (value: number) => decimalFormat.value.format(value)
const formatPercent = (value: number) => percentFormat.value.format(value)
const formatDate = (iso: string) => dateFormat.value.format(new Date(`${iso}T00:00:00Z`))

const formatDuration = (totalMinutes: number) => {
  if (!totalMinutes) return '0m'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

// Savings arrive in USD (the platform's money base) and are converted for display, the same
// way Billing.vue and AI.vue do it.
const formatMoney = (usd: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(usd * fxRate)

const insight = computed(() => {
  if (!rawInsight.value) return null
  return typeof rawInsight.value === 'string' ? JSON.parse(rawInsight.value) : rawInsight.value
})

const stats = computed(() => ({
  generatedAt: dashboard.value?.generatedAt ?? null,
  totalViews: dashboard.value?.totalViews || 0,
  averageViews: dashboard.value?.averageViews || 0,
  topThreeShare: dashboard.value?.topThreeShare || 0,
  articleCount: dashboard.value?.articleCount || 0,
  publishedCount: dashboard.value?.publishedCount || 0,
  draftCount: dashboard.value?.draftCount || 0,
  aiInvolvement: dashboard.value?.aiInvolvement ?? { NONE: 0, ASSIST: 0, FULL: 0 },
  savings: dashboard.value?.savings ?? {
    words: 0,
    minutes: 0,
    amountUsd: 0,
    hourlyRateUsd: DEFAULT_HOURLY_RATE_USD,
    wordsPerHour: DEFAULT_WORDS_PER_HOUR,
  },
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
      { key: 'FULL', count: FULL, dot: 'bg-emerald-500/80' },
      { key: 'ASSIST', count: ASSIST, dot: 'bg-emerald-500/35' },
      { key: 'NONE', count: NONE, dot: 'bg-neutral-900/[0.15] dark:bg-white/20' },
    ],
  }
})

const wordCount = computed(() => {
  const count = stats.value.savings.words
  return plural('stats.savings.words', count)
})

const savingsTooltip = computed(() =>
  t('stats.savings.tooltip', {
    speed: stats.value.savings.wordsPerHour,
    rate: formatMoney(stats.value.savings.hourlyRateUsd),
  }),
)

const viewsChart = computed(() => {
  const history = dashboard.value?.viewsHistory ?? []

  return {
    labels: history.map((v) => dayLabel.value.format(new Date(`${v.date}T00:00:00Z`))),
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
