<template>
  <section v-if="articles.length" class="mt-20">
    <h2 class="text-2xl font-bold mb-8 tracking-tight">Související články</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <ArticleSkeletonCard
        v-for="(a, idx) in articles"
        :key="a.id"
        :pending="false"
        :article="a"
        :tags="a.tags"
        :index="idx"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '../../../types/article'

defineProps<{ articles: ArticleWithDetails[] }>()
</script>
