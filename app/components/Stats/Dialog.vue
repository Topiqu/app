<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-200"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div class="fixed inset-0 bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md" />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 translate-y-10"
        enter-to="opacity-100 translate-y-0"
        leave="ease-in duration-200"
        leave-from="opacity-100 translate-y-0"
        leave-to="opacity-0 translate-y-10"
      >
        <DialogPanel
          class="w-full max-w-xl bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 flex flex-col gap-6 border border-gray-200/70"
        >
          <div class="flex justify-between items-center">
            <DialogTitle
              class="text-3xl font-bold bg-gradient-to-r from-gray-600 to-gray-400 bg-clip-text text-transparent"
            >
              Statistiky blogu
            </DialogTitle>
            <button class="p-2 rounded-full hover:bg-gray-100 transition-colors" @click="$emit('close')">
              <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

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
              <template v-if="stats.topLikedArticle?.likes > 0">
                <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topLikedArticle?.title">
                  {{ stats.topLikedArticle?.title }}
                </p>
                <p class="text-sm text-gray-500">{{ stats.topLikedArticle?.likes }} lajků</p>
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
              <template v-if="stats.topCommentedArticle?.comments > 0">
                <p class="text-lg font-medium text-gray-900 truncate" :title="stats.topCommentedArticle?.title">
                  {{ stats.topCommentedArticle?.title }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ stats.topCommentedArticle?.comments }}
                  {{
                    stats.topCommentedArticle?.comments === 1
                      ? 'komentář'
                      : stats.topCommentedArticle?.comments < 5
                        ? 'komentáře'
                        : 'komentářů'
                  }}
                </p>
              </template>
              <p v-else class="text-gray-500 italic">Žádné články zatím nemají komentáře</p>
            </div>
          </div>

          <Charts v-if="!loading && stats.articleCount > 0" :chart-data="chartData" />

          <div class="flex justify-end">
            <button
              class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              @click="$emit('close')"
            >
              Zavřít
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

defineEmits(['close'])

const stats = ref({
  totalViews: 0,
  articleCount: 0,
  topArticle: null as { id: string; title: string; views: number } | null,
  topTags: [] as { id: string; name: string; views: number; articleCount: number }[],
  topLikedArticle: null as { id: string; title: string; likes: number } | null,
  topCommentedArticle: null as { id: string; title: string; comments: number } | null,
})
const loading = ref(false)
const chartData = ref({
  labels: [] as string[],
  datasets: [
    {
      label: 'Zobrazení článků',
      data: [] as number[],
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      fill: false,
    },
  ],
})

async function loadStats() {
  loading.value = true
  try {
    const [views, topArticle, articleCount, topTags, viewsHistory, topLiked, topCommented] = await Promise.all([
      $fetch('/api/stats/views'),
      $fetch('/api/stats/top-article'),
      $fetch('/api/stats/article-count'),
      $fetch('/api/stats/top-tags?limit=1'),
      $fetch('/api/stats/views-history'),
      $fetch('/api/stats/top-liked'),
      $fetch('/api/stats/top-commented'),
    ])
    stats.value = {
      totalViews: views.totalViews,
      articleCount: articleCount.articleCount,
      topArticle,
      topTags,
      topLikedArticle: topLiked,
      topCommentedArticle: topCommented,
    }
    chartData.value = {
      labels: viewsHistory.map((v: any) => v.date),
      datasets: [
        {
          label: 'Zobrazení článků',
          data: viewsHistory.map((v: any) => v.views),
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          fill: false,
        },
      ],
    }
  } catch (e) {
    console.error('Chyba při načítání statistik:', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>
