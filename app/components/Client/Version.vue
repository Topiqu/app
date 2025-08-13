<template>
  <div
    class="fixed bottom-2 right-2 text-sm font-inter flex items-center gap-2 text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-neutral-900/80 px-3 py-1 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 backdrop-blur-sm"
  >
    <span>RASG Blog {{ version }}</span>
    <span>|</span>
    <span>
      Současný plán:
      <span
        :class="{
          'text-green-700 dark:text-green-400': site?.plan === 'BASIC',
          'text-blue-700 dark:text-blue-400': site?.plan === 'PRO',
          'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded':
            site?.plan === 'PREMIUM',
          'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-bold':
            site?.plan === 'CUSTOM',
          'font-semibold': true,
        }"
      >
        {{ site?.plan ?? 'Není přiřazen' }}
      </span>
      <span v-if="site?.tokenLimit && site?.tokenRemaining != null" v-tippy="articleEstimateTooltip">
        (<span
          :class="{
            'text-red-700 dark:text-red-400': site.tokenRemaining / site.tokenLimit < 0.3,
            'text-green-700 dark:text-green-400': site.tokenRemaining / site.tokenLimit >= 0.3,
            'font-semibold': true,
          }"
        >
          {{ site.tokenRemaining }}/{{ site.tokenLimit }} </span
        >)
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

const config = useRuntimeConfig()
const props = defineProps<{ userId: string }>()
const version = computed(() => config.public.appVersion)

const { data: site } = await useFetch(`/api/clients/${props.userId}/by-userid`)

const articleEstimateTooltip = computed(() => {
  if (!site.value?.tokenRemaining) return ''
  const tokensPerArticle = 8000
  const estimatedArticles = Math.floor(site.value.tokenRemaining / tokensPerArticle)
  return `Přibližně ${estimatedArticles} ${
    estimatedArticles === 1 ? 'článek' : estimatedArticles >= 2 && estimatedArticles <= 4 ? 'články' : 'článků'
  }`
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

.font-inter {
  font-family: 'Inter', sans-serif;
}
</style>
