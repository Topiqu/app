<template>
  <Modal v-model="open" :title="$t('stats.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div v-if="pending" class="text-center text-gray-500 py-8">
        <div class="animate-pulse flex flex-col items-center gap-4">
          <Icon name="mdi:loading" class="w-8 h-8 text-gray-400 animate-spin" />
          <span>{{ $t('stats.loading') }}</span>
        </div>
      </div>

      <div v-else-if="loadFailed" class="text-center py-8">
        <div class="flex flex-col items-center gap-3">
          <Icon name="mdi:alert-circle-outline" class="w-12 h-12 text-red-500" />
          <p class="text-xl font-medium text-gray-700 dark:text-gray-200">
            {{ $t('common.messages.loadFailedTitle') }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('common.messages.loadFailedText') }}</p>
          <Button icon="mdi:refresh" @click="refetch()">{{ $t('common.messages.retry') }}</Button>
        </div>
      </div>

      <div v-else-if="stats.articleCount === 0" class="text-center py-8">
        <div class="flex flex-col items-center gap-4 text-gray-500">
          <Icon name="mdi:book-off" class="w-12 h-12 text-gray-400" />
          <p class="text-xl font-medium">{{ $t('stats.noArticles.title') }}</p>
          <p class="text-sm">{{ $t('stats.noArticles.description') }}</p>
        </div>
      </div>

      <div v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:eye" class="w-5 h-5 text-blue-600" />
              {{ $t('stats.totalViews.title') }}
            </div>
            <p class="text-2xl font-bold text-blue-600">
              {{ stats.totalViews > 0 ? stats.totalViews.toLocaleString() : $t('stats.totalViews.noViews') }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:file-document" class="w-5 h-5 text-indigo-600" />
              {{ $t('stats.articleCount') }}
            </div>
            <p class="text-2xl font-bold text-indigo-600">{{ stats.articleCount }}</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:clock-check-outline" class="w-5 h-5 text-violet-600" />
              {{ $t('stats.savedTime.title') }}
            </div>
            <p class="text-2xl font-bold text-violet-600">
              {{ formatDuration(stats.savings.minutes) }}
            </p>
            <p v-if="stats.savings.words" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('stats.savings.timeBasis', { words: wordCount, speed: stats.savings.wordsPerHour }) }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:cash-multiple" class="w-5 h-5 text-emerald-600" />
              {{ $t('stats.savedAmount.title') }}
              <span v-tippy="{ content: savingsTooltip, theme: 'light', placement: 'top' }" class="inline-flex">
                <Icon name="mdi:help-circle-outline" class="w-4 h-4 text-gray-400 cursor-help" />
              </span>
            </div>
            <p class="text-2xl font-bold text-emerald-600">
              {{ formatMoney(stats.savings.amountUsd) }}
            </p>
            <p v-if="stats.savings.words" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{
                $t('stats.savings.amountBasis', {
                  time: formatDuration(stats.savings.minutes),
                  rate: formatMoney(stats.savings.hourlyRateUsd),
                })
              }}
            </p>
          </div>

          <div
            v-if="!isBasicPlan"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:share-variant" class="w-5 h-5 text-teal-600" />
              {{ $t('stats.totalShares.title') }}
            </div>
            <p class="text-2xl font-bold text-teal-600">
              {{ stats.totalShares > 0 ? stats.totalShares.toLocaleString() : $t('stats.totalShares.noShares') }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:star" class="w-5 h-5 text-amber-500" />
              {{ $t('stats.topArticle.title') }}
            </div>
            <template v-if="stats.topArticle">
              <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topArticle.title">
                {{ stats.topArticle.title }}
              </p>
              <p class="text-sm text-gray-500">
                {{ stats.topArticle.views.toLocaleString() }} {{ $t('stats.totalViews.title').toLowerCase() }}
              </p>
            </template>
            <p v-else class="text-gray-500 italic">{{ $t('stats.topArticle.noViews') }}</p>
          </div>

          <div
            v-if="!isBasicPlan"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            @click="showTopTags = !showTopTags"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
                <Icon name="mdi:tag" class="w-5 h-5 text-emerald-600" />
                {{ $t('stats.topTag.title') }}
              </div>
              <Icon :name="showTopTags ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="w-5 h-5 text-gray-400" />
            </div>

            <div v-if="!showTopTags && stats.topTags[0]">
              <p class="text-lg font-medium text-gray-900 mt-3">
                {{ stats.topTags[0].name }}
              </p>
              <p class="text-sm text-gray-500">
                {{ stats.topTags[0].views.toLocaleString() }} {{ $t('stats.totalViews.title').toLowerCase() }}
              </p>
            </div>

            <transition name="fade">
              <div v-if="showTopTags && stats.topTags.length" class="mt-4 space-y-3">
                <div
                  v-for="(tag, i) in stats.topTags"
                  :key="tag.name"
                  class="flex justify-between items-center py-2 px-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/50"
                  :class="{ 'ring-2 ring-emerald-500/30': i === 0 }"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-emerald-600">#{{ i + 1 }}</span>
                    <span class="font-medium text-gray-900">{{ tag.name }}</span>
                  </div>
                  <span class="text-sm text-gray-500">
                    {{ tag.views.toLocaleString() }} {{ $t('stats.totalViews.title').toLowerCase() }}
                  </span>
                </div>
              </div>
            </transition>

            <p v-if="!stats.topTags.length" class="mt-3 text-gray-500 italic">
              {{ $t('stats.topTag.noTags') }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:heart" class="w-5 h-5 text-red-500" />
              {{ $t('stats.topLikedArticle.title') }}
            </div>
            <template v-if="stats.topLikedArticle">
              <p class="text-lg font-medium text-gray truncate" :title="stats.topLikedArticle.title">
                {{ stats.topLikedArticle.title }}
              </p>
              <p class="text-sm text-gray-500">
                {{ stats.topLikedArticle.likes }} {{ $t('stats.topLikedArticle.likes') }}
              </p>
            </template>
            <p v-else class="text-gray-500 italic">{{ $t('stats.topLikedArticle.noLikes') }}</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:comment-text" class="w-5 h-5 text-purple-600" />
              {{ $t('stats.topCommentedArticle.title') }}
            </div>
            <template v-if="stats.topCommentedArticle">
              <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topCommentedArticle.title">
                {{ stats.topCommentedArticle.title }}
              </p>
              <p class="text-sm text-gray-500">
                {{ stats.topCommentedArticle.comments }} {{ $t('articles.comments.title').toLowerCase() }}
              </p>
            </template>
            <p v-else class="text-gray-500 italic">{{ $t('stats.topCommentedArticle.noComments') }}</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:account-group" class="w-5 h-5 text-teal-600" />
              {{ $t('stats.followerCount') }}
            </div>
            <p class="text-2xl font-bold text-teal-600">{{ stats.followerCount }}</p>
          </div>

          <div
            v-if="!isBasicPlan"
            v-tippy="{ content: $t('stats.engagementRate.tooltip'), theme: 'light', placement: 'top' }"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:chart-line" class="w-5 h-5 text-pink-600" />
              {{ $t('stats.engagementRate.title') }}
              <Icon name="mdi:help-circle-outline" class="w-4 h-4 text-gray-400 cursor-help" />
            </div>
            <p class="text-2xl font-bold text-pink-600">
              {{ stats.engagementRate ? Math.min(Math.round(stats.engagementRate * 100), 100) + '%' : '0%' }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:account-star" class="w-5 h-5 text-orange-600" />
              {{ $t('stats.topAuthor.title') }}
            </div>
            <template v-if="stats.topAuthor">
              <div class="flex items-center gap-3 mt-2">
                <UserPicture :url="stats.topAuthor.avatarUrl" :name="stats.topAuthor.username" />
                <div>
                  <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topAuthor.username">
                    {{ stats.topAuthor.username }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ stats.topAuthor.articleCount }} {{ $t('stats.articleCount').toLowerCase() }}
                  </p>
                </div>
              </div>
            </template>
            <p v-else class="text-gray-500 italic">{{ $t('stats.topAuthor.noAuthors') }}</p>
          </div>

          <div
            v-if="insight"
            class="col-span-1 sm:col-span-2 p-6 rounded-2xl border shadow-[0_2px_15px_-4px_rgba(0,0,0,0.15)] backdrop-blur-2xl bg-gradient-to-br from-white/70 to-neutral-100/60 dark:from-neutral-900/80 dark:to-neutral-950/70 border-neutral-200/50 dark:border-neutral-800/50 transition-all duration-300"
          >
            <div class="flex items-start gap-4">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10">
                <Icon name="mdi:brain" class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {{ $t('stats.sentiment.title') }}
                </p>
                <p class="text-sm text-neutral-700 dark:text-neutral-300 mt-2 leading-relaxed">
                  {{ insight.summary }}
                </p>

                <div class="flex flex-wrap gap-5 mt-5">
                  <div class="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                    <Icon name="mdi:emoticon-happy-outline" class="w-4 h-4" />
                    <span>{{ insight.topEmotion }}</span>
                  </div>

                  <div class="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                    <Icon name="mdi:fire" class="w-4 h-4" />
                    <span>{{ (insight.toxicity * 100).toFixed(0) }}% toxicity</span>
                  </div>

                  <div class="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <Icon name="mdi:lightbulb-on-outline" class="w-4 h-4" />
                    <span>{{ insight.suggestion }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="isBasicPlan"
            class="col-span-1 sm:col-span-2 p-6 bg-gradient-to-br from-gray-900 to-gray-800/90 backdrop-blur-lg rounded-xl shadow-xl border border-gray-700/30 text-white relative overflow-hidden"
          >
            <div
              class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-60 animate-gradient-x"
            ></div>
            <div class="relative flex flex-col items-center gap-4 text-center">
              <Icon name="mdi:lock" class="w-12 h-12 text-yellow-400 animate-pulse" />
              <h3 class="text-xl font-bold tracking-tight text-gray-200">
                {{ $t('stats.upgradePrompt.title') }}
              </h3>
              <p class="text-sm text-gray-200 max-w-md leading-relaxed">
                {{ $t('stats.upgradePrompt.description') }}
              </p>
              <NuxtLink
                to="/"
                class="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-semibold rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:from-yellow-500 hover:to-orange-600"
              >
                {{ $t('stats.upgradePrompt.button') }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <Charts
          v-if="!pending && stats.articleCount > 0 && !isBasicPlan"
          kind="trend"
          :title="$t('stats.charts.viewsByPublishDay')"
          :label="$t('stats.totalViews.title')"
          :categoryHeading="$t('stats.charts.day')"
          :labels="viewsChart.labels"
          :values="viewsChart.values"
        />
        <Charts
          v-if="!pending && stats.articleCount > 0 && stats.totalShares > 0 && !isBasicPlan"
          kind="breakdown"
          :title="$t('stats.charts.shareDistribution')"
          :label="$t('stats.totalShares.title')"
          :categoryHeading="$t('stats.charts.platform')"
          :labels="shareChart.labels"
          :values="shareChart.values"
          :icons="shareChart.icons"
        />
      </div>
    </template>

    <template #footer="{ close }">
      <Button size="lg" @click="close">
        {{ $t('common.close') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

import { directive as vTippy } from 'vue-tippy'
import { DEFAULT_HOURLY_RATE_USD, DEFAULT_WORDS_PER_HOUR } from '~~/shared/utils/savings'

type DashboardStats = InternalApi['/api/stats/dashboard']['default']
type CommunityInsight = InternalApi['/api/clients/sentiment']['get']

const open = defineModel<boolean>()
const { data: authData } = useAuth()
const { locale, t } = useI18n()
const requestFetch = useRequestFetch()

const clientSite = await useClientSite()
const currency = clientSite?.currency || 'USD'
const fxRate = await useCurrencyRate(currency)

const isBasicPlan = computed(() => authData.value?.user.plan === 'BASIC')
const showTopTags = shallowRef(false)

const {
  data: dashboard,
  isPending: pending,
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
  totalViews: dashboard.value?.totalViews || 0,
  articleCount: dashboard.value?.articleCount || 0,
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
  topArticle: dashboard.value?.topArticle ? { ...dashboard.value.topArticle } : null,
  topTags: dashboard.value?.topTags || [],
  topLikedArticle: dashboard.value?.topLikedArticle
    ? { ...dashboard.value.topLikedArticle, likes: dashboard.value.topLikedArticle.likes || 0 }
    : null,
  topCommentedArticle: dashboard.value?.topCommentedArticle
    ? { ...dashboard.value.topCommentedArticle, comments: dashboard.value.topCommentedArticle.comments || 0 }
    : null,
  followerCount: dashboard.value?.followerCount || 0,
  engagementRate: dashboard.value?.engagementRate || 0,
  topAuthor: dashboard.value?.topAuthor,
}))

const wordCount = computed(() => {
  const count = stats.value.savings.words
  return t('stats.savings.words', { count }, { plural: count })
})

const savingsTooltip = computed(() =>
  $t('stats.savings.tooltip', {
    speed: stats.value.savings.wordsPerHour,
    rate: formatMoney(stats.value.savings.hourlyRateUsd),
  }),
)

const dayLabel = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'numeric' }))

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
  labels: SHARE_PLATFORMS.map((platform) => $t(`stats.platforms.${platform}`)),
  values: SHARE_PLATFORMS.map((platform) => stats.value.sharesDistribution[platform] || 0),
  icons: SHARE_PLATFORMS.map((platform) => PLATFORM_ICONS[platform]),
}))
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
@keyframes gradient-x {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}
.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x 8s ease infinite;
}
</style>
