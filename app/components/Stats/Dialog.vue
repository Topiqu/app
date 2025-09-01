<template>
  <Modal v-model="open" title="Statistiky blogu">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div v-if="loading" class="text-center text-gray-500 py-8">
        <div class="animate-pulse flex flex-col items-center gap-4">
          <Icon name="mdi:loading" class="w-8 h-8 text-gray-400 animate-spin" />
          <span>Načítání dat...</span>
        </div>
      </div>

      <div v-else-if="stats.articleCount === 0" class="text-center py-8">
        <div class="flex flex-col items-center gap-4 text-gray-500">
          <Icon name="mdi:book-off" class="w-12 h-12 text-gray-400" />
          <p class="text-xl font-medium">Blog zatím neobsahuje žádné články</p>
          <p class="text-sm">Statistiky budou k dispozici po přidání prvního článku</p>
        </div>
      </div>

      <div v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:eye" class="w-5 h-5 text-blue-600" />
              Celkem zobrazení
            </div>
            <p class="text-2xl font-bold text-blue-600">
              {{ stats.totalViews > 0 ? stats.totalViews.toLocaleString() : 'Zatím žádná zobrazení' }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:file-document" class="w-5 h-5 text-indigo-600" />
              Počet článků
            </div>
            <p class="text-2xl font-bold text-indigo-600">{{ stats.articleCount }}</p>
          </div>

          <div
            v-if="!isBasicPlan"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:share-variant" class="w-5 h-5 text-teal-600" />
              Celkem sdílení
            </div>
            <p class="text-2xl font-bold text-teal-600">
              {{ stats.totalShares > 0 ? stats.totalShares.toLocaleString() : 'Zatím žádná sdílení' }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:star" class="w-5 h-5 text-amber-500" />
              Nejčtenější článek
            </div>
            <template v-if="stats.topArticle">
              <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topArticle.title">
                {{ stats.topArticle.title }}
              </p>
              <p class="text-sm text-gray-500">{{ stats.topArticle.views.toLocaleString() }} zobrazení</p>
            </template>
            <p v-else class="text-gray-500 italic">Žádný článek zatím nebyl přečten</p>
          </div>

          <div
            v-if="data?.user.plan !== 'BASIC'"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:tag" class="w-5 h-5 text-emerald-600" />
              Nejpopulárnější tag
            </div>
            <template v-if="stats.topTags.length > 0">
              <p class="text-lg font-medium text-gray-900">
                {{ stats.topTags[0]?.name }}
              </p>
              <p class="text-sm text-gray-500">{{ stats.topTags[0]?.views.toLocaleString() }} zobrazení</p>
            </template>
            <p v-else class="text-gray-500 italic">Žádné tagy zatím nebyly použity</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover__ System: shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:heart" class="w-5 h-5 text-red-500" />
              Nejlajkovanější článek
            </div>
            <template v-if="stats.topLikedArticle && stats.topLikedArticle.likes > 0">
              <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topLikedArticle.title">
                {{ stats.topLikedArticle.title }}
              </p>
              <p class="text-sm text-gray-500">{{ stats.topLikedArticle.likes }} lajků</p>
            </template>
            <p v-else class="text-gray-500 italic">Žádný článek zatím nebyl lajkován</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:comment-text" class="w-5 h-5 text-purple-600" />
              Článek s nejvíce komentáři
            </div>
            <template v-if="stats.topCommentedArticle && stats.topCommentedArticle.comments > 0">
              <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topCommentedArticle.title">
                {{ stats.topCommentedArticle.title }}
              </p>
              <p class="text-sm text-gray-500">
                {{ stats.topCommentedArticle.comments }}
                {{
                  stats.topCommentedArticle.comments === 1
                    ? 'komentář'
                    : stats.topCommentedArticle.comments < 5
                      ? 'komentáře'
                      : 'komentářů'
                }}
              </p>
            </template>
            <p v-else class="text-gray-500 italic">Žádné články zatím nemají komentáře</p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:account-group" class="w-5 h-5 text-teal-600" />
              Počet sledujících
            </div>
            <p class="text-2xl font-bold text-teal-600">{{ stats.followerCount }}</p>
          </div>

          <div
            v-if="data?.user.plan !== 'BASIC'"
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:chart-line" class="w-5 h-5 text-pink-600" />
              Míra angažovanosti
            </div>
            <p class="text-2xl font-bold text-pink-600">
              {{ stats.engagementRate ? Math.round(stats.engagementRate * 100) + '%' : '0%' }}
            </p>
          </div>

          <div
            class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Icon name="mdi:account-star" class="w-5 h-5 text-orange-600" />
              Nejaktivnější autor
            </div>
            <template v-if="stats.topAuthor">
              <div class="flex items-center gap-3">
                <NuxtImg
                  v-if="stats.topAuthor.avatarUrl"
                  :src="stats.topAuthor.avatarUrl"
                  alt="Avatar autora"
                  class="w-10 h-10 rounded-full object-cover"
                  width="40"
                  height="40"
                  placeholder
                />
                <Icon v-else name="mdi:account-circle-outline" class="w-10 h-10 text-gray-400" />
                <div>
                  <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topAuthor.username">
                    {{ stats.topAuthor.username }}
                  </p>
                  <p class="text-sm text-gray-500">{{ stats.topAuthor.articleCount }} článků</p>
                </div>
              </div>
            </template>
            <p v-else class="text-gray-500 italic">Žádný autor zatím nepřispěl</p>
          </div>

          <div
            v-if="data?.user.plan === 'BASIC'"
            class="col-span-1 sm:col-span-2 p-6 bg-gradient-to-br from-gray-900 to-gray-800/90 backdrop-blur-lg rounded-xl shadow-xl border border-gray-700/30 text-white relative overflow-hidden"
          >
            <div
              class="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-60 animate-gradient-x"
            ></div>
            <div class="relative flex flex-col items-center gap-4 text-center">
              <Icon name="mdi:lock" class="w-12 h-12 text-yellow-400 animate-pulse" />
              <h3 class="text-xl font-bold tracking-tight text-gray-200">Odemkněte prémiové statistiky</h3>
              <p class="text-sm text-gray-200 max-w-md leading-relaxed">
                Získejte hlubší vhled do výkonu vašeho blogu s pokročilými grafy, analýzou sdílení, mírou angažovanosti
                a populárními tagy. Upgradujte na PRO nebo PREMIUM a maximalizujte svůj potenciál!
              </p>
              <NuxtLink
                to="/"
                class="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-semibold rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:from-yellow-500 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50"
              >
                Prozkoumat plány
              </NuxtLink>
            </div>
          </div>
        </div>

        <Charts v-if="!loading && stats.articleCount > 0 && data?.user.plan !== 'BASIC'" :chartData="chartData" />
        <div
          v-if="!loading && stats.articleCount > 0 && stats.totalShares > 0 && data?.user.plan !== 'BASIC'"
          class="mt-8"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Rozdělení sdílení podle platforem</h3>
          <Charts :chartData="shareChartData" />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
const { data } = useAuth()
const { onArticleCreated, onArticleDeleted } = useArticleEvent()

const isBasicPlan = computed(() => data?.value?.user.plan === 'BASIC')

const [
  { data: views, pending: viewsPending, refresh: refreshViews },
  { data: topArticle, pending: topArticlePending, refresh: refreshTopArticle },
  { data: articleCount, pending: articleCountPending, refresh: refreshArticleCount },
  { data: topTags, pending: topTagsPending, refresh: refreshTopTags },
  { data: viewsHistory, pending: viewsHistoryPending, refresh: refreshViewsHistory },
  { data: topLiked, pending: topLikedPending, refresh: refreshTopLiked },
  { data: topCommented, pending: topCommentedPending, refresh: refreshTopCommented },
  { data: followerCount, pending: followerCountPending, refresh: refreshFollowerCount },
  { data: engagementRate, pending: engagementRatePending, refresh: refreshEngagementRate },
  { data: topAuthor, pending: topAuthorPending, refresh: refreshTopAuthor },
  { data: shares, pending: sharesPending, refresh: refreshShares },
] = await Promise.all([
  useFetch('/api/stats/views', { lazy: true }),
  useFetch('/api/stats/top-article', { lazy: true }),
  useFetch('/api/stats/article-count', { lazy: true }),
  useFetch('/api/stats/top-tags?limit=1', { lazy: true, immediate: !isBasicPlan.value }),
  useFetch('/api/stats/views-history', { lazy: true, immediate: !isBasicPlan.value }),
  useFetch('/api/stats/top-liked', { lazy: true }),
  useFetch('/api/stats/top-commented', { lazy: true }),
  useFetch('/api/stats/follower-count', { lazy: true }),
  useFetch('/api/stats/engagement-rate', { lazy: true, immediate: !isBasicPlan.value }),
  useFetch('/api/stats/top-author', { lazy: true }),
  useFetch('/api/stats/shares', { lazy: true, immediate: !isBasicPlan.value }),
])

const loading = computed(() =>
  [
    viewsPending,
    topArticlePending,
    articleCountPending,
    topTagsPending,
    viewsHistoryPending,
    topLikedPending,
    topCommentedPending,
    followerCountPending,
    engagementRatePending,
    topAuthorPending,
    sharesPending,
  ].some((p) => p.value),
)

const stats = computed(() => ({
  totalViews: views.value?.totalViews || 0,
  articleCount: articleCount.value?.articleCount || 0,
  totalShares: shares.value?.totalShares || 0,
  shareDistribution: shares.value?.distribution || {
    TWITTER: 0,
    LINKEDIN: 0,
    EMAIL: 0,
    OTHER: 0,
  },
  topArticle: topArticle.value,
  topTags: topTags.value || [],
  topLikedArticle: topLiked.value,
  topCommentedArticle: topCommented.value,
  followerCount: followerCount.value?.count || 0,
  engagementRate: engagementRate.value?.engagementRate || 0,
  topAuthor: topAuthor.value,
}))

const chartData = computed(() => ({
  labels: viewsHistory.value?.map((v: any) => v.date) || ([] as string[]),
  datasets: [
    {
      label: 'Zobrazení článků',
      data: viewsHistory.value?.map((v: any) => v.views) || ([] as number[]),
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      fill: false,
    },
  ],
}))

const shareChartData = computed(() => ({
  labels: ['Twitter', 'LinkedIn', 'Ostatní'],
  datasets: [
    {
      label: 'Počet sdílení',
      data: [
        stats.value.shareDistribution.TWITTER || 0,
        stats.value.shareDistribution.LINKEDIN || 0,
        stats.value.shareDistribution.EMAIL || 0,
        stats.value.shareDistribution.OTHER || 0,
      ],
      backgroundColor: ['#1DA1F2', '#0077B5', '#F4B400', '#6B7280'],
      borderColor: '#ffffff',
      fill: false,
    },
  ],
}))

const refreshAll = () => {
  refreshViews()
  refreshTopArticle()
  refreshArticleCount()
  if (!isBasicPlan.value) refreshTopTags()
  if (!isBasicPlan.value) refreshViewsHistory()
  refreshTopLiked()
  refreshTopCommented()
  refreshFollowerCount()
  if (!isBasicPlan.value) refreshEngagementRate()
  refreshTopAuthor()
  if (!isBasicPlan.value) refreshShares()
}

onArticleCreated(refreshAll)
onArticleDeleted(refreshAll)
</script>

<style scoped>
@keyframes gradient-x {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x 8s ease infinite;
}
</style>
