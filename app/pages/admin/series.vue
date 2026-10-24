<template>
  <div class="topiqu-dashboard-page flex flex-col gap-5 py-6">
    <header>
      <h1 class="text-2xl font-bold text-highlighted">{{ $t('series.overview') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ $t('series.overviewDescription') }}</p>
    </header>
    <div class="flex flex-col gap-3 sm:flex-row">
      <UInput
        v-model="search"
        icon="mdi:magnify"
        :placeholder="$t('common.search')"
        :aria-label="$t('common.search')"
        class="w-full sm:max-w-sm"
      />
      <USelect
        v-model="status"
        :items="statusItems"
        :aria-label="$t('articles.columns.status')"
        class="w-full sm:w-48"
      />
      <USelect
        v-model="sort"
        :items="sortItems"
        :aria-label="$t('common.labels.sortBy')"
        class="w-full sm:ml-auto sm:w-48"
      />
    </div>
    <UProgress v-if="pending" />
    <UAlert v-if="error" color="error" :title="$t('common.messages.loadFailedText')">
      <template #actions
        ><UButton color="neutral" variant="soft" @click="refresh()">{{
          $t('common.messages.retry')
        }}</UButton></template
      >
    </UAlert>
    <UEmpty v-else-if="!pending && !visibleSeries.length" icon="mdi:bookshelf" :title="$t('common.noResults')" />
    <UCard v-for="series in visibleSeries" :key="series.id" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="break-words font-semibold text-highlighted">{{ series.name }}</h2>
            <p v-if="series.description" class="mt-1 text-sm text-muted">{{ series.description }}</p>
          </div>
          <span class="shrink-0 text-sm text-muted">{{
            $t('series.publishedCount', {
              published: series.publishedCount,
              total: series.articles.length,
            })
          }}</span>
        </div>
      </template>
      <ul class="divide-y divide-default">
        <li v-for="(article, index) in series.visibleArticles" :key="article.id">
          <UButton
            :to="localePath({ name: 'admin-editor-id', params: { id: article.id } })"
            color="neutral"
            variant="ghost"
            size="row"
            block
            :ui="{ base: 'justify-start' }"
          >
            <span class="w-6 shrink-0 text-sm tabular-nums text-muted">{{ index + 1 }}</span>
            <span class="min-w-0 flex-1 break-words text-sm text-highlighted">{{ article.title }}</span>
            <UBadge
              v-if="article.status === 'published' && !article.available"
              color="neutral"
              variant="soft"
              size="sm"
              >{{ $t('series.scheduled') }}</UBadge
            >
            <ArticleStatusPill v-else :status="article.status" />
            <UIcon name="mdi:chevron-right" class="size-4 shrink-0 text-muted" />
          </UButton>
        </li>
      </ul>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('series.overview') })
const localePath = useLocalePath()
const search = shallowRef('')
const status = shallowRef('all')
const sort = shallowRef('name')
const { data: allSeries, pending, error, refresh } = await useFetch('/api/series', { default: emptyAsyncDataList })
const statusItems = computed(() => [
  { label: $t('series.allParts'), value: 'all' },
  ...['published', 'draft', 'archived'].map((value) => ({ label: $t(`articles.status.${value}`), value })),
  { label: $t('series.scheduled'), value: 'scheduled' },
])
const sortItems = computed(() => [
  { label: $t('series.nameLabel'), value: 'name' },
  { label: $t('common.sortOptions.newest'), value: 'newest' },
  { label: $t('series.mostParts'), value: 'parts' },
])
const visibleSeries = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return allSeries.value
    .map((item) => ({
      ...item,
      publishedCount: item.articles.filter((article) => article.available).length,
      visibleArticles: item.articles.filter(
        (article) =>
          (status.value === 'all' ||
            (status.value === 'published'
              ? article.available
              : status.value === 'scheduled'
                ? article.status === 'published' && !article.available
                : article.status === status.value)) &&
          (!term || item.name.toLocaleLowerCase().includes(term) || article.title.toLocaleLowerCase().includes(term)),
      ),
    }))
    .filter(
      (item) =>
        item.visibleArticles.length ||
        (!item.articles.length && status.value === 'all' && (!term || item.name.toLocaleLowerCase().includes(term))),
    )
    .sort((a, b) =>
      sort.value === 'newest'
        ? +new Date(b.updatedAt ?? 0) - +new Date(a.updatedAt ?? 0)
        : sort.value === 'parts'
          ? b.articles.length - a.articles.length
          : a.name.localeCompare(b.name),
    )
})
</script>
