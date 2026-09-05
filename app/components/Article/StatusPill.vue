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
      return 'mdi:check-circle-outline'
    case 'archived':
      return 'mdi:archive-outline'
    default:
      return 'mdi:circle-edit-outline'
  }
})

const label = computed(() => $t(`articles.status.${status}`))
</script>
