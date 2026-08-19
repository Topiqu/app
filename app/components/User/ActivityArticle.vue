<template>
  <article
    class="rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    :class="grid ? 'flex flex-col gap-4' : 'flex items-start gap-4'"
  >
    <NuxtImg
      :src="article.imageUrl || '/topik_empty_rm.png'"
      :alt="article.imageUrl ? $t('articles.articleCard.imageAlt', [article.title]) : ''"
      format="webp"
      quality="95"
      loading="lazy"
      class="shrink-0 rounded-lg object-cover"
      :class="grid ? 'w-full aspect-video' : 'size-20'"
    />

    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <NuxtLink
        :to="localePath({ name: 'clanky-slug', params: { slug: article.slug } })"
        class="text-base font-semibold leading-snug tracking-tight text-neutral-900 hover:underline dark:text-neutral-100 text-pretty"
      >
        {{ article.title }}
      </NuxtLink>

      <div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <UserPicture :url="article.authorPfp" :name="article.authorUsername" size="sm" />
        <span>{{ article.authorUsername }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ formatDate(article.createdAt || new Date().toISOString()) }}</span>
      </div>

      <p v-if="excerpt" class="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400 text-pretty">
        {{ excerpt }}
      </p>

      <div v-if="article.tags.length" class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in article.tags"
          :key="tag"
          class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
        >
          {{ tag }}
        </span>
      </div>

      <div class="mt-auto flex items-center justify-between gap-3 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <Icon name="mdi:thumb-up-outline" class="size-3.5" />
            <span class="tabular-nums">{{ article.likesCount }}</span>
          </span>
          <span class="flex items-center gap-1">
            <Icon name="mdi:eye-outline" class="size-3.5" />
            <span class="tabular-nums">{{ article.views }}</span>
          </span>
        </div>
        <div class="flex items-center gap-1">
          <Button
            icon="mdi:heart-broken-outline"
            square
            borderless
            size="sm"
            variant="transparent"
            class="!text-red-600 dark:!text-red-400"
            :aria="$t('profile.likedArticles')"
            @click="$emit('unlike', article.id)"
          />
          <Button
            icon="mdi:share-variant-outline"
            square
            borderless
            size="sm"
            variant="transparent"
            :aria="$t('common.actions.copyLink')"
            :title="$t('common.actions.copyLink')"
            @click="$emit('share', article)"
          />
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Article as _Article } from '@prisma/client'

import { formatDate } from '~~/shared/utils'

export type ActivityArticle = Pick<_Article, 'id' | 'slug' | 'title' | 'content' | 'excerpt' | 'imageUrl' | 'views'> & {
  authorUsername: string
  authorPfp?: string | null
  tags: string[]
  likesCount: number
  createdAt: string | null
}

const { article } = defineProps<{ article: ActivityArticle; grid?: boolean }>()

defineEmits<{ (e: 'unlike', id: string): void; (e: 'share', article: ActivityArticle): void }>()

const localePath = useLocalePath()

const excerpt = computed(() => {
  const raw = article.excerpt || article.content
  if (!raw) return ''
  return `${raw.replace(/<[^>]+>/g, '').slice(0, 160)}…`
})
</script>
