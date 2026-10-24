<template>
  <div class="space-y-3 border-y border-default py-4 text-sm text-muted">
    <div v-if="isAdmin" class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-center gap-2">
        <span class="font-medium">{{ $t('articles.columns.status') }}</span>
        <ArticleStatusCell :row="{ original: article }" @update="onStatusUpdate" />
      </div>
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
      <UButton
        color="neutral"
        variant="soft"
        icon="mdi:pencil"
        :label="$t('common.actions.edit')"
        :to="localePath({ name: 'admin-editor-id', params: { id: article.sourceSlug || article.slug } })"
      />
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex items-center gap-2">
          <UIcon size="16" name="mdi:calendar" />{{ formatDate(article.createdAt, locale) }}
        </div>
        <div class="flex items-center gap-2">
          <UIcon size="16" name="mdi:clock-outline" />{{ $t('articles.readingTime', [article.readingTime]) }}
        </div>
        <div class="flex items-center gap-1">
          <span>{{ formatNumber(article.views) }}x {{ $t('stats.totalViews.title') }}</span>
        </div>
        <div class="flex items-center gap-1">
          <UIcon size="16" name="mdi:share-variant" /><span>{{ formatNumber(article.shared) }}</span>
        </div>
      </div>
      <slot name="sharing" />
    </div>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
const { locale } = useI18n()

defineProps<{
  article: any
  isAdmin: boolean
  onStatusUpdate: (id: string, status: string) => Promise<void>
}>()

defineEmits<{
  (e: 'toggleComments' | 'refresh'): void
}>()
</script>
