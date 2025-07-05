<template>
  <div class="space-y-4">
    <input
      v-model="globalFilter"
      type="text"
      placeholder="🔍 Hledat články..."
      class="w-full rounded border px-3 py-2 shadow-sm focus:outline-none focus:ring"
    />

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
            class="hover:bg-gray-50"
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
import type { Article } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
const toast = useToast()
const { data: articles, refresh } = await useFetch<Article[]>('/api/articles', {
  default: () => [],
})

const editingArticle = ref<Article | null>(null)
const globalFilter = ref('')
const columns = ref<ColumnDef<Article>[]>([
  { header: 'Název', accessorKey: 'title', cell: (i) => i.getValue() },
  { header: 'Stav', accessorKey: 'status' },
  {
    header: 'Obsah',
    accessorKey: 'content',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Datum',
    accessorKey: 'createdAt',
    cell: (i) => format(new Date(i.getValue() as string), 'dd.MM.yyyy,HH:mm'),
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
</script>
