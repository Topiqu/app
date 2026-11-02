<template>
  <div class="grid min-w-0 gap-6 md:grid-cols-2">
    <section class="min-w-0" :aria-labelledby="availableHeadingId">
      <h2 :id="availableHeadingId" class="font-semibold text-highlighted">{{ $t('series.chooseArticles') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('series.chooseArticlesHint') }}</p>
      <UInput
        v-model="search"
        class="my-3"
        icon="mdi:magnify"
        :placeholder="$t('series.searchArticles')"
        :aria-label="$t('series.searchArticles')"
        :disabled="disabled"
        maxlength="255"
        @keydown.enter.prevent
      />
      <div :aria-busy="status === 'pending'">
        <div v-if="status === 'pending'" class="flex min-h-48 flex-col gap-3" :aria-label="$t('common.loading')">
          <USkeleton v-for="index in 3" :key="index" class="h-16 w-full" />
        </div>
        <UAlert v-else-if="error" color="error" :title="$t('common.messages.loadFailedText')">
          <template #actions>
            <UButton color="neutral" variant="soft" @click="refresh()">{{ $t('common.messages.retry') }}</UButton>
          </template>
        </UAlert>
        <UEmpty
          v-else-if="!results?.data.length"
          size="sm"
          icon="mdi:file-document-outline"
          :title="$t('common.noResults')"
          :description="$t('series.noAvailableArticles')"
          class="min-h-48"
        />
        <ul v-else class="divide-y divide-default rounded-(--ui-radius) border border-default">
          <li v-for="article in results.data" :key="article.id" class="flex items-center gap-3 p-3">
            <AppMedia
              :src="article.imageUrl"
              alt=""
              aspectRatio="1"
              class="size-12 shrink-0 rounded-(--ui-radius)"
              sizes="48px"
            />
            <UCheckbox
              :modelValue="selectedIds.has(article.id)"
              :label="article.title"
              :disabled="disabled || (!selectedIds.has(article.id) && selected.length >= SERIES_ARTICLE_LIMIT)"
              :ui="{ root: 'min-w-0 flex-1', wrapper: 'min-w-0 flex-1', label: 'break-words cursor-pointer' }"
              @update:modelValue="toggle(article)"
            >
              <template #description>
                <span class="mt-1 flex flex-wrap items-center gap-2">
                  <UBadge v-if="article.scheduled" color="neutral" variant="soft" size="sm">{{
                    $t('series.scheduled')
                  }}</UBadge>
                  <ArticleStatusPill v-else :status="article.status" />
                  <LanguageFlag :language="article.language" />
                </span>
              </template>
            </UCheckbox>
          </li>
        </ul>
      </div>
      <UPagination
        v-if="results && results.total > pageSize"
        v-model:page="page"
        class="mt-3"
        :total="results.total"
        :itemsPerPage="pageSize"
        :siblingCount="0"
        :showEdges="false"
        :disabled="disabled || status === 'pending'"
        size="sm"
      />
    </section>
    <section class="min-w-0" :aria-labelledby="selectedHeadingId">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 :id="selectedHeadingId" class="font-semibold text-highlighted">{{ $t('series.selectedArticles') }}</h2>
        <span class="text-xs tabular-nums text-muted" aria-live="polite"
          >{{ selected.length }} / {{ SERIES_ARTICLE_LIMIT }}</span
        >
      </div>
      <p class="mt-1 text-sm text-muted">{{ $t('series.orderHint') }}</p>
      <ol
        v-if="selected.length"
        class="mt-3 divide-y divide-default rounded-(--ui-radius) border border-default bg-elevated/40"
      >
        <li v-for="(article, index) in selected" :key="article.id" class="flex items-center gap-2 p-3">
          <span class="w-5 shrink-0 text-sm tabular-nums text-muted">{{ index + 1 }}</span>
          <span class="min-w-0 flex-1 break-words text-sm font-medium text-highlighted">{{ article.title }}</span>
          <div class="flex shrink-0 flex-col sm:flex-row">
            <UButton
              type="button"
              icon="mdi:arrow-up"
              size="xs"
              square
              color="neutral"
              variant="ghost"
              :aria-label="$t('series.moveUp', { title: article.title })"
              :disabled="disabled || index === 0"
              @click="move(index, -1)"
            />
            <UButton
              type="button"
              icon="mdi:arrow-down"
              size="xs"
              square
              color="neutral"
              variant="ghost"
              :aria-label="$t('series.moveDown', { title: article.title })"
              :disabled="disabled || index === selected.length - 1"
              @click="move(index, 1)"
            />
            <UButton
              type="button"
              icon="mdi:close"
              size="xs"
              square
              color="neutral"
              variant="ghost"
              :aria-label="$t('series.removeSelected', { title: article.title })"
              :disabled="disabled"
              @click="toggle(article)"
            />
          </div>
        </li>
      </ol>
      <UEmpty
        v-else
        class="mt-3 min-h-48"
        variant="soft"
        size="sm"
        icon="mdi:playlist-plus"
        :description="$t('series.selectionEmpty')"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack'

import { SERIES_ARTICLE_LIMIT } from '~~/shared/seriesSchemas'

type SeriesArticle = InternalApi['/api/series/articles']['get']['data'][number]

const selected = defineModel<SeriesArticle[]>({ default: () => [] })
const { disabled = false } = defineProps<{ disabled?: boolean }>()
const availableHeadingId = useId()
const selectedHeadingId = useId()
const search = shallowRef('')
const query = refDebounced(search, 300)
const page = shallowRef(1)
const pageSize = 10
watch(
  query,
  () => {
    page.value = 1
  },
  { flush: 'sync' },
)
const {
  data: results,
  status,
  error,
  refresh,
} = useFetch('/api/series/articles', {
  server: false,
  query: { query, page, limit: pageSize },
  getCachedData: () => undefined,
})
const selectedIds = computed(() => new Set(selected.value.map(({ id }) => id)))

const toggle = (article: SeriesArticle) => {
  if (disabled) return
  if (selectedIds.value.has(article.id)) selected.value = selected.value.filter(({ id }) => id !== article.id)
  else if (selected.value.length < SERIES_ARTICLE_LIMIT) selected.value = [...selected.value, article]
}
const move = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (disabled || target < 0 || target >= selected.value.length) return
  const reordered = [...selected.value]
  ;[reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!]
  selected.value = reordered
}
</script>
