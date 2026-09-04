<template>
  <ArticleCard :article="cardArticle" variant="compact" :layout="grid ? 'column' : 'responsive-row'">
    <template #actions>
      <UButton
        icon="mdi:heart-broken-outline"
        square
        size="sm"
        color="error"
        variant="ghost"
        :aria-label="$t('profile.likedArticles')"
        @click="$emit('unlike', article.id)"
      />
      <UButton
        icon="mdi:share-variant-outline"
        square
        size="sm"
        color="neutral"
        variant="ghost"
        :aria-label="$t('common.actions.copyLink')"
        :title="$t('common.actions.copyLink')"
        @click="$emit('share', article)"
      />
    </template>
  </ArticleCard>
</template>

<script setup lang="ts">
import type { Article as _Article } from '@prisma/client'

export type ActivityArticle = Pick<_Article, 'id' | 'slug' | 'title' | 'content' | 'excerpt' | 'imageUrl' | 'views'> & {
  authorUsername: string
  authorPfp?: string | null
  tags: string[]
  likesCount: number
  createdAt: string | null
}

const { article } = defineProps<{ article: ActivityArticle; grid?: boolean }>()

defineEmits<{ (e: 'unlike', id: string): void; (e: 'share', article: ActivityArticle): void }>()

const cardArticle = computed(() => ({
  ...article,
  createdAt: article.createdAt ?? new Date(0).toISOString(),
  tags: article.tags.map((name, index) => ({ id: `${index}`, name })),
  _count: { reactions: article.likesCount },
}))
</script>
