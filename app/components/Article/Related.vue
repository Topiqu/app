<template>
  <section v-if="pending || articles.length" class="mt-20">
    <h2 class="mb-8 text-2xl font-bold tracking-tight">{{ $t('articles.relatedArticles.title') }}</h2>
    <div class="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:gap-8">
      <template v-if="pending && !articles.length">
        <div v-for="index in 2" :key="index" class="aspect-[4/3] overflow-hidden rounded-xl">
          <USkeleton class="size-full" />
        </div>
      </template>
      <template v-else>
        <ArticleCard
          v-for="article in articles"
          :key="article.id"
          :article="article"
          variant="standard"
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
