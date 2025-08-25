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
          placeholder="Hledat články..."
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
            >
              <span v-if="!header.isPlaceholder" class="text-black flex items-center justify-center gap-2">
                <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                <span v-if="header.column.getCanSort()" class="opacity-0 group-hover:opacity-100 transition-opacity">
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
        <tbody class="text-gray-800">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="[
              'transition-colors duration-200 hover:bg-gray-100 group',
              row.original.status === 'published'
                ? 'bg-green-50 border-l-4 border-green-400'
                : 'bg-white border-l-4 border-yellow-400',
            ]"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-2 break-words max-w-[240px] sm:max-w-none text-center min-h-[72px]"
            >
              <div v-if="cell.column.id === 'content'" v-html="cell.getValue() as string" class="line-clamp-3"></div>
              <div v-else-if="cell.column.id === 'imageUrl'" class="flex items-center justify-center h-full">
                <NuxtImg
                  v-if="cell.getValue()"
                  :src="cell.getValue() as string"
                  alt="Titulní obrázek"
                  class="w-16 h-16 object-cover rounded"
                />
                <Icon v-else name="mdi:image-off" class="w-16 h-16 text-gray-400" />
              </div>
              <div v-else class="flex items-center justify-center h-full">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </div>
            </td>
            <td
              class="px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-4 min-h-[72px]"
            >
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-green-200 to-green-300 rounded-full hover:from-green-300 hover:to-green-400 transition shadow-sm hover:shadow-md transform hover:scale-105"
                @click="router.push(`/clanky/${row.original.slug}`)"
              >
                <Icon name="mdi:eye" class="w-5 h-5 text-black" />
              </button>
              <LazyArticleEdit v-slot="{ open }" :article="row.original" hydrateOnInteraction @saved="refresh">
                <button
                  class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full hover:from-blue-300 hover:to-blue-400 transition shadow-sm hover:shadow-md transform hover:scale-105"
                  @click="open.value = true"
                >
                  <Icon name="mdi:pencil" class="w-5 h-5 text-black" />
                </button>
              </LazyArticleEdit>
              <LazyArticleTag v-slot="{ open }" :articleId="row.original.id" hydrateOnInteraction>
                <button
                  class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-yellow-200 to-yellow-300 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition shadow-sm hover:shadow-md transform hover:scale-105"
                  @click="open.value = true"
                >
                  <Icon name="mdi:tag-outline" class="w-5 h-5 text-black" />
                </button>
              </LazyArticleTag>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 rounded-full hover:from-red-300 hover:to-red-400 transition shadow-sm hover:shadow-md transform hover:scale-105"
                @click="del(row.original.id)"
              >
                <Icon name="mdi:delete" class="w-5 h-5 text-black" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="sm:hidden space-y-4">
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
          <div v-for="cell in row.getVisibleCells()" :key="cell.id" class="text-gray-800">
            <div class="font-semibold">{{ cell.column.columnDef.header }}</div>
            <div v-if="cell.column.id === 'content'" v-html="cell.getValue() as string" class="line-clamp-3"></div>
            <div v-else-if="cell.column.id === 'imageUrl'" class="flex justify-center">
              <NuxtImg
                v-if="cell.getValue()"
                :src="cell.getValue() as string"
                alt="Titulní obrázek"
                class="w-16 h-16 object-cover rounded"
              />
              <Icon v-else name="mdi:image-off" class="w-16 h-16 text-gray-400" />
            </div>
            <div v-else>
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
                <button
                  class="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-green-100"
                  @click="router.push(`/clanky/${row.original.slug}`)"
                >
                  <Icon name="mdi:eye" class="w-5 h-5 mr-2" />
                  Zobrazit
                </button>
                <LazyArticleEdit v-slot="{ open }" :article="row.original" hydrateOnInteraction @saved="refresh">
                  <button
                    class="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-blue-100"
                    @click="open.value = true"
                  >
                    <Icon name="mdi:pencil" class="w-5 h-5 mr-2" />
                    Upravit
                  </button>
                </LazyArticleEdit>
                <LazyArticleTag v-slot="{ open }" :articleId="row.original.id" hydrateOnInteraction>
                  <button
                    class="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-yellow-100"
                    @click="open.value = true"
                  >
                    <Icon name="mdi:tag-outline" class="w-5 h-5 mr-2" />
                    Tagy
                  </button>
                </LazyArticleTag>
                <button
                  class="flex items-center w-full px-4 py-2 text-sm text-gray-800 hover:bg-red-100"
                  @click="del(row.original.id)"
                >
                  <Icon name="mdi:delete" class="w-5 h-5 mr-2" />
                  Smazat
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'

import Swal from 'sweetalert2'
import { format } from 'date-fns'
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
const toast = useToast()
const { onArticleCreated } = useArticleEvent()

const { data: articles, refresh } = await useFetch<Article[]>('/api/articles', { default: () => [] })

const globalFilter = shallowRef('')
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
    toast.success({ message: `Stav změněn na ${status === 'draft' ? 'návrh' : 'publikováno'}` })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Změna stavu selhala' })
  }
}, 100)

async function del(id: string) {
  const confirm = await Swal.fire({
    title: 'Opravdu smazat?',
    text: 'Tuto akci nelze vrátit zpět.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Smazat',
    cancelButtonText: 'Zrušit',
    confirmButtonColor: '#ef4444',
  })
  if (!confirm.isConfirmed) return

  try {
    await $fetch(`/api/articles/${id}`, { method: 'DELETE' })
    articles.value = articles.value.filter((a) => a.id !== id)
    toast.success({ message: 'Článek smazán' })
    refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Smazání selhalo' })
  }
}

const columns: ColumnDef<Article>[] = [
  { header: 'Obrázek', accessorKey: 'imageUrl' },
  { header: 'Název', accessorKey: 'title' },
  {
    header: 'Stav',
    accessorKey: 'status',
    cell: ({ row }) =>
      h(ArticleStatusCell, {
        row,
        onUpdate: (id: string, status: ArticleStatus) => debouncedSetStatus(id, status),
      }),
  },
  {
    header: 'Datum',
    accessorKey: 'createdAt',
    cell: (info) => format(new Date(info.getValue() as string), 'dd.MM.yyyy, HH:mm'),
  },
]

const table = useVueTable({
  get data() {
    return articles.value
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
