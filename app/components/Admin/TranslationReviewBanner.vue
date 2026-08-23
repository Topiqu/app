<template>
  <section
    v-if="translations.length"
    class="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 flex flex-col gap-4"
  >
    <header class="flex items-center gap-2">
      <Icon name="mdi:translate" class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <h2 class="font-semibold text-sm text-amber-900 dark:text-amber-100">
        {{ $t('articles.translations.reviewQueue.title', total, { count: total }) }}
      </h2>
    </header>

    <p class="text-xs text-amber-800 dark:text-amber-200 -mt-2">
      {{ $t('articles.translations.reviewQueue.desc') }}
    </p>

    <ul class="flex flex-col gap-2">
      <li v-for="row in translations" :key="row.id">
        <UButton
          :to="{
            path: localePath({ name: 'admin-editor-id', params: { id: row.article.slug } }),
            query: { lang: row.language },
          }"
          color="warning"
          variant="soft"
          block
        >
          <span
            class="px-2 py-0.5 rounded-full text-xs font-medium uppercase bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          >
            {{ row.language }}
          </span>
          <span class="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-gray-100">
            {{ row.title || row.article.title }}
          </span>
          <AppTime
            v-if="row.translatedAt"
            :datetime="row.translatedAt"
            preset="relative"
            class="text-xs text-gray-500 dark:text-gray-400"
          />
          <Icon name="mdi:arrow-right" class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        </UButton>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const localePath = useLocalePath()

const { data } = await useFetch<{
  translations: {
    id: string
    language: string
    title: string | null
    translatedAt: string | null
    article: { id: string; slug: string; title: string }
  }[]
  total: number
}>('/api/translations', {
  key: 'translation-review-queue',
  query: { status: 'READY', limit: 5 },
  default: () => ({ translations: [], total: 0 }),
})

const translations = computed(() => data.value.translations)
const total = computed(() => data.value.total)
</script>
