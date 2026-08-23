<template>
  <section v-if="articles && articles.length" class="mt-20">
    <h2 class="text-2xl font-bold mb-8 tracking-tight">{{ $t('articles.relatedArticles.title') }}</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <ArticleCard v-for="article in articles" :key="article.id" :article="article" variant="compact" layout="column" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

defineProps<{ articles: Omit<ArticleWithDetails, 'content'>[]; pending: boolean }>()
</script>
