<template>
  <div
    ref="listOrigin"
    class="flex min-h-0 w-full flex-1 flex-col gap-4 sm:overflow-hidden"
    data-article-table
    :data-search-query="globalFilter"
  >
    <div class="shrink-0 space-y-3 border-b border-default bg-default py-3" data-article-table-toolbar>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UFormField
          :label="$t('articles.searchPlaceholder')"
          :ui="{ label: 'sr-only' }"
          class="w-full min-w-0 sm:flex-1"
        >
          <UInput
            v-model="globalFilter"
            type="search"
            :placeholder="$t('articles.searchPlaceholder')"
            icon="mdi:magnify"
            class="w-full"
          />
        </UFormField>
        <UButton
          class="shrink-0"
          color="neutral"
          variant="soft"
          icon="mdi:filter-variant"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          {{ $t('common.labels.filters') }}
          <UBadge v-if="activeFilterCount" color="primary" variant="solid">{{ activeFilterCount }}</UBadge>
        </UButton>
        <div v-if="rows.length" class="shrink-0">
          <Exports :articles="rows" />
        </div>
      </div>
      <div
        v-show="filtersOpen"
        class="grid gap-3 overflow-y-auto overscroll-contain rounded-(--topiqu-surface-radius) border border-default p-4 sm:max-h-[min(22rem,calc(100dvh-8rem))] sm:grid-cols-2 lg:grid-cols-3"
      >
        <UFormField :label="$t('common.labels.status')"
          ><USelect v-model="statusFilter" :items="statusItems"
        /></UFormField>
        <UFormField :label="$t('common.labels.dateFrom')"><UInput v-model="dateFrom" type="date" /></UFormField>
        <UFormField :label="$t('common.labels.dateTo')"><UInput v-model="dateTo" type="date" /></UFormField>
        <UFormField :label="$t('common.labels.sortBy')"><USelect v-model="sortField" :items="sortItems" /></UFormField>
        <UFormField :label="$t('common.labels.order')"><USelect v-model="sortOrder" :items="orderItems" /></UFormField>
        <div class="flex items-end">
          <UButton color="neutral" variant="soft" icon="mdi:filter-remove-outline" @click="clearFilters">{{
            $t('common.actions.clear')
          }}</UButton>
        </div>
      </div>
    </div>

    <UAlert
      v-if="loadFailed"
      color="error"
      icon="mdi:alert-circle-outline"
      :title="$t('common.messages.loadFailedTitle')"
      :description="$t('common.messages.loadFailedText')"
    >
      <template #actions>
        <UButton icon="mdi:refresh" color="error" variant="soft" @click="refetch()">
          {{ $t('common.messages.retry') }}
        </UButton>
      </template>
    </UAlert>

    <UEmpty
      v-else-if="!isPending && rows.length === 0"
      icon="mdi:file-document-outline"
      :title="$t('articles.noResults.message')"
    />

    <div
      v-else
      class="hidden min-h-0 flex-1 overflow-auto rounded-(--topiqu-surface-radius) border border-default bg-default sm:block"
      :aria-busy="isRefetching"
    >
      <UTable
        :data="rows"
        :columns="columns"
        :loading="isPending || isRefetching"
        :ui="{
          root: 'overflow-visible',
          base: 'w-full min-w-[48rem] table-fixed',
          thead: 'sticky top-0 z-20 bg-default shadow-[0_1px_0_var(--ui-border)]',
        }"
      >
        <template #title-header>
          <UButton color="neutral" variant="ghost" :trailingIcon="sortIcon('title')" @click="toggleSort('title')">
            {{ $t('articles.columns.title') }}
          </UButton>
        </template>
        <template #status-header>
          <UButton color="neutral" variant="ghost" :trailingIcon="sortIcon('status')" @click="toggleSort('status')">
            {{ $t('articles.columns.status') }}
          </UButton>
        </template>
        <template #createdAt-header>
          <UButton
            color="neutral"
            variant="ghost"
            :trailingIcon="sortIcon('createdAt')"
            @click="toggleSort('createdAt')"
          >
            {{ $t('articles.columns.date') }}
          </UButton>
        </template>
        <template #imageUrl-cell="{ row }">
          <NuxtLink :to="articleUrl(row.original.slug)" class="block focus-visible:outline-offset-2">
            <AppMedia
              :src="row.original.imageUrl"
              :alt="row.original.title"
              aspectRatio="1 / 1"
              sizes="56px"
              containerClass="size-14 rounded-md"
            />
          </NuxtLink>
        </template>
        <template #title-cell="{ row }">
          <NuxtLink
            :to="articleUrl(row.original.slug)"
            class="block min-w-0 max-w-full truncate"
            :title="row.original.title"
            :class="row.original.status === 'archived' ? 'text-muted line-through' : 'font-medium'"
          >
            {{ row.original.title }}
          </NuxtLink>
        </template>
        <template #status-cell="{ row }">
          <ArticleStatusCell :row="row" @update="debouncedSetStatus" />
        </template>
        <template #languages-cell="{ row }">
          <ArticleLanguageLinks
            :links="languageLinks(row.original)"
            :current="primaryLanguage"
            target="editor"
            :articleRef="row.original.slug"
          />
        </template>
        <template #createdAt-cell="{ row }">{{ formatTime(row.original.createdAt, 'shortDatetime') }}</template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UTooltip :text="$t('articles.openArticle')">
              <UButton
                :to="articleUrl(row.original.slug)"
                icon="mdi:eye-outline"
                color="neutral"
                variant="ghost"
                square
                :aria-label="$t('articles.openArticle')"
              />
            </UTooltip>
            <UTooltip :text="row.original.status === 'archived' ? $t('articles.messages.archivedCannotEdit') : ''">
              <UButton
                icon="mdi:pencil"
                color="neutral"
                variant="ghost"
                :disabled="row.original.status === 'archived'"
                :aria-label="$t('common.actions.edit')"
                @click="openEditor(row.original.slug)"
              />
            </UTooltip>
            <UDropdownMenu :items="desktopActionItems(row.original)">
              <UButton
                icon="mdi:dots-vertical"
                color="neutral"
                variant="ghost"
                square
                :aria-label="$t('common.actions.more')"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
    </div>

    <div v-if="isPending" class="space-y-3 sm:hidden">
      <UCard v-for="n in 5" :key="n"><USkeleton class="h-28 w-full" /></UCard>
    </div>
    <div v-else-if="rows.length" class="space-y-3 sm:hidden" :aria-busy="isRefetching">
      <UCard v-for="article in rows" :key="article.id">
        <div class="flex gap-3">
          <NuxtLink :to="articleUrl(article.slug)" class="block shrink-0">
            <AppMedia
              :src="article.imageUrl"
              :alt="article.title"
              aspectRatio="1 / 1"
              sizes="80px"
              containerClass="size-20 rounded-lg"
            />
          </NuxtLink>
          <div class="min-w-0 flex-1 space-y-2">
            <NuxtLink
              :to="articleUrl(article.slug)"
              class="line-clamp-2 font-semibold"
              :class="article.status === 'archived' ? 'line-through text-muted' : ''"
            >
              {{ article.title }}
            </NuxtLink>
            <ArticleStatusCell :row="{ original: article }" @update="debouncedSetStatus" />
            <ArticleLanguageLinks
              :links="languageLinks(article)"
              :current="primaryLanguage"
              target="editor"
              :articleRef="article.slug"
            />
            <p class="text-xs text-muted">{{ formatTime(article.createdAt, 'shortDatetime') }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <UButton
              :to="articleUrl(article.slug)"
              icon="mdi:eye-outline"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('articles.openArticle')"
            />
            <UButton
              icon="mdi:pencil"
              color="neutral"
              variant="ghost"
              square
              :disabled="article.status === 'archived'"
              :aria-label="$t('common.actions.edit')"
              @click="openEditor(article.slug)"
            />
            <LazyArticleTag :articleId="article.id" hydrateOnInteraction>
              <UButton
                icon="mdi:tag-outline"
                color="neutral"
                variant="ghost"
                square
                :aria-label="$t('articles.tags.title')"
              />
            </LazyArticleTag>
            <UDropdownMenu :items="mobileActionItems(article)">
              <UButton
                icon="mdi:dots-vertical"
                color="neutral"
                variant="ghost"
                square
                :aria-label="$t('common.actions.more')"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="totalPages > 1" class="flex shrink-0 justify-center pb-2">
      <UPagination
        :page="page"
        :total="totalPages"
        :itemsPerPage="1"
        color="neutral"
        variant="outline"
        activeColor="primary"
        activeVariant="solid"
        showEdges
        @update:page="setPage"
      />
    </div>
  </div>
  <LazyArticleTag
    v-if="tagTargetId"
    :key="tagTargetId"
    v-model="tagOpen"
    :articleId="tagTargetId"
    hydrateOnInteraction
  />
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { ArticleStatus } from '@zenstackhq/runtime/models'

import type { LanguageLink } from '~/components/Article/LanguageLinks.vue'

const router = useRouter()
const route = useRoute()
const toast = useAppToast()
const { invalidateArticleLists, invalidateArticlesAndStats } = useCacheInvalidation()
const confirm = useConfirm()
const localePath = useLocalePath()
const articleUrl = (slug: string) => localePath({ name: 'clanky-slug', params: { slug } })
const { formatTime } = useTime()
const requestFetch = useRequestFetch()
const clientSite = await useClientSite()
const primaryLanguage = clientSite?.language ?? 'en'
// Language currently has two enum values (cs/en), so the table can derive the only possible
// target from the public tenant context without fetching private settings separately.
const targetLanguage = primaryLanguage === 'cs' ? 'en' : 'cs'
const translatingArticleId = shallowRef<string | null>(null)
const listOrigin = useTemplateRef<HTMLElement>('listOrigin')

const hasTargetTranslation = (article: ArticleWithDetails) =>
  article.translations?.some((translation) => translation.language === targetLanguage) ?? false

const translateArticle = async (article: ArticleWithDetails) => {
  if (translatingArticleId.value) return
  translatingArticleId.value = article.id
  try {
    await $fetch(`/api/articles/${article.id}/translate`, {
      method: 'POST',
      body: { language: targetLanguage },
    })
    await invalidateArticleLists()
    toast.success({ message: $t('articles.translations.messages.translated') })
  } catch (e: any) {
    toast.error({
      message: e?.data?.message || $t('common.messages.operationFailed'),
    })
  } finally {
    translatingArticleId.value = null
  }
}

// The editor resolves an article by its source slug, not its id — see `GET /api/articles/[id]`.
const openEditor = (slug: string) => router.push(localePath({ name: 'admin-editor-id', params: { id: slug } }))

/**
 * Source first, then every language that actually has a translation row. A configured-but-never
 * translated language is deliberately absent: the column answers "which versions exist", and an
 * empty placeholder for each unused language would just add noise to every row.
 */
const languageLinks = (article: ArticleWithDetails): LanguageLink[] => [
  { language: primaryLanguage as LanguageLink['language'], slug: article.slug },
  ...(article.translations ?? []).map((tr) => ({
    language: tr.language as LanguageLink['language'],
    slug: tr.slug ?? article.slug,
    status: tr.status as LanguageLink['status'],
  })),
]

const page = shallowRef(Number(route.query.page) || 1)
const limit = 20
const globalFilter = ref((route.query.query as string) || '')
const statusFilter = shallowRef((route.query.status as string) || 'all')
const dateFrom = shallowRef((route.query.dateFrom as string) || '')
const dateTo = shallowRef((route.query.dateTo as string) || '')
const sortField = shallowRef((route.query.sort as string) || 'createdAt')
const sortOrder = shallowRef((route.query.order as string) || 'desc')
const filtersOpen = shallowRef(statusFilter.value !== 'all' || Boolean(dateFrom.value) || Boolean(dateTo.value))
const tagOpen = shallowRef(false)
const tagTargetId = shallowRef('')
const debouncedFilter = refDebounced(globalFilter, 400)
const statusItems = computed(() => [
  { label: $t('common.labels.all'), value: 'all' },
  { label: $t('articles.status.draft'), value: 'draft' },
  { label: $t('articles.status.published'), value: 'published' },
  { label: $t('articles.status.archived'), value: 'archived' },
])
const sortItems = computed(() => [
  { label: $t('articles.columns.title'), value: 'title' },
  { label: $t('articles.columns.status'), value: 'status' },
  { label: $t('articles.columns.date'), value: 'createdAt' },
])
const orderItems = computed(() => [
  { label: $t('common.sortOptions.newest'), value: 'desc' },
  { label: $t('common.sortOptions.oldest'), value: 'asc' },
])
const listQuery = computed(() => ({
  page: page.value,
  limit,
  ...(debouncedFilter.value ? { query: debouncedFilter.value } : {}),
  ...(statusFilter.value !== 'all' ? { status: statusFilter.value } : {}),
  ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
  ...(dateTo.value ? { dateTo: dateTo.value } : {}),
  sort: sortField.value,
  order: sortOrder.value,
}))

const {
  data: articles,
  asyncStatus,
  isPending,
  error,
  refetch,
} = useQuery({
  key: () => ['articles', 'list', listQuery.value],
  query: () =>
    requestFetch<{ data: ArticleWithDetails[]; total: number }>('/api/articles/search', { query: listQuery.value }),
  placeholderData: (previous) => previous,
})

const rows = computed(() => articles.value?.data ?? [])
const totalPages = computed(() => Math.ceil((articles.value?.total ?? 0) / limit))
const isRefetching = computed(() => asyncStatus.value === 'loading' && !isPending.value)
const loadFailed = computed(() => !!error.value && rows.value.length === 0)
const activeFilterCount = computed(
  () => [statusFilter.value !== 'all', dateFrom.value, dateTo.value].filter(Boolean).length,
)
const columns = computed<TableColumn<ArticleWithDetails>[]>(() => [
  {
    accessorKey: 'imageUrl',
    header: $t('articles.columns.imageUrl'),
    enableSorting: false,
    meta: {
      class: {
        th: 'hidden w-20 lg:table-cell',
        td: 'hidden w-20 lg:table-cell',
      },
    },
  },
  {
    accessorKey: 'title',
    header: $t('articles.columns.title'),
    meta: {
      class: {
        th: 'w-auto overflow-hidden',
        td: 'min-w-0 max-w-0 overflow-hidden',
      },
    },
  },
  {
    accessorKey: 'status',
    header: $t('articles.columns.status'),
    meta: { class: { th: 'w-52', td: 'w-52 overflow-hidden' } },
  },
  {
    id: 'languages',
    header: $t('articles.translations.languageTabs'),
    meta: {
      class: {
        th: 'hidden w-36 lg:table-cell',
        td: 'hidden w-36 lg:table-cell',
      },
    },
  },
  {
    accessorKey: 'createdAt',
    header: $t('articles.columns.date'),
    meta: {
      class: {
        th: 'hidden w-48 xl:table-cell',
        td: 'hidden w-48 whitespace-nowrap xl:table-cell',
      },
    },
  },
  {
    id: 'actions',
    header: $t('articles.columns.actions'),
    meta: { class: { th: 'w-32', td: 'w-32' } },
  },
])

const toggleSort = (field: 'title' | 'status' | 'createdAt') => {
  if (sortField.value === field) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
}
const sortIcon = (field: string) =>
  sortField.value === field
    ? sortOrder.value === 'asc'
      ? 'mdi:arrow-up'
      : 'mdi:arrow-down'
    : 'mdi:unfold-more-horizontal'

const setPage = (nextPage: number) => {
  page.value = Math.min(Math.max(nextPage, 1), Math.max(totalPages.value, 1))
  router.push({ query: { ...listQuery.value, limit: undefined } })
  nextTick(() =>
    listOrigin.value?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }),
  )
}

