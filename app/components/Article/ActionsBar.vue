<template>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted">
    <div class="flex flex-wrap items-center gap-4">
      <template v-if="isAdmin">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ $t('articles.columns.status') }}</span>
          <ArticleStatusCell :row="{ original: article }" @update="onStatusUpdate" />
        </div>
        <span>|</span>
        <div class="flex items-center gap-2">
          <span>{{ $t('articles.comments.title') }}</span>
          <UFormField :label="$t('common.actions.toggleComments')" :ui="{ label: 'sr-only' }">
            <USwitch
              :modelValue="article.allowedComments"
              :aria-label="$t('common.actions.toggleComments')"
              @update:modelValue="$emit('toggleComments')"
            />
          </UFormField>
        </div>
        <span>|</span>
      </template>

      <div class="flex items-center gap-2">
        <UIcon size="16" name="mdi:calendar" />{{ formatDate(article.createdAt) }}
      </div>
      <span>|</span>
      <div class="flex items-center gap-2">
        <UIcon size="16" name="mdi:clock-outline" />{{ $t('articles.readingTime', [article.readingTime]) }}
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1">
        <span>{{ formatNumber(article.views) }}x {{ $t('stats.totalViews.title') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UIcon size="16" name="mdi:heart" :class="article.likedByUser ? 'text-error' : 'text-muted'" />
        <span>{{ formatNumber(article.likes) }}</span>
      </div>
      <div class="flex items-center gap-1">
        <UIcon size="16" name="mdi:share-variant" /><span>{{ formatNumber(article.shared) }}</span>
      </div>

      <UButton
        v-if="isAdmin"
        color="primary"
        variant="soft"
        square
        icon="mdi:pencil"
        :to="localePath({ name: 'admin-editor-id', params: { id: article.sourceSlug || article.slug } })"
        :aria-label="$t('common.actions.edit')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'
import { formatNumber } from '~~/shared/utils/number'

const localePath = useLocalePath()

defineProps<{
  article: any
  isAdmin: boolean
  onStatusUpdate: (id: string, status: string) => Promise<void>
}>()

defineEmits<{
  (e: 'toggleComments' | 'refresh'): void
}>()
</script>
