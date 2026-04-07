<template>
  <div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600 mt-4">
    <div class="flex flex-wrap items-center gap-4">
      <template v-if="isAdmin">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ $t('articles.columns.status') }}</span>
          <ArticleStatusCell :onUpdate="onStatusUpdate" :row="{ original: article }" />
          <span v-if="article.status === 'published'" class="w-2 h-2 bg-green-500 rounded-full animate-pulse-slow" />
        </div>
        <span class="text-gray-300">|</span>
        <div class="flex items-center gap-2">
          <span>{{ $t('articles.comments.title') }}</span>
          <button
            role="switch"
            :class="[
              'relative inline-flex h-5 w-10 items-center rounded-full',
              article.allowedComments ? 'bg-blue-600' : 'bg-gray-500 dark:bg-gray-600',
            ]"
            @click="$emit('toggleComments')"
          >
            <span
              :class="[
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                article.allowedComments ? 'translate-x-5' : 'translate-x-1',
              ]"
            />
          </button>
        </div>
        <span class="text-gray-300">|</span>
      </template>

      <div class="flex items-center gap-2">
        <Icon name="mdi:calendar" class="w-4 h-4" />{{ formatDate(article.createdAt) }}
      </div>
      <span class="text-gray-300">|</span>
      <div class="flex items-center gap-2">
        <Icon name="mdi:clock-outline" class="w-4 h-4" />{{ $t('articles.readingTime', [article.readingTime]) }}
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1">
        <span>{{ formatNumber(article.views) }}x {{ $t('stats.totalViews.title') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <Icon name="mdi:heart" class="w-4 h-4" :class="article.likedByUser ? 'text-red-500' : 'text-gray-500'" />
        <span>{{ formatNumber(article.likes) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <Icon name="mdi:share-variant" class="w-4 h-4 text-gray-500" /><span>{{ formatNumber(article.shared) }}</span>
      </div>

      <LazyArticleModal
        v-if="isAdmin"
        v-slot="{ open }"
        :article="article"
        hydrateOnInteraction
        @saved="$emit('refresh')"
      >
        <button
          class="flex items-center justify-center w-9 h-9 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400"
          :aria-label="$t('common.actions.edit')"
          @click="open.value = true"
        >
          <Icon name="mdi:pencil" class="w-5 h-5" />
        </button>
      </LazyArticleModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'
import { formatNumber } from '~~/shared/utils/number'

defineProps<{
  article: any
  isAdmin: boolean
  onStatusUpdate: (id: string, status: string) => Promise<void>
}>()

defineEmits<{
  (e: 'toggleComments' | 'refresh'): void
}>()
</script>
