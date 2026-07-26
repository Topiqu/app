<template>
  <div class="flex flex-col items-center gap-5">
    <h1
      class="text-balance text-4xl font-black tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-gray-100"
    >
      {{ site?.name ?? $t('common.labels.title') }}
    </h1>
    <div class="h-0.5 w-12 rounded-full bg-blue-500" />

    <p v-if="site?.description" class="max-w-xl text-balance text-lg leading-relaxed text-gray-600 dark:text-gray-300">
      {{ site.description }}
    </p>

    <p
      class="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-400"
    >
      <span class="h-2 w-2 animate-pulse rounded-full bg-blue-500" aria-hidden="true" />
      {{ $t('articles.empty.badge') }}
    </p>

    <div class="space-y-2 pt-2">
      <h2 class="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
        {{ $t('articles.empty.title') }}
      </h2>
      <p class="max-w-md text-balance text-base text-gray-500 dark:text-gray-400">
        {{ $t('articles.empty.message') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmptySiteInfo } from '~~/shared/utils/emptySite'

defineProps<{ site?: EmptySiteInfo | null }>()
</script>
