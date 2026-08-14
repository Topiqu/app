<template>
  <UCard v-if="pending" aria-busy="true">
    <div class="space-y-4">
      <USkeleton class="aspect-[8/5] w-full" />
      <USkeleton class="h-6 w-3/4" />
      <USkeleton class="h-4 w-full" />
      <USkeleton class="h-9 w-1/2" />
    </div>
  </UCard>
  <ArticleCard v-else-if="article" :article="article" :variant="isFeatured ? 'featured' : 'standard'" />
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

defineProps<{
  pending: boolean
  isFeatured?: boolean
  article?: ArticleCardData
  tags?: ArticleCardData['tags']
  index?: number
  selectedTag?: string
}>()
</script>
