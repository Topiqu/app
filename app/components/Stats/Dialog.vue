<template>
  <UModal v-model:open="open" :title="$t('stats.title')" :ui="{ content: 'max-w-5xl' }">
    <template #body>
      <UCard v-if="pending"><USkeleton class="h-32 w-full" /></UCard>

      <UAlert
        v-else-if="loadFailed"
        color="error"
        icon="i-mdi-alert-circle-outline"
        :title="$t('common.messages.loadFailedTitle')"
        :description="$t('common.messages.loadFailedText')"
      >
        <template #actions>
          <UButton icon="i-mdi-refresh" @click="refetch()">{{ $t('common.messages.retry') }}</UButton>
        </template>
      </UAlert>

      <UEmpty
        v-else-if="stats.articleCount === 0"
        icon="i-mdi-book-off"
        :title="$t('stats.noArticles.title')"
        :description="$t('stats.noArticles.description')"
      />

      <div v-else class="space-y-6">
        <section
          class="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
          :aria-label="$t('stats.title')"
        >
          <div class="rounded-[var(--topiqu-surface-radius)] bg-primary p-5 text-inverted lg:row-span-2">
            <div class="flex items-center gap-2 text-sm font-semibold opacity-80">
              <UIcon name="i-mdi-eye" size="20" />{{ $t('stats.totalViews.title') }}
            </div>
            <p class="mt-5 text-5xl font-black tabular-nums">{{ stats.totalViews.toLocaleString() }}</p>
          </div>
          <div
            v-for="item in primaryKpis"
            :key="item.label"
            class="rounded-[var(--topiqu-surface-radius)] border border-default p-4"
          >
            <div class="flex items-center gap-2 text-xs font-semibold text-muted">
              <UIcon :name="item.icon" size="18" />{{ item.label }}
            </div>
            <p class="mt-2 text-2xl font-bold tabular-nums text-highlighted">{{ item.value }}</p>
          </div>
        </section>

        <section v-if="!isBasicPlan" class="grid gap-3 sm:grid-cols-3" :aria-label="$t('stats.engagementRate.title')">
          <div v-for="item in engagementKpis" :key="item.label" class="border-t border-default pt-3">
            <p class="text-xs font-semibold text-muted">{{ item.label }}</p>
            <p class="mt-1 text-xl font-bold tabular-nums text-highlighted">{{ item.value }}</p>
          </div>
        </section>

        <section class="space-y-2" :aria-label="$t('stats.topArticle.pluralTitle')">
          <div
            v-for="(item, index) in rankedItems"
            :key="item.label"
            class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-default py-3"
          >
            <span class="text-lg font-black tabular-nums text-primary">{{ index + 1 }}</span>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-muted">{{ item.label }}</p>
              <NuxtLink
                v-if="item.slug"
                :to="articleUrl(item.slug)"
                :title="item.title"
                class="line-clamp-2 font-semibold text-highlighted hover:underline"
                >{{ item.title }}</NuxtLink
              >
              <NuxtLink
                v-else-if="item.author"
                :to="authorUrl(item.author)"
                :title="item.title"
                class="line-clamp-2 font-semibold text-highlighted hover:underline"
                >{{ item.title }}</NuxtLink
              >
              <p v-else class="line-clamp-2 italic text-muted" :title="item.title">{{ item.title }}</p>
            </div>
            <span class="whitespace-nowrap text-sm font-semibold tabular-nums text-muted">{{ item.value }}</span>
          </div>
        </section>

        <section v-if="!isBasicPlan" class="space-y-2" :aria-label="$t('stats.topTag.title')">
          <h3 class="text-sm font-semibold text-highlighted">{{ $t('stats.topTag.title') }}</h3>
          <div v-if="stats.topTags.length" class="flex flex-wrap gap-2">
            <UBadge
              v-for="(tag, index) in stats.topTags"
              :key="tag.name"
              color="neutral"
              variant="soft"
              :title="tag.name"
            >
              <span class="max-w-48 truncate">#{{ index + 1 }} {{ tag.name }}</span>
              <span class="tabular-nums text-muted">{{ tag.views.toLocaleString() }}</span>
            </UBadge>
          </div>
          <UEmpty v-else size="sm" :description="$t('stats.topTag.noTags')" />
        </section>

        <UAlert
          v-if="insight"
          color="primary"
          variant="soft"
          icon="i-mdi-brain"
          :title="$t('stats.sentiment.title')"
          :description="insight.summary"
        >
          <template #actions>
            <UBadge color="success" variant="soft">{{ insight.topEmotion }}</UBadge>
            <UBadge color="error" variant="soft">{{ (insight.toxicity * 100).toFixed(0) }}% toxicity</UBadge>
            <UBadge color="warning" variant="soft">{{ insight.suggestion }}</UBadge>
          </template>
        </UAlert>

        <UAlert
          v-if="isBasicPlan"
          color="warning"
          variant="soft"
          icon="i-mdi-lock"
          :title="$t('stats.upgradePrompt.title')"
          :description="$t('stats.upgradePrompt.description')"
        >
          <template #actions>
            <UButton to="/" color="warning">{{ $t('stats.upgradePrompt.button') }}</UButton>
          </template>
        </UAlert>

        <Charts
          v-if="!isBasicPlan"
          kind="timeseries"
          :chartData="chartData"
          :title="$t('stats.charts.viewsLastWeek')"
        />
        <Charts
          v-if="stats.totalShares > 0 && !isBasicPlan"
          kind="distribution"
          :chartData="shareChartData"
          :title="$t('stats.charts.shareDistribution')"
        />
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">{{ $t('common.close') }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack/types'

