<template>
  <section v-if="pending || articles.length" class="mt-20">
    <h2 class="mb-8 text-2xl font-bold tracking-tight">{{ $t('articles.relatedArticles.title') }}</h2>
    <div class="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:gap-8">
      <template v-if="pending && !articles.length">
        <div v-for="index in 2" :key="index" class="space-y-4">
          <USkeleton class="aspect-[4/3] w-full" />
          <USkeleton class="h-6 w-4/5" />
          <USkeleton class="h-4 w-full" />
        </div>
      </template>
      <template v-else>
        <ArticleCard
          v-for="article in articles"
          :key="article.id"
          :article="article"
          variant="editorial"
          layout="column"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

defineProps<{ articles: ArticleCardData[]; pending: boolean }>()
</script>
