<template>
  <div class="topiqu-dashboard-page flex flex-col gap-5 py-6">
    <header>
      <h1 class="text-2xl font-bold text-highlighted">{{ $t('series.overview') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ $t('series.overviewDescription') }}</p>
    </header>
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
      <div class="flex min-w-0 items-center gap-3 sm:ml-auto">
        <UButton icon="mdi:plus" class="shrink-0" @click="createOpen = true">
          {{ $t('series.createAction') }}
        </UButton>
        <USelect
          v-model="sort"
          :items="sortItems"
          :aria-label="$t('common.labels.sortBy')"
          class="min-w-0 flex-1 sm:w-48 sm:flex-none"
        />
      </div>
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
          <div class="flex shrink-0 items-center gap-1">
            <span class="mr-2 text-sm text-muted">{{
              $t('series.publishedCount', {
                published: series.publishedCount,
                total: series.articles.length,
              })
            }}</span>
            <UButton
              icon="mdi:pencil-outline"
              color="neutral"
              variant="ghost"
              square
              :aria-label="`${$t('common.actions.edit')}: ${series.name}`"
              :title="$t('common.actions.edit')"
              @click="openEdit(series)"
            />
            <UButton
              icon="mdi:delete-outline"
              color="error"
              variant="ghost"
              square
              :aria-label="`${$t('common.actions.delete')}: ${series.name}`"
              :title="$t('common.actions.delete')"
              :loading="deletingId === series.id"
              :disabled="deletingId !== null"
              @click="deleteSeries(series.id)"
            />
          </div>
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
            <span class="min-w-0 flex-1 whitespace-normal break-words text-left text-sm text-highlighted">{{
              article.title
            }}</span>
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
    <SeriesCreate v-model:open="createOpen" @created="onCreated" />
    <SeriesEdit v-model:open="editOpen" :series="editedSeries" @saved="refresh()" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('series.overview') })
const localePath = useLocalePath()
const search = shallowRef('')
const status = shallowRef('all')
const sort = shallowRef('name')
const createOpen = shallowRef(false)
const { data: allSeries, pending, error, refresh } = await useFetch('/api/series', { default: emptyAsyncDataList })
const onCreated = async () => {
  search.value = ''
  status.value = 'all'
  sort.value = 'newest'
  await refresh()
}

const editOpen = shallowRef(false)
const editedSeries = shallowRef<{ id: string; name: string; description?: string | null } | null>(null)
const openEdit = (series: { id: string; name: string; description?: string | null }) => {
  editedSeries.value = series
  editOpen.value = true
}

const confirm = useConfirm()
const toast = useToast()
const { invalidateArticles } = useCacheInvalidation()
const deletingId = shallowRef<string | null>(null)
const deleteSeries = async (id: string) => {
  const accepted = await confirm({
    title: $t('series.deleteTitle'),
    message: $t('series.deleteDescription'),
    icon: 'mdi:playlist-remove',
    confirmText: $t('common.actions.delete'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (!accepted) return
  deletingId.value = id
  try {
    await $fetch(`/api/series/${id}` as '/api/series/:id', { method: 'DELETE' })
    toast.add({ color: 'success', title: $t('common.messages.deleteSuccess') })
    await refresh()
    await invalidateArticles()
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.deleteFailed') })
  } finally {
    deletingId.value = null
  }
}
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