const syncUrl = () => {
  page.value = 1
  router.replace({
    query: {
      ...(globalFilter.value ? { query: globalFilter.value } : {}),
      ...(statusFilter.value !== 'all' ? { status: statusFilter.value } : {}),
      ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
      ...(dateTo.value ? { dateTo: dateTo.value } : {}),
      sort: sortField.value,
      order: sortOrder.value,
    },
  })
}
const syncTextUrl = useDebounceFn(syncUrl, 400)
watch(globalFilter, syncTextUrl)
watch([statusFilter, dateFrom, dateTo, sortField, sortOrder], syncUrl)

const clearFilters = () => {
  globalFilter.value = ''
  statusFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
  sortField.value = 'createdAt'
  sortOrder.value = 'desc'
}

const { mutate: setStatus } = useMutation({
  mutation: async ({ id, status }: { id: string; status: ArticleStatus }) => {
    await $fetch(`/api/articles/${id}` as `/api/articles/:id`, {
      method: 'PATCH',
      body: { status },
    })
  },
  onSuccess: (_data, { status }) =>
    toast.add({
      color: 'success',
      title: 'Status ' + $t(`articles.status.${status}`).toLocaleLowerCase(),
    }),
  onError: (error: any) =>
    toast.add({
      color: 'error',
      title: error.data?.message || $t('articles.messages.statusChangeFailed'),
    }),
  onSettled: invalidateArticleLists,
})

