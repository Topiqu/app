<template>
  <div class="space-y-4">
    <div class="flex justify-center">
      <div class="relative w-full max-w-xl">
        <span
          class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none"
        >
          <Icon name="material-symbols:search-rounded" />
        </span>
        <input
          v-model="globalFilter"
          type="text"
          placeholder="Hledat články..."
          class="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
        />
      </div>
    </div>
    <div class="overflow-x-auto rounded border border-gray-300">
      <table class="min-w-full divide-y divide-gray-200 text-sm">
        <thead class="bg-gray-100 text-left font-semibold text-gray-600">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="cursor-pointer px-4 py-2 select-none"
              @click="
                (event) => header.column.getToggleSortingHandler()?.(event)
              "
            >
              <span v-if="!header.isPlaceholder">
                <FlexRender
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getIsSorted() === 'asc'">🔼</span>
                <span v-else-if="header.column.getIsSorted() === 'desc'"
                  >🔽</span
                >
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="text-gray-800">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="[
              'transition-colors duration-200 hover:bg-gray-100',
              row.original.status === 'published'
                ? 'bg-green-50 border-l-4 border-green-400'
                : 'bg-white border-l-4 border-yellow-400',
            ]"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2"
            >
              <div
                v-if="cell.column.id === 'content'"
                v-html="cell.getValue() as string"
              ></div>
              <FlexRender
                v-else
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
            <td class="px-4 py-2 flex gap-2">
              <button
                class="text-blue-500"
                @click="editingArticle = row.original"
              >
                ✏️
              </button>
              <button class="text-red-500" @click="del(row.original.id)">
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <TransitionRoot :show="!!editingArticle" as="template">
    <ArticleEdit
      :article="editingArticle!"
      @close="editingArticle = null"
      @saved="refresh"
    />
  </TransitionRoot>
</template>

<script setup lang="ts">
import { TransitionRoot } from '@headlessui/vue'
import {
  type ColumnDef,
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
import ArticleStatusCell from '~/components/Article/StatusCell.vue'
const toast = useToast()

const { data: articles, refresh } = await useFetch<Article[]>('/api/articles', {
  default: () => [],
})

const editingArticle = ref<Article | null>(null)
const globalFilter = ref('')

const columns = ref<ColumnDef<Article>[]>([
  {
    header: 'Název',
    accessorKey: 'title',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Stav',
    accessorKey: 'status',
    cell: ({ row }) =>
      h(ArticleStatusCell, {
        row,
        onUpdate: (id: string, status: ArticleStatus) => setStatus(id, status),
      }),
  },
  {
    header: 'Obsah',
    accessorKey: 'content',
    cell: (info) =>
      (info.getValue() as string).replace(/<[^>]+>/g, '').slice(0, 256),
  },
  {
    header: 'Datum',
    accessorKey: 'createdAt',
    cell: (info) =>
      format(new Date(info.getValue() as string), 'dd.MM.yyyy,HH:mm'),
  },
])

const table = useVueTable({
  get data() {
    return articles.value || []
  },
  get columns() {
    return columns.value
  },
  state: {
    get globalFilter() {
      return globalFilter.value
    },
  },
  onGlobalFilterChange: (u) =>
    (globalFilter.value = typeof u === 'function' ? u(globalFilter.value) : u),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

async function del(id: string) {
  try {
    await $fetch(`/api/articles/${id}`, { method: 'DELETE' })
    articles.value = articles.value.filter((a) => a.id !== id)
    toast.success({ message: 'Článek smazán' })
    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Smazání selhalo' })
  }
}

async function setStatus(id: string, status: ArticleStatus) {
  try {
    await $fetch(`/api/articles/${id}/status`, {
      method: 'PATCH',
      body: { status },
    })

    await refresh()

    articles.value = [...articles.value]

    toast.success({
      message: `Stav změněn na ${status === 'draft' ? 'drafted' : 'published'}`,
    })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Změna stavu selhala' })
  }
}
</script>
