<template>
  <div class="mb-10 space-y-4 px-4 sm:px-6 lg:px-8">
    <div class="flex justify-center">
      <div class="relative w-full max-w-xs sm:max-w-xl">
        <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          <Icon name="material-symbols:search-rounded" />
        </span>
        <input
          v-model="globalFilter"
          type="text"
          :placeholder="$t('articles.searchPlaceholder')"
          class="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
        />
      </div>
    </div>
    <div class="overflow-x-auto rounded border border-gray-300 sm:block hidden">
      <table class="w-full table-auto text-sm divide-y divide-gray-200">
        <thead class="bg-gray-100 text-left font-semibold text-black">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-2 sm:px-4 py-2 text-center select-none cursor-pointer group relative min-h-[48px]"
              @click="header.column.getCanSort() ? header.column.getToggleSortingHandler()?.($event) : undefined"
            >
              <span v-if="!header.isPlaceholder" class="text-black flex items-center justify-center gap-2">
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <span v-if="header.column.getCanSort()">
                  <Icon
                    :name="
                      header.column.getIsSorted() === 'asc'
                        ? 'mdi:arrow-up'
                        : header.column.getIsSorted() === 'desc'
                          ? 'mdi:arrow-down'
                          : 'mdi:arrow-up-down'
                    "
                    class="w-4 h-4 text-blue-400"
                  />
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody v-auto-animate class="text-gray-800">
          <tr v-if="articles.data.length === 0" class="text-center">
            <td colspan="5" class="px-4 py-10">
              <NuxtImg src="/topik_smutny_rm.png" :alt="$t('articles.noResults.imageAlt')" class="mx-auto w-32" />
              <p class="mt-4 text-xl text-gray-500 dark:text-gray-300">{{ $t('articles.noResults.message') }}</p>
            </td>
          </tr>
          <tr
            v-for="row in table.getRowModel().rows"
            v-else
            :key="row.id"
            :class="[
              'transition-colors duration-200 light:hover:bg-gray-100 group',
              row.original.status === 'published'
                ? 'light:bg-green-50 border-l-4 border-green-400'
                : 'light:bg-white border-l-4 border-yellow-400',
            ]"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2 break-words max-w-[240px] sm:max-w-none text-center min-h-[72px] dark:text-white"
              :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
            >
              <div
                v-if="cell.column.id === 'content'"
                class="line-clamp-3 dark:bg-transparent"
                v-html="cell.getValue() as string"
              ></div>
              <div
                v-else-if="cell.column.id === 'imageUrl'"
                class="flex items-center justify-center h-full dark:bg-transparent"
              >
                <NuxtImg
                  v-if="cell.getValue()"
                  :src="cell.getValue() as string"
                  :alt="$t('articles.columns.imageUrl')"
                  class="w-16 h-16 object-cover rounded"
                />
                <Icon v-else name="mdi:image-off" class="w-16 h-16 text-gray-400" />
              </div>
              <div
                v-else-if="cell.column.id === 'status'"
                class="flex items-center justify-center h-full dark:bg-transparent"
                :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </div>
              <div
                v-else-if="['title', 'date'].includes(cell.column.id)"
                class="flex items-center justify-center h-full dark:bg-transparent"
                :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
              >
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </div>
              <div v-else class="flex items-center justify-center h-full dark:bg-transparent">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </div>
            </td>
            <td
              class="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 min-h-[72px]"
            >
              <Button
                :icon="'mdi:eye'"
                variant="success"
                @click="router.push(localePath({ name: 'clanky-slug', params: { slug: row.original.slug } }))"
              />
              <LazyArticleEdit v-slot="{ open }" :article="row.original" hydrateOnInteraction @saved="refresh">
                <Button :icon="'mdi:pencil'" @click="open.value = true" />
              </LazyArticleEdit>
              <LazyArticleTag v-slot="{ open }" :articleId="row.original.id" hydrateOnInteraction>
                <Button :icon="'mdi:tag-outline'" variant="warning" @click="open.value = true" />
              </LazyArticleTag>
              <Button :icon="'mdi:delete'" variant="danger" @click="del(row.original.id)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="articles.data.length > 0" class="sm:hidden space-y-4">
      <div
        v-for="row in table.getRowModel().rows"
        :key="row.id"
        :class="[
          'p-4 rounded-lg border border-gray-300 shadow-sm transition-colors duration-200 hover:bg-gray-100',
          row.original.status === 'published'
            ? 'bg-green-50 border-l-4 border-green-400'
            : 'bg-white border-l-4 border-yellow-400',
        ]"
      >
        <div class="space-y-2">
          <div
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            class="text-gray-800"
            :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
          >
            <div class="font-semibold">{{ $t(`articles.columns.${cell.column.id}`) }}</div>
            <div
              v-if="cell.column.id === 'content'"
              class="line-clamp-3 dark:bg-transparent"
              v-html="cell.getValue() as string"
            ></div>
            <div v-else-if="cell.column.id === 'imageUrl'" class="flex justify-center dark:bg-transparent">
              <NuxtImg
                v-if="cell.getValue()"
                :src="cell.getValue() as string"
                :alt="$t('articles.columns.imageUrl')"
                class="w-16 h-16 object-cover rounded"
              />
              <Icon v-else name="mdi:image-off" class="w-16 h-16 text-gray-400" />
            </div>
            <div
              v-else-if="cell.column.id === 'status'"
              class="dark:bg-transparent"
              :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </div>
            <div
              v-else-if="['title', 'date'].includes(cell.column.id)"
              class="dark:bg-transparent"
              :class="row.original.status === 'published' ? 'dark:text-green-300' : ''"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </div>
            <div v-else class="dark:bg-transparent">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </div>
          </div>
          <div :ref="(el) => setDropdownRef(row.id, el)" class="relative">
            <button
              class="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full hover:from-gray-300 hover:to-gray-400 transition shadow-sm hover:shadow-md transform hover:scale-105"
              @click="toggleDropdown(row.id)"
            >
              <Icon name="mdi:dots-vertical" class="w-5 h-5 text-black" />
            </button>
            <div
              v-if="openDropdown === row.id"
              class="absolute z-10 right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 animate-slide-in"
            >
              <div class="py-1">
                <Button
                  :icon="'mdi:eye'"
                  variant="success"
                  @click="router.push(localePath({ name: 'clanky-slug', params: { slug: row.original.slug } }))"
                />
                <LazyArticleEdit v-slot="{ open }" :article="row.original" hydrateOnInteraction @saved="refresh">
                  <Button :icon="'mdi:pencil'" @click="open.value = true" />
                </LazyArticleEdit>
                <LazyArticleTag v-slot="{ open }" :articleId="row.original.id" hydrateOnInteraction>
                  <Button :icon="'mdi:tag-outline'" variant="warning" @click="open.value = true" />
                </LazyArticleTag>
                <Button :icon="'mdi:delete'" variant="danger" @click="del(row.original.id)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Pagination :page :totalPages :prevPage :nextPage class="mt-6" />
  </div>