const debouncedSetStatus = useDebounceFn((id: string, status: ArticleStatus) => setStatus({ id, status }), 100)
const { mutate: deleteArticle, isLoading: isDeleting } = useMutation({
  mutation: async (id: string) => $fetch<unknown>(`/api/articles/${id}` as string, { method: 'DELETE' }),
  onSuccess: () =>
    toast.add({
      color: 'success',
      title: $t('articles.messages.deleteSuccess'),
    }),
  onError: (error: any) =>
    toast.add({
      color: 'error',
      title: error.data?.message || $t('articles.messages.deleteFailed'),
    }),
  onSettled: invalidateArticlesAndStats,
})

async function del(id: string) {
  const confirmed = await confirm({
    title: $t('common.messages.deleteConfirmTitle'),
    message: $t('common.messages.deleteConfirmText'),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.actions.delete'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (confirmed && !isDeleting.value) deleteArticle(id)
}

const { exportJson, exportCsv, exportPdf } = useExport()
const exportItems = (article: ArticleWithDetails): DropdownMenuItem[][] => [
  [
    {
      label: $t('articles.export.title.json'),
      icon: 'mdi:code-json',
      onSelect: () => exportJson(article),
    },
    {
      label: $t('articles.export.title.csv'),
      icon: 'mdi:file-delimited',
      onSelect: () => exportCsv(article),
    },
    {
      label: $t('articles.export.title.pdf'),
      icon: 'mdi:file-pdf-box',
      onSelect: () => exportPdf(article),
    },
  ],
]

const desktopActionItems = (article: ArticleWithDetails): DropdownMenuItem[][] => [
  [
    {
      label: hasTargetTranslation(article)
        ? $t('articles.translations.actions.retranslate')
        : $t('articles.translations.actions.translate'),
      icon: 'mdi:translate',
      disabled: translatingArticleId.value === article.id,
      onSelect: () => translateArticle(article),
    },
  ],
  [
    {
      label: $t('articles.tags.title'),
      icon: 'mdi:tag-outline',
      onSelect: () => {
        tagTargetId.value = article.id
        tagOpen.value = true
      },
    },
  ],
  ...(article.status === 'archived' ? [] : exportItems(article)),
  [
    {
      label: $t('common.actions.delete'),
      icon: 'mdi:delete',
      color: 'error',
      onSelect: () => del(article.id),
    },
  ],
]

const mobileActionItems = (article: ArticleWithDetails): DropdownMenuItem[][] => [
  [
    {
      label: hasTargetTranslation(article)
        ? $t('articles.translations.actions.retranslate')
        : $t('articles.translations.actions.translate'),
      icon: 'mdi:translate',
      disabled: translatingArticleId.value === article.id,
      onSelect: () => translateArticle(article),
    },
  ],
  [
    {
      label: $t('common.actions.delete'),
      icon: 'mdi:delete',
      color: 'error',
      onSelect: () => del(article.id),
    },
  ],
  ...(article.status === 'archived' ? [] : exportItems(article)),
]
</script>
