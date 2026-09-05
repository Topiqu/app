<template>
  <section v-if="entries.length" class="w-full mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
    <h2 class="flex items-center gap-2 text-lg font-medium text-gray-700 dark:text-gray-300">
      <UIcon name="mdi:comment-question-outline" class="h-5 w-5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
      {{ $t('articles.faq') }}
    </h2>

    <dl class="mt-4 flex flex-col gap-4">
      <div v-for="entry in entries" :key="entry.question">
        <dt class="font-semibold text-gray-900 dark:text-gray-100">{{ entry.question }}</dt>
        <dd class="mt-1 text-gray-700 dark:text-gray-300">{{ entry.answer }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import type { FaqEntry } from '~~/shared/utils/articleFaq'

defineProps<{ entries: FaqEntry[] }>()
</script>
