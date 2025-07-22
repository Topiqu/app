<template>
  <div class="space-y-4">
    <div class="flex justify-center">
      <div class="relative w-full max-w-xs sm:max-w-xl">
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
      <table class="min-w-full table-fixed text-sm divide-y divide-gray-200">
        <thead class="bg-gray-100 text-left font-semibold text-gray-600">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              class="px-4 py-2 text-center select-none cursor-pointer"
              @click="
                (event) => header.column.getToggleSortingHandler()?.(event)
              "
            >
              <span v-if="!header.isPlaceholder">
                <FlexRender
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <span v-if="header.column.getIsSorted() === 'asc'">
                  <Icon name="mdi:arrow-up" />
                </span>
                <span v-else-if="header.column.getIsSorted() === 'desc'">
                  <Icon name="mdi:arrow-down" />
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
              class="px-4 py-2 break-words max-w-[180px] sm:max-w-none text-center"
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
            <td
              class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center"
            >
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-green-200 to-green-300 text-gray-800 rounded-full hover:from-green-300 hover:to-green-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="router.push(`/articles/${row.original.slug}`)"
              >
                <Icon name="mdi:eye" class="w-5 h-5" />
              </button>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="editingArticle = row.original"
              >
                <Icon name="mdi:pencil" class="w-5 h-5" />
              </button>
              <button
                class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-yellow-200 to-yellow-300 text-gray-800 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="editingTags = row.original.id"
              >
                <Icon name="mdi:tag-outline" class="w-5 h-5" />
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

  <TransitionRoot :show="!!editingArticle" as="template">
    <ArticleEdit
      :article="editingArticle!"
      @close="editingArticle = null"
      @saved="refresh"
    />
  </TransitionRoot>
  <TransitionRoot :show="!!editingTags" as="template">
    <ArticleTag :article-id="editingTags!" @close="editingTags = null" />
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
import { useDebounceFn } from '@vueuse/core'
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
import Swal from 'sweetalert2'
import { useRouter } from 'vue-router'
import ArticleStatusCell from '~/components/Article/StatusCell.vue'

const router = useRouter()
const toast = useToast()

const { data: articles, refresh } = await useFetch<Article[]>('/api/articles', {
  default: () => [],
})

const editingArticle = ref<Article | null>(null)
const editingTags = ref<string | null>(null)
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
        onUpdate: (id: string, status: ArticleStatus) =>
          debouncedSetStatus(id, status),
      }),
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

const debouncedSetStatus = useDebounceFn(
  async (id: string, status: ArticleStatus) => {
    try {
      await $fetch(`/api/articles/${id}/status`, {
        method: 'PATCH',
        body: { status },
      })
      await refresh()
      toast.success({
        message: `Stav změněn na ${status === 'draft' ? 'návrh' : 'publikováno'}`,
      })
    } catch (e: any) {
      toast.error({ message: e.data?.message || 'Změna stavu selhala' })
    }
  },
  100,
)
</script>
