<template>
  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" :class="pillClass">
    <Icon :name="icon" class="w-3.5 h-3.5" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { ArticleStatus } from '@zenstackhq/runtime/models'

const { status } = defineProps<{ status: ArticleStatus | string }>()

const pillClass = computed(() => {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    case 'archived':
      return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }
})

const icon = computed(() => {
  switch (status) {
    case 'published':
      return 'mdi:check-circle-outline'
    case 'archived':
      return 'mdi:archive-outline'
    default:
      return 'mdi:circle-edit-outline'
  }
})

const label = computed(() => $t(`articles.status.${status}`))
</script>