</template>

<script setup lang="ts">
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'

import Swal from 'sweetalert2'
import { format } from 'date-fns'
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import {
  type ColumnDef,
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'

import ArticleStatusCell from '~/components/Article/StatusCell.vue'
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { onArticleCreated, emitArticleDeleted } = useArticleEvent()
const localePath = useLocalePath()
const page = shallowRef(Number(route.query.page) || 1)
const limit = 20
const globalFilter = shallowRef((route.query.query as string) || '')
const { data: articles, refresh } = await useFetch<{ data: Article[]; total: number }>(
  () =>
    `/api/articles/search?page=${page.value}&limit=${limit}${globalFilter.value ? `&query=${encodeURIComponent(globalFilter.value)}` : ''}`,
  {
    default: () => ({ data: [], total: 0 }),
    watch: [page, globalFilter],
  },
)

const totalPages = computed(() => Math.ceil((articles.value?.total || 0) / limit))

const prevPage = () => {
  if (page.value > 1) {
    page.value--
    router.push({ query: { ...route.query, page: page.value, query: globalFilter.value || undefined } })
  }
}

const nextPage = () => {
  if (page.value < totalPages.value) {
    page.value++
    router.push({ query: { ...route.query, page: page.value, query: globalFilter.value || undefined } })
  }
}

const debouncedRefresh = useDebounceFn(() => {
  page.value = 1
  router.push({ query: { ...route.query, page: 1, query: globalFilter.value || undefined } })
}, 400)

watch(globalFilter, debouncedRefresh)

const openDropdown = shallowRef<string | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

function toDom(el: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (!el) return null
  if (el instanceof HTMLElement) return el
  const root = (el as any)?.$el
  return root instanceof HTMLElement ? root : null
}

function setDropdownRef(id: string, el: Element | ComponentPublicInstance | null) {
  const dom = toDom(el)
  if (openDropdown.value === id) dropdownRef.value = dom
}

onClickOutside(dropdownRef, () => {
  openDropdown.value = null
  dropdownRef.value = null
})

const debouncedSetStatus = useDebounceFn(async (id: string, status: ArticleStatus) => {
  try {
    await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
    await refresh()
    toast.success({
      message: `Status changed to ${status === 'draft' ? $t('articles.status.draft').toLocaleLowerCase() : $t('articles.status.published').toLocaleLowerCase()}`,
    })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.messages.statusChangeFailed') })
  }
}, 100)

async function del(id: string) {
  const confirm = await Swal.fire({
    title: $t('common.messages.deleteConfirmTitle'),
    text: $t('common.messages.deleteConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.actions.delete'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (!confirm.isConfirmed) return

  try {
    await $fetch(`/api/articles/${id}`, { method: 'DELETE' })
    toast.success({ message: $t('articles.messages.deleteSuccess') })
    emitArticleDeleted()
    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.messages.deleteFailed') })
  }
}

const columns: ColumnDef<Article>[] = [
  {
    header: $t('articles.columns.imageUrl'),
    accessorKey: 'imageUrl',
    enableSorting: false,
  },
  {
    header: $t('articles.columns.title'),
    accessorKey: 'title',
  },
  {
    header: $t('articles.columns.status'),
    accessorKey: 'status',
    cell: ({ row }) =>
      h(ArticleStatusCell, {
        row,
        onUpdate: (id: string, status: ArticleStatus) => debouncedSetStatus(id, status),
      }),
  },
  {
    header: $t('articles.columns.date'),
    accessorKey: 'createdAt',
    cell: (info) => format(new Date(info.getValue() as string), 'dd.MM.yyyy, HH:mm'),
    sortingFn: (rowA, rowB, columnId) => {
      const dateA = new Date(rowA.getValue(columnId) as string).getTime()
      const dateB = new Date(rowB.getValue(columnId) as string).getTime()
      return dateA - dateB
    },
  },
]

const table = useVueTable({
  get data() {
    return articles.value?.data || []
  },
  columns,
  state: {
    get globalFilter() {
      return globalFilter.value
    },
  },
  onGlobalFilterChange: (u) => (globalFilter.value = typeof u === 'function' ? u(globalFilter.value) : u),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

onArticleCreated(refresh)

function toggleDropdown(id: string) {
  if (openDropdown.value === id) {
    openDropdown.value = null
    dropdownRef.value = null
  } else {
    openDropdown.value = id
  }
}
</script>

<style>
.animate-slide-in {
  animation: slideIn 0.2s ease-out forwards;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