const open = defineModel<boolean>({ default: false })
type DashboardStats = InternalApi['/api/stats/dashboard']['default']
type CommunityInsight = InternalApi['/api/clients/sentiment']['get']

const { data: authData } = useAuth()
const requestFetch = useRequestFetch()
const clientSite = await useClientSite()
const localePath = useLocalePath()
const articleUrl = (slug: string) => localePath({ name: 'clanky-slug', params: { slug } })
const authorUrl = (name: string) => localePath({ name: 'autor-name', params: { name } })
const isBasicPlan = computed(() => authData.value?.user.plan === 'BASIC')

const {
  data: dashboard,
  isPending: pending,
  error,
  refetch,
} = useQuery({
  key: () => queryKeys.stats.dashboard,
  query: () => requestFetch<DashboardStats>('/api/stats/dashboard'),
  enabled: () => open.value,
})
const loadFailed = computed(() => !!error.value && !dashboard.value)

const { data: rawInsight } = useQuery({
  key: () => queryKeys.stats.sentiment,
  query: () => requestFetch<CommunityInsight>('/api/clients/sentiment'),
  enabled: () => open.value && !isBasicPlan.value,
})

const formatDuration = (totalMinutes: number) => {
  if (!totalMinutes) return '0m'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: clientSite?.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(amount)

const insight = computed(() => {
  if (!rawInsight.value) return null
  return typeof rawInsight.value === 'string' ? JSON.parse(rawInsight.value) : rawInsight.value
})

const stats = computed(() => ({
  totalViews: dashboard.value?.totalViews || 0,
  articleCount: dashboard.value?.articleCount || 0,
  savedAmount: dashboard.value?.savedAmount || 0,
  savedTimeMinutes: dashboard.value?.savedTimeMinutes || 0,
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

const primaryKpis = computed(() => [
  { icon: 'i-mdi-file-document', label: $t('stats.articleCount'), value: stats.value.articleCount.toLocaleString() },
  {
    icon: 'i-mdi-clock-check-outline',
    label: $t('stats.savedTime.title'),
    value: formatDuration(stats.value.savedTimeMinutes),
  },
  { icon: 'i-mdi-cash-multiple', label: $t('stats.savedAmount.title'), value: formatMoney(stats.value.savedAmount) },
])

const engagementKpis = computed(() => [
  { label: $t('stats.totalShares.title'), value: stats.value.totalShares.toLocaleString() },
  { label: $t('stats.followerCount'), value: stats.value.followerCount.toLocaleString() },
  { label: $t('stats.engagementRate.title'), value: `${Math.min(Math.round(stats.value.engagementRate * 100), 100)}%` },
])

const rankedItems = computed(() => [
  {
    label: $t('stats.topArticle.title'),
    title: stats.value.topArticle?.title || $t('stats.topArticle.noViews'),
    slug: stats.value.topArticle?.slug,
    value: stats.value.topArticle ? stats.value.topArticle.views.toLocaleString() : '—',
  },
  {
    label: $t('stats.topLikedArticle.title'),
    title: stats.value.topLikedArticle?.title || $t('stats.topLikedArticle.noLikes'),
    slug: stats.value.topLikedArticle?.slug,
    value: stats.value.topLikedArticle ? stats.value.topLikedArticle.likes.toLocaleString() : '—',
  },
  {
    label: $t('stats.topCommentedArticle.title'),
    title: stats.value.topCommentedArticle?.title || $t('stats.topCommentedArticle.noComments'),
    slug: stats.value.topCommentedArticle?.slug,
    value: stats.value.topCommentedArticle ? stats.value.topCommentedArticle.comments.toLocaleString() : '—',
  },
  {
    label: $t('stats.topAuthor.title'),
    title: stats.value.topAuthor?.username || $t('stats.topAuthor.noAuthors'),
    author: stats.value.topAuthor?.username,
    value: stats.value.topAuthor ? stats.value.topAuthor.articleCount.toLocaleString() : '—',
  },
])

const chartData = computed(() => ({
  labels: dashboard.value?.viewsHistory?.map((v: any) => v.date) || [],
  datasets: [
    {
      label: $t('stats.totalViews.title'),
      data: dashboard.value?.viewsHistory?.map((v: any) => v.views) || [],
      backgroundColor: '#4f46e5',
      borderColor: '#4f46e5',
      fill: false,
    },
  ],
}))

const shareChartData = computed(() => ({
  labels: ['Twitter', 'LinkedIn', 'Facebook', 'Email', 'Other'],
  datasets: [
    {
      label: $t('stats.totalShares.title'),
      data: [
        stats.value.sharesDistribution.TWITTER || 0,
        stats.value.sharesDistribution.LINKEDIN || 0,
        stats.value.sharesDistribution.FACEBOOK || 0,
        stats.value.sharesDistribution.EMAIL || 0,
        stats.value.sharesDistribution.OTHER || 0,
      ],
      backgroundColor: ['#4f46e5', '#64748b', '#818cf8', '#94a3b8', '#cbd5e1'],
      borderColor: '#ffffff',
      fill: false,
    },
  ],
}))
</script>
