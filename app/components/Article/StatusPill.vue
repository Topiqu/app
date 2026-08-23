<template>
  <UBadge :color="color" variant="soft" :icon="icon" :label="label" />
</template>

<script setup lang="ts">
import type { ArticleStatus } from '@zenstackhq/runtime/models'

const { status } = defineProps<{ status: ArticleStatus | string }>()

const color = computed(() => {
  switch (status) {
    case 'published':
      return 'success'
    case 'archived':
      return 'neutral'
    default:
      return 'warning'
  }
})

const icon = computed(() => {
  switch (status) {
    case 'published':
      return 'i-mdi-check-circle-outline'
    case 'archived':
      return 'i-mdi-archive-outline'
    default:
      return 'i-mdi-circle-edit-outline'
  }
})

const label = computed(() => $t(`articles.status.${status}`))
</script>
