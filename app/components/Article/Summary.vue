<template>
  <section v-if="answer || takeaways.length" class="flex flex-col gap-4">
    <p
      v-if="answer"
      class="text-lg leading-relaxed font-medium text-gray-800 border-l-4 border-blue-500 pl-4 dark:text-gray-100 dark:border-blue-400"
    >
      {{ answer }}
    </p>

    <div v-if="takeaways.length" class="rounded-xl bg-gray-50 p-5 dark:bg-neutral-900">
      <h2 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
        <Icon name="mdi:lightbulb-on-outline" class="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        {{ $t('articles.keyTakeaways') }}
      </h2>
      <ul class="mt-3 flex flex-col gap-2 list-disc pl-5 text-gray-700 dark:text-gray-300">
        <li v-for="item in takeaways" :key="item">{{ item }}</li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
// The answer paragraph is what an engine lifts as the citation, so it sits above the body in the
// served HTML rather than being derived from it.
defineProps<{ answer?: string | null; takeaways: string[] }>()
</script>
