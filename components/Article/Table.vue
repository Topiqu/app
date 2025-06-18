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
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  type ColumnDef,
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'

type Article = {
  id: number
  title: string
  status: string
  createdAt: string
}

const data = ref<Article[]>([
  {
    id: 1,
    title: 'Placeholder Article 1',
    status: 'Draft',
    createdAt: '2025-06-15',
  },
  {
    id: 2,
    title: 'Placeholder Article 2',
    status: 'Published',
    createdAt: '2025-06-14',
  },
  {
    id: 3,
    title: 'Placeholder Article 3',
    status: 'Pending',
    createdAt: '2025-06-13',
  },
])

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
  },
  {
    header: 'Datum',
    accessorKey: 'createdAt',
  },
  {
    header: 'Akce',
    cell: () => '✏️ 🗑️',
  },
])

const table = useVueTable({
  get data() {
    return data.value
  },
  get columns() {
    return columns.value
  },
  state: {
    get globalFilter() {
      return globalFilter.value
    },
  },
  onGlobalFilterChange: (updater) => {
    const next =
      typeof updater === 'function' ? updater(globalFilter.value) : updater
    globalFilter.value = next
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
</script>
