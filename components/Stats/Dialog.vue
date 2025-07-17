<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-90"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-100"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-90"
      >
        <DialogPanel
          class="w-full max-w-lg bg-white p-10 rounded-3xl shadow-2xl flex flex-col gap-8 border backdrop-blur-sm"
        >
          <DialogTitle class="text-xl font-bold text-gray-900">
            Statistiky blogu
          </DialogTitle>

          <div v-if="loading" class="text-gray-600">Načítání...</div>
          <div v-else class="flex flex-col gap-4">
            <div class="text-gray-600">
              <span class="font-medium">Celkem zobrazení: </span
              >{{ stats.totalViews }}
            </div>
            <div class="text-gray-600">
              <span class="font-medium">Celkem článků: </span
              >{{ stats.articleCount }}
            </div>
            <div class="text-gray-600">
              <span class="font-medium">Nejčtenější článek: </span>
              {{ stats.topArticle?.title || 'Žádný článek' }} ({{
                stats.topArticle?.views || 0
              }}
              zobrazení)
            </div>
            <div class="text-gray-600">
              <span class="font-medium">Nejpopulárnější tag: </span>
              {{ stats.topTags[0]?.name || 'Žádný tag' }} ({{
                stats.topTags[0]?.views || 0
              }}
              zobrazení)
            </div>
          </div>

          <Charts :chart-data="chartData" />

          <div class="flex gap-4 justify-end">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
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
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
} from '@headlessui/vue'

defineEmits(['close'])

const stats = ref({
  totalViews: 0,
  articleCount: 0,
  topArticle: null as { id: string; title: string; views: number } | null,
  topTags: [] as {
    id: string
    name: string
    views: number
    articleCount: number
  }[],
})
const loading = ref(false)
const chartData = ref({
  labels: ['1.7.', '2.7.', '3.7.', '4.7.', '5.7.', '6.7.', '7.7.'],
  datasets: [
    {
      label: 'Zobrazení článků',
      data: [0, 0, 0, 0, 0, 0, 0],
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      fill: false,
    },
  ],
})

async function loadStats() {
  loading.value = true
  try {
    const [views, topArticle, articleCount, topTags, viewsHistory] =
      await Promise.all([
        $fetch('/api/stats/views'),
        $fetch('/api/stats/top-article'),
        $fetch('/api/stats/article-count'),
        $fetch('/api/stats/top-tags?limit=1'),
        $fetch('/api/stats/views-history'),
      ])
    stats.value = {
      totalViews: views.totalViews,
      articleCount: articleCount.articleCount,
      topArticle,
      topTags,
    }
    chartData.value = {
      labels: viewsHistory.map((v) => v.date),
      datasets: [
        {
          label: 'Zobrazení článků',
          data: viewsHistory.map((v) => v.views),
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
