<template>
  <div class="space-y-4">
    <div class="flex justify-center">
      <div class="relative w-full max-w-xs sm:max-w-xl">
        <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
          <Icon name="material-symbols:search-rounded" />
        </span>
        <input
          v-model="globalFilter"
          type="text"
          placeholder="Hledat klienty..."
          class="w-full pl-10 pr-4 py-2 rounded-full border border-gray-300 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
        />
      </div>
    </div>

    <div class="overflow-x-auto rounded border border-gray-300">
      <table class="min-w-full table-fixed text-sm divide-y divide-gray-200">
        <thead class="bg-gray-100 text-left font-semibold text-gray-600">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-4 py-2 text-center select-none cursor-pointer"
              @click="(event) => header.column.getToggleSortingHandler()?.(event)"
            >
              <span v-if="!header.isPlaceholder">
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <span v-if="header.column.getIsSorted() === 'asc'">
                  <Icon name="mdi:arrow-up" />
                </span>
                <span v-else-if="header.column.getIsSorted() === 'desc'">
                  <Icon name="mdi:arrow-down" />
                </span>
              </span>
            </th>
            <th class="px-4 py-2 text-center">Akce</th>
          </tr>
        </thead>

        <tbody class="text-gray-800">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="['transition-colors duration-200 hover:bg-gray-100 group bg-white border-l-4 border-yellow-400']"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2 break-words max-w-[180px] sm:max-w-none text-center"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
            <td class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-green-200 to-green-300 text-gray-800 rounded-full hover:from-green-300 hover:to-green-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="clientId = row.original.id"
              >
                <Icon name="mdi:eye" class="w-5 h-5" />
              </button>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="editingClient = row.original"
              >
                <Icon name="mdi:pencil" class="w-5 h-5" />
              </button>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 text-gray-800 rounded-full hover:from-red-300 hover:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="del(row.original.id)"
              >
                <Icon name="mdi:delete" class="w-5 h-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <TransitionRoot :show="!!editingClient" as="template">
    <ClientEdit :client="editingClient!" @close="editingClient = null" @saved="refresh" />
  </TransitionRoot>
  <TransitionRoot :show="!!clientId" as="template">
    <ClientUsers :clientId="clientId!" @close="clientId = null" />
  </TransitionRoot>
</template>

<script setup lang="ts">
import type { ClientSite } from '@zenstackhq/runtime/models'

import { ClientUsers } from '#components'
import { TransitionRoot } from '@headlessui/vue'
import {
  type ColumnDef,
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
const toast = useToast()

const globalFilter = ref('')
const editingClient = ref<ClientSite | null>(null)
const clientId = ref<string | null>(null)

const { data: clients, refresh } = await useFetch<ClientSite[]>('/api/clients', {
  default: () => [],
})

const columns = ref<ColumnDef<ClientSite>[]>([
  {
    header: 'Název',
    accessorKey: 'name',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Subdoména',
    accessorKey: 'subdomain',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Vytvořeno',
    accessorKey: 'createdAt',
    cell: (info) => new Date(info.getValue() as string).toLocaleString('cs-CZ'),
  },
])

const table = useVueTable({
  get data() {
    return clients.value || []
  },
  get columns() {
    return columns.value
  },
  state: {
    get globalFilter() {
      return globalFilter.value
    },
  },
  onGlobalFilterChange: (val) => {
    globalFilter.value = typeof val === 'function' ? val(globalFilter.value) : val
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

const del = async (id: string) => {
  try {
    await $fetch(`/api/clients/${id}`, { method: 'DELETE' })
    toast.success({ message: 'Klient smazán' })
    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Smazání selhalo' })
  }
}
</script>
