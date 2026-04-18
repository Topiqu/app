<template>
  <div class="mb-10 space-y-4 px-4 sm:px-6 lg:px-8">
    <div class="flex justify-center">
      <div class="w-full max-w-xs sm:max-w-xl">
        <FormInput
          v-model="globalFilter"
          type="text"
          :placeholder="$t('master.clientTable.search')"
          icon="material-symbols:search-rounded"
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
            <th class="px-2 sm:px-4 py-2 text-center min-h-[48px]">{{ $t('master.clientTable.headers.actions') }}</th>
          </tr>
        </thead>
        <tbody v-auto-animate class="text-gray-800 dark:text-gray-200 divide-y divide-gray-200">
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2 break-words max-w-[240px] sm:max-w-none text-center min-h-[72px]"
            >
              <div class="flex items-center justify-center h-full">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                <p
                  v-if="cell.column.id === 'name'"
                  class="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="row.original.deletedAt ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'"
                >
                  {{
                    row.original.deletedAt
                      ? $t('master.clientTable.status.deactivated')
                      : $t('master.clientTable.status.active')
                  }}
                </p>
              </div>
            </td>
            <td
              class="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 min-h-[72px]"
            >
              <LazyClientUsers v-slot="{ open }" :clientId="row.original.id" hydrateOnInteraction>
                <Button icon="mdi:eye" variant="success" @click="open.value = true" />
              </LazyClientUsers>
              <LazyClientEdit v-slot="{ open }" :client="row.original" hydrateOnInteraction @saved="refresh">
                <Button icon="mdi:pencil" variant="primary" @click="open.value = true" />
              </LazyClientEdit>
              <Button
                v-if="!row.original.deletedAt"
                icon="mdi:delete"
                variant="danger"
                @click="del(row.original.id, row.original.name)"
              />
              <Button v-else icon="mdi:lock-open" variant="warning" @click="restore(row.original.id)" />
            </td>
          </tr>
        </tbody>
      </table>
      <Pagination :page="page" :totalPages="totalPages" :prevPage="prevPage" :nextPage="nextPage" class="mt-6" />
    </div>
    <div class="sm:hidden space-y-4">
      <div
        v-for="row in table.getRowModel().rows"
        :key="row.id"
        :class="[
          'p-4 rounded-lg border border-gray-300 shadow-sm transition-colors duration-200 hover:bg-gray-100',
          row.original.deletedAt ? 'bg-red-50 border-l-4 border-red-500' : 'bg-green-50 border-l-4 border-green-400',
        ]"
      >
        <div class="space-y-2">
          <div v-for="cell in row.getVisibleCells()" :key="cell.id">
            <div class="font-semibold">{{ cell.column.columnDef.header }}</div>
            <div class="flex items-center justify-center h-full">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              <p
                v-if="cell.column.id === 'name'"
                class="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                :class="row.original.deletedAt ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'"
              >
                {{
                  row.original.deletedAt
                    ? $t('master.clientTable.status.deactivated')
                    : $t('master.clientTable.status.active')
                }}
              </p>
            </div>
          </div>
          <div :ref="(el) => setDropdownRef(row.id, el)" class="relative">
            <Button icon="mdi:dots-vertical" @click="toggleDropdown(row.id)" />
            <div
              v-if="openDropdown === row.id"
              class="absolute z-10 right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 animate-slide-in"
            >
              <div class="py-1">
                <LazyClientUsers v-slot="{ open }" :clientId="row.original.id" hydrateOnInteraction>
                  <Button icon="mdi:eye" variant="success" @click="open.value = true" />
                </LazyClientUsers>
                <LazyClientEdit v-slot="{ open }" :client="row.original" hydrateOnInteraction @saved="refresh">
                  <Button icon="mdi:pencil" variant="primary" @click="open.value = true" />
                </LazyClientEdit>
                <Button
                  v-if="!row.original.deletedAt"
                  icon="mdi:lock"
                  variant="danger"
                  @click="del(row.original.id, row.original.name)"
                >
                  {{ $t('master.clientTable.actions.deleteDeactivate') }}
                </Button>
                <Button v-else icon="mdi:lock-open" @click="restore(row.original.id)">
                  {{ $t('master.clientTable.actions.activate') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClientSite } from '@zenstackhq/runtime/models'

import Swal from 'sweetalert2'
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import {
  type ColumnDef,
  FlexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'

const { t } = useI18n()
const { onClientCreated, onClientDeleted } = useClientEvent()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const openDropdown = ref<string | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const limit = 20
const page = shallowRef(Number(route.query.page) || 1)
const globalFilter = shallowRef((route.query.query as string) || '')

const { data: clients, refresh } = await useFetch<{ data: ClientSite[]; total: number }>(
  () =>
    `/api/clients?page=${page.value}&limit=${limit}${globalFilter.value ? `&query=${encodeURIComponent(globalFilter.value)}` : ''}`,
  {
    default: () => ({ data: [], total: 0 }),
    watch: [page, globalFilter],
  },
)

const totalPages = computed(() => Math.ceil((clients.value?.total || 0) / limit))

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

const columns = ref<ColumnDef<ClientSite>[]>([
  {
    header: () => t('master.clientTable.headers.name'),
    accessorKey: 'name',
    id: 'name',
    cell: (info) => info.getValue(),
  },
  {
    header: () => t('master.clientTable.headers.domain'),
    accessorKey: 'domain',
    cell: (info) => info.getValue(),
  },
  {
    header: () => t('master.clientTable.headers.plan'),
    id: 'plan',
    accessorKey: 'plan',
    cell: (info) => info.getValue(),
  },
  {
    header: () => t('master.clientTable.headers.createdAt'),
    accessorKey: 'createdAt',
    cell: (info) =>
      new Date(info.getValue() as string).toLocaleString(
        t('master.clientTable.headers.name') === 'Název' ? 'cs-CZ' : 'en-US',
      ),
  },
])

const table = useVueTable({
  get data() {
    return clients.value.data || []
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

const del = async (id: string, name: string) => {
  const result = await Swal.fire({
    title: t('master.clientTable.deleteDialog.title', { name }),
    text: t('master.clientTable.deleteDialog.text'),
    icon: 'warning',
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: t('master.clientTable.deleteDialog.confirm'),
    denyButtonText: t('master.clientTable.deleteDialog.deny'),
    cancelButtonText: t('master.clientTable.deleteDialog.cancel'),
    background: '#fff',
    confirmButtonColor: '#ef4444',
    denyButtonColor: '#f97316',
    cancelButtonColor: '#6b7280',
  })

  if (result.isConfirmed) {
    try {
      await $fetch(`/api/clients/${id}?hard=true` as `api/clients/:id`, { method: 'DELETE' })

      toast.success({ message: t('master.clientTable.messages.permanentlyDeleted') })

      await refresh()
    } catch (e: any) {
      toast.error({ message: e.data?.message || t('master.clientTable.messages.deleteFailed') })
    }
  } else if (result.isDenied) {
    try {
      await $fetch(`/api/clients/${id}` as `api/clients/:id`, { method: 'DELETE' })

      toast.success({ message: t('master.clientTable.messages.deactivated') })

      await refresh()
    } catch (e: any) {
      toast.error({ message: e.data?.message || t('master.clientTable.messages.deactivateFailed') })
    }
  }
}

onClientCreated(refresh)
onClientDeleted(refresh)

const restore = async (id: string) => {
  const result = await Swal.fire({
    title: t('master.clientTable.activateDialog.title'),
    text: t('master.clientTable.activateDialog.text'),
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: t('master.clientTable.activateDialog.confirm'),
    cancelButtonText: t('master.clientTable.activateDialog.cancel'),
    background: '#fff',
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#6b7280',
  })
  if (!result.isConfirmed) return

  try {
    await $fetch(`/api/clients/${id}` as `api/clients/:id`, { method: 'PATCH', body: { deletedAt: null } })

    toast.success({ message: t('master.clientTable.messages.activated') })

    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.clientTable.messages.activateFailed') })
  }
}

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
