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

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          class="p-4 bg-white/70 backdrop-blur-sm border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
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
      </div>

      <Charts v-if="!loading && stats.articleCount > 0" :chartData="chartData" />
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
const { onArticleCreated, onArticleDeleted } = useArticleEvent()

const [
  { data: views, pending: viewsPending, refresh: refreshViews },
  { data: topArticle, pending: topArticlePending, refresh: refreshTopArticle },
  { data: articleCount, pending: articleCountPending, refresh: refreshArticleCount },
  { data: topTags, pending: topTagsPending, refresh: refreshTopTags },
  { data: viewsHistory, pending: viewsHistoryPending, refresh: refreshViewsHistory },
  { data: topLiked, pending: topLikedPending, refresh: refreshTopLiked },
  { data: topCommented, pending: topCommentedPending, refresh: refreshTopCommented },
] = await Promise.all([
  useFetch('/api/stats/views', { lazy: true }),
  useFetch('/api/stats/top-article', { lazy: true }),
  useFetch('/api/stats/article-count', { lazy: true }),
  useFetch('/api/stats/top-tags?limit=1', { lazy: true }),
  useFetch('/api/stats/views-history', { lazy: true }),
  useFetch('/api/stats/top-liked', { lazy: true }),
  useFetch('/api/stats/top-commented', { lazy: true }),
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
  ].some((p) => p.value),
)

const stats = computed(() => ({
  totalViews: views.value?.totalViews || 0,
  articleCount: articleCount.value?.articleCount || 0,
  topArticle: topArticle.value,
  topTags: topTags.value || [],
  topLikedArticle: topLiked.value,
  topCommentedArticle: topCommented.value,
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

const refreshAll = () => {
  refreshViews()
  refreshTopArticle()
  refreshArticleCount()
  refreshTopTags()
  refreshViewsHistory()
  refreshTopLiked()
  refreshTopCommented()
}

onArticleCreated(refreshAll)
onArticleDeleted(refreshAll)
</script>
