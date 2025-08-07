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
              <template v-if="!header.isPlaceholder">
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />

                <Icon class="text-black" v-if="header.column.getIsSorted() === 'asc'" name="mdi:arrow-up" />
                <Icon class="text-black" v-else-if="header.column.getIsSorted() === 'desc'" name="mdi:arrow-down" />
              </template>
            </th>
            <th class="px-4 py-2 text-center">Akce</th>
          </tr>
        </thead>

        <tbody class="text-gray-800">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="[
              'transition-colors duration-200 hover:bg-gray-100 group',
              row.original.deletedAt ? 'bg-red-50 border-l-4 border-red-500' : 'bg-white border-l-4 border-yellow-400',
            ]"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2 break-words max-w-[180px] sm:max-w-none text-center"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              <p
                v-if="cell.column.id === 'name'"
                class="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                :class="row.original.deletedAt ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'"
              >
                {{ row.original.deletedAt ? 'Deaktivovaný' : 'Aktivní' }}
              </p>
            </td>
            <td class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-green-200 to-green-300 text-gray-800 rounded-full hover:from-green-300 hover:to-green-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="clientId = row.original.id"
              >
                <Icon name="mdi:eye" class="w-5 h-5 text-black" />
              </button>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="editingClient = row.original"
              >
                <Icon name="mdi:pencil" class="w-5 h-5 text-black" />
              </button>
              <button
                v-if="!row.original.deletedAt"
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 text-gray-800 rounded-full hover:from-red-300 hover:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="del(row.original.id)"
              >
                <Icon name="mdi:lock" class="w-5 h-5 text-black" />
              </button>
              <button
                v-else
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-yellow-200 to-yellow-300 text-gray-800 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="restore(row.original.id)"
              >
                <Icon name="mdi:lock-open" class="w-5 h-5 text-black" />
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

import Swal from 'sweetalert2'
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
  query: { deleted: false },
})

const columns = ref<ColumnDef<ClientSite>[]>([
  {
    header: 'Název',
    accessorKey: 'name',
    id: 'name',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Subdoména',
    accessorKey: 'subdomain',
    cell: (info) => info.getValue(),
  },
  {
    header: 'Plán',
    id: 'plan',
    accessorKey: 'plan',
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
  onGlobalFilterChange: (val) => (globalFilter.value = typeof val === 'function' ? val(globalFilter.value) : val),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})

const del = async (id: string) => {
  const result = await Swal.fire({
    title: 'Deaktivovat klienta?',
    text: 'Klient bude deaktivován.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, deaktivovat',
    cancelButtonText: 'Ne',
    background: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
  })
  if (!result.isConfirmed) return

  try {
    await $fetch(`/api/clients/${id}`, { method: 'DELETE' })

    toast.success({ message: 'Klient deaktivován' })

    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Deaktivace selhala' })
  }
}

const restore = async (id: string) => {
  const result = await Swal.fire({
    title: 'Aktivovat klienta?',
    text: 'Klient bude aktivován.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ano, aktivovat',
    cancelButtonText: 'Ne',
    background: '#fff',
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#6b7280',
  })
  if (!result.isConfirmed) return

  try {
    await $fetch(`/api/clients/${id}`, { method: 'PATCH', body: { deletedAt: null } })

    toast.success({ message: 'Klient aktivován' })

    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Aktivace selhala' })
  }
}
</script>
