<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-4 pb-4 sm:flex-row">
      <UFormField :label="$t('articles.searchPlaceholder')" :ui="{ label: 'sr-only' }">
        <UInput v-model="search" icon="i-mdi-magnify" :placeholder="$t('articles.searchPlaceholder')" />
      </UFormField>
      <UFormField :label="$t('articles.title')" :ui="{ label: 'sr-only' }">
        <USelectMenu v-model="sort" valueKey="value" labelKey="label" :searchInput="false" :items="sortItems" />
      </UFormField>
    </div>
    <USeparator />

    <div v-if="pending" class="grid gap-6" aria-busy="true">
      <UCard v-for="i in 6" :key="i" aria-hidden="true">
        <div class="flex gap-4">
          <USkeleton class="h-[120px] w-48" />
          <div class="flex-1 space-y-3">
            <USkeleton class="h-6 w-3/4" />
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-5/6" />
          </div>
        </div>
      </UCard>
    </div>

    <div v-else-if="articles.length" class="grid auto-rows-fr gap-6 sm:grid-cols-2">
      <ArticleCard v-for="article in articles" :key="article.id" :article="article">
        <template v-if="$slots.actions" #actions="slotProps">
          <slot name="actions" v-bind="slotProps" />
        </template>
      </ArticleCard>

      <UPagination
        v-model:page="page"
        :total="Math.max(totalPages, 1)"
        :itemsPerPage="1"
        color="neutral"
        variant="outline"
        activeColor="primary"
        activeVariant="solid"
        showEdges
      />
    </div>

    <UEmpty v-else icon="i-mdi-file-search-outline" :description="$t('articles.noResults.message')" />
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

const props = defineProps<{
  articles: ArticleCardData[]
  pending: boolean
  hasMore: boolean
}>()

const search = defineModel<string>('search', { required: true })
const sort = defineModel<string>('sort', { required: true })
const page = defineModel<number>('page', { required: true })

const totalPages = computed(() => (props.hasMore ? page.value + 1 : page.value))
const sortItems = computed(() => [
  { value: 'createdAt:desc', label: $t('common.sortOptions.newest') },
  { value: 'createdAt:asc', label: $t('common.sortOptions.oldest') },
  { value: 'title:asc', label: $t('common.labels.title') + ' A-Z' },
  { value: 'title:desc', label: $t('common.labels.title') + ' Z-A' },
])
</script>
