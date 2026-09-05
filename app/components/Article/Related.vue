<template>
  <section v-if="pending || articles.length" class="mt-20">
    <h2 class="mb-8 text-2xl font-bold tracking-tight">{{ $t('articles.relatedArticles.title') }}</h2>
    <div class="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <template v-if="pending && !articles.length">
        <div v-for="index in 3" :key="index" class="aspect-[4/3] overflow-hidden rounded-xl">
          <USkeleton class="size-full" />
        </div>
      </template>
      <template v-else>
        <ArticleCard
          v-for="article in articles"
          :key="article.id"
          :article="article"
          variant="compact"
          layout="column"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

defineProps<{ articles: Omit<ArticleWithDetails, 'content'>[]; pending: boolean }>()
</script>
