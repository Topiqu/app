<template>
  <div class="min-w-0 w-full flex flex-col gap-5">
    <div
      class="sticky z-header -mx-2 bg-default/95 px-2 backdrop-blur-md"
      :class="hasDashboardChrome ? 'top-0' : 'top-[var(--topiqu-header-height)] pt-3'"
    >
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <UFormField class="w-full" :label="$t('articles.searchPlaceholder')" :ui="{ label: 'sr-only' }">
          <UInput v-model="search" class="w-full" icon="mdi:magnify" :placeholder="$t('articles.searchPlaceholder')" />
        </UFormField>
        <UFormField :label="$t('articles.title')" :ui="{ label: 'sr-only' }">
          <USelectMenu
            v-model="sort"
            class="w-full"
            valueKey="value"
            labelKey="label"
            :searchInput="false"
            :items="sortItems"
          />
        </UFormField>
      </div>
      <USeparator class="mt-3" />
    </div>

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

    <template v-else-if="articles.length">
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ArticleCard v-for="article in articles" :key="article.id" :article="article">
          <template v-if="$slots.actions" #actions="slotProps">
            <slot name="actions" v-bind="slotProps" />
          </template>
        </ArticleCard>
      </div>

      <div v-if="totalPages > 1" class="flex justify-center border-t border-default pt-8">
        <UPagination
          v-model:page="page"
          :total="totalPages"
          :itemsPerPage="1"
          color="neutral"
          variant="outline"
          activeColor="primary"
          activeVariant="solid"
          showEdges
        />
      </div>
    </template>

    <UEmpty v-else icon="mdi:file-search-outline" :description="$t('articles.noResults.message')" />
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

const { articles, pending, hasMore } = defineProps<{
  articles: ArticleCardData[]
  pending: boolean
  hasMore: boolean
}>()
const { data: auth } = useAuth()
const hasDashboardChrome = computed(() => ['admin', 'superadmin'].includes(auth.value?.user?.role || ''))

const search = defineModel<string>('search', { required: true })
const sort = defineModel<string>('sort', { required: true })
const page = defineModel<number>('page', { required: true })

const totalPages = computed(() => (hasMore ? page.value + 1 : page.value))
const sortItems = computed(() => [
  { value: 'createdAt:desc', label: $t('common.sortOptions.newest') },
  { value: 'createdAt:asc', label: $t('common.sortOptions.oldest') },
  { value: 'title:asc', label: $t('common.labels.title') + ' A-Z' },
  { value: 'title:desc', label: $t('common.labels.title') + ' Z-A' },
])
</script>
