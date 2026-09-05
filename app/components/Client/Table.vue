<template>
  <div ref="listOrigin" class="flex min-h-0 w-full flex-1 flex-col gap-4 sm:overflow-hidden" data-client-table>
    <div class="shrink-0 space-y-3 border-b border-default bg-default py-3" data-client-table-toolbar>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <UFormField
          :label="$t('master.clientTable.search')"
          :ui="{ label: 'sr-only' }"
          class="w-full min-w-0 sm:flex-1"
        >
          <UInput
            v-model="globalFilter"
            type="search"
            :placeholder="$t('master.clientTable.search')"
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
      </div>
      <div
        v-show="filtersOpen"
        class="grid gap-3 rounded-(--topiqu-surface-radius) border border-default p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <UFormField :label="$t('master.clientTable.headers.domain')"><UInput v-model="domainFilter" /></UFormField>
        <UFormField :label="$t('master.clientTable.headers.plan')"
          ><USelect v-model="planFilter" :items="planItems"
        /></UFormField>
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

    <UEmpty v-else-if="!isRefetching && rows.length === 0" icon="mdi:domain-off" :title="$t('common.noResults')" />

    <div
      v-else
      class="hidden min-h-0 flex-1 overflow-auto rounded-(--topiqu-surface-radius) border border-default bg-default sm:block"
      :aria-busy="isRefetching"
    >
      <UTable
        :data="rows"
        :columns="columns"
        :loading="isRefetching"
        :ui="{
          root: 'overflow-visible',
          base: 'w-full min-w-[52rem] table-fixed',
          thead: 'sticky top-0 z-20 bg-default shadow-[0_1px_0_var(--ui-border)]',
        }"
      >
        <template #name-header>
          <UButton color="neutral" variant="ghost" :trailingIcon="sortIcon('name')" @click="toggleSort('name')">
            {{ t('master.clientTable.headers.name') }}
          </UButton>
        </template>
        <template #domain-header>
          <UButton color="neutral" variant="ghost" :trailingIcon="sortIcon('domain')" @click="toggleSort('domain')">
            {{ t('master.clientTable.headers.domain') }}
          </UButton>
        </template>
        <template #plan-header>
          <UButton color="neutral" variant="ghost" :trailingIcon="sortIcon('plan')" @click="toggleSort('plan')">
            {{ t('master.clientTable.headers.plan') }}
          </UButton>
        </template>
        <template #createdAt-header>
          <UButton
            color="neutral"
            variant="ghost"
            :trailingIcon="sortIcon('createdAt')"
            @click="toggleSort('createdAt')"
          >
            {{ t('master.clientTable.headers.createdAt') }}
          </UButton>
        </template>
        <template #name-cell="{ row }">
          <span class="block truncate font-medium" :title="row.original.name">{{ row.original.name }}</span>
        </template>
        <template #domain-cell="{ row }">
          <span class="block truncate" :title="row.original.domain">{{ row.original.domain }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.deletedAt ? 'error' : 'success'" variant="subtle">
            {{
              row.original.deletedAt
                ? $t('master.clientTable.status.deactivated')
                : $t('master.clientTable.status.active')
            }}
          </UBadge>
        </template>
        <template #userCount-cell="{ row }">{{ row.original.userCount }}</template>
        <template #createdAt-cell="{ row }">{{ formatCreatedAt(row.original.createdAt) }}</template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <ClientUsers :clientId="row.original.id">
              <UButton
                icon="mdi:account-multiple-outline"
                color="neutral"
                variant="ghost"
                :aria-label="$t('master.clientUsers.title')"
              />
            </ClientUsers>
            <ClientEdit :client="row.original" @saved="invalidateClients">
              <UButton icon="mdi:pencil" color="neutral" variant="ghost" :aria-label="$t('common.actions.edit')" />
            </ClientEdit>
            <UButton
              v-if="!row.original.deletedAt"
              icon="mdi:delete"
              color="error"
              variant="ghost"
              :aria-label="$t('master.clientTable.actions.deleteDeactivate')"
              @click="del(row.original.id, row.original.name)"
            />
            <UButton
              v-else
              icon="mdi:lock-open"
              color="success"
              variant="ghost"
              :aria-label="$t('master.clientTable.actions.activate')"
              @click="restore(row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </div>

    <div v-if="!loadFailed && rows.length" class="space-y-3 sm:hidden" :aria-busy="isRefetching">
      <UCard v-for="client in rows" :key="client.id">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <h3 class="break-words font-semibold">{{ client.name }}</h3>
              <UBadge :color="client.deletedAt ? 'error' : 'success'" variant="subtle">
                {{
                  client.deletedAt
                    ? $t('master.clientTable.status.deactivated')
                    : $t('master.clientTable.status.active')
                }}
              </UBadge>
            </div>
            <p class="break-all text-sm text-muted">{{ client.domain }}</p>
            <p class="text-xs text-muted">
              {{ client.plan }} · {{ client.userCount }}
              {{ $t('master.clientTable.headers.users').toLocaleLowerCase() }}
            </p>
            <p class="text-xs text-muted">{{ formatCreatedAt(client.createdAt) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <ClientUsers :clientId="client.id">
              <UButton
                icon="mdi:account-multiple-outline"
                color="neutral"
                variant="ghost"
                :aria-label="$t('master.clientUsers.title')"
              />
            </ClientUsers>
            <UDropdownMenu :items="actionItems(client)">
              <UButton
                icon="mdi:dots-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="$t('master.clientTable.headers.actions')"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>
    </div>

    <div v-if="!loadFailed && totalPages > 1" class="flex shrink-0 justify-center pb-2">
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

  <UModal
    v-model:open="deleteOpen"
    :title="deleteTarget ? t('master.clientTable.deleteDialog.title', { name: deleteTarget.name }) : ''"
    :description="t('master.clientTable.deleteDialog.text')"
  >
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="deleteOpen = false">
          {{ t('master.clientTable.deleteDialog.cancel') }}
        </UButton>
        <UButton color="warning" icon="mdi:archive-arrow-down" @click="performDelete('soft')">
          {{ t('master.clientTable.deleteDialog.deny') }}
        </UButton>
        <UButton color="error" icon="mdi:delete-forever" @click="performDelete('hard')">
          {{ t('master.clientTable.deleteDialog.confirm') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ClientSite } from '@zenstackhq/runtime/models'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'

const { t, locale } = useI18n()
const { invalidateClients } = useCacheInvalidation()
const requestFetch = useRequestFetch()
const toast = useToast()
const confirm = useConfirm()
const route = useRoute()
const router = useRouter()
type ClientRow = ClientSite & { userCount: number }

const deleteOpen = shallowRef(false)
const listOrigin = useTemplateRef<HTMLElement>('listOrigin')
const deleteTarget = shallowRef<{ id: string; name: string } | null>(null)
const limit = 20
const page = shallowRef(Number(route.query.page) || 1)
const globalFilter = shallowRef((route.query.query as string) || '')
const domainFilter = shallowRef((route.query.domain as string) || '')
const planFilter = shallowRef((route.query.plan as string) || 'all')
const statusFilter = shallowRef((route.query.status as string) || 'all')
const dateFrom = shallowRef((route.query.dateFrom as string) || '')
const dateTo = shallowRef((route.query.dateTo as string) || '')
const sortField = shallowRef((route.query.sort as string) || 'createdAt')
const sortOrder = shallowRef((route.query.order as string) || 'desc')
const filtersOpen = shallowRef(
  Boolean(domainFilter.value) ||
    planFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    Boolean(dateFrom.value) ||
    Boolean(dateTo.value),
)
const debouncedFilter = refDebounced(globalFilter, 400)
const debouncedDomain = refDebounced(domainFilter, 400)
const planItems = ['all', 'BASIC', 'PRO', 'PREMIUM', 'CUSTOM']
const statusItems = computed(() => [
  { label: t('common.labels.all'), value: 'all' },
  { label: t('master.clientTable.status.active'), value: 'active' },
  { label: t('master.clientTable.status.deactivated'), value: 'deactivated' },
])
const sortItems = computed(() => [
  { label: t('master.clientTable.headers.name'), value: 'name' },
  { label: t('master.clientTable.headers.domain'), value: 'domain' },
  { label: t('master.clientTable.headers.plan'), value: 'plan' },
  { label: t('master.clientTable.headers.createdAt'), value: 'createdAt' },
])
const orderItems = computed(() => [
  { label: t('common.sortOptions.newest'), value: 'desc' },
  { label: t('common.sortOptions.oldest'), value: 'asc' },
])
const listQuery = computed(() => ({
  page: page.value,
  limit,
  ...(debouncedFilter.value ? { query: debouncedFilter.value } : {}),
  ...(debouncedDomain.value ? { domain: debouncedDomain.value } : {}),
  ...(planFilter.value !== 'all' ? { plan: planFilter.value } : {}),
  ...(statusFilter.value !== 'all' ? { status: statusFilter.value } : {}),
  ...(dateFrom.value ? { dateFrom: dateFrom.value } : {}),
  ...(dateTo.value ? { dateTo: dateTo.value } : {}),
  sort: sortField.value,
  order: sortOrder.value,
}))

const {
  data: clients,
  asyncStatus,
  error,
  refetch,
} = useQuery({
  key: () => ['clients', 'list', listQuery.value],
  query: () =>
    requestFetch<{ data: ClientRow[]; total: number }>('/api/clients', {
      query: listQuery.value,
    }),
  placeholderData: (previous) => previous,
})

const rows = computed(() => clients.value?.data ?? [])
const totalPages = computed(() => Math.ceil((clients.value?.total || 0) / limit))
const isRefetching = computed(() => asyncStatus.value === 'loading')
const loadFailed = computed(() => !!error.value && rows.value.length === 0)
const activeFilterCount = computed(
  () =>
    [domainFilter.value, planFilter.value !== 'all', statusFilter.value !== 'all', dateFrom.value, dateTo.value].filter(
      Boolean,
    ).length,
)
const columns = computed<TableColumn<ClientRow>[]>(() => [
  {
    accessorKey: 'name',
    header: t('master.clientTable.headers.name'),
    meta: { class: { th: 'w-auto', td: 'min-w-0 max-w-0' } },
  },
  {
    accessorKey: 'domain',
    header: t('master.clientTable.headers.domain'),
    meta: { class: { th: 'w-48', td: 'w-48 max-w-48' } },
  },
  {
    id: 'status',
    header: t('common.labels.status'),
    meta: { class: { th: 'w-28', td: 'w-28' } },
  },
  {
    accessorKey: 'plan',
    header: t('master.clientTable.headers.plan'),
    meta: { class: { th: 'w-32', td: 'w-32' } },
  },
  {
    accessorKey: 'userCount',
    header: t('master.clientTable.headers.users'),
    meta: { class: { th: 'w-20', td: 'w-20 tabular-nums' } },
  },
  {
    accessorKey: 'createdAt',
    header: t('master.clientTable.headers.createdAt'),
    meta: { class: { th: 'w-36', td: 'w-36 whitespace-nowrap' } },
  },
  {
    id: 'actions',
    header: t('master.clientTable.headers.actions'),
    meta: { class: { th: 'w-40', td: 'w-40' } },
  },
])

const toggleSort = (field: 'name' | 'domain' | 'plan' | 'createdAt') => {
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

const formatCreatedAt = (value: Date | string) =>
  new Date(value).toLocaleString(locale.value === 'cs' ? 'cs-CZ' : 'en-US')

watch([debouncedFilter, debouncedDomain, planFilter, statusFilter, dateFrom, dateTo, sortField, sortOrder], () => {
  page.value = 1
  router.replace({
    query: { ...listQuery.value, page: undefined, limit: undefined },
  })
})

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

const clearFilters = () => {
  globalFilter.value = ''
  domainFilter.value = ''
  planFilter.value = 'all'
  statusFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
  sortField.value = 'createdAt'
  sortOrder.value = 'desc'
}

const del = (id: string, name: string) => {
  deleteTarget.value = { id, name }
  deleteOpen.value = true
}

const actionItems = (client: ClientRow): DropdownMenuItem[] => [
  {
    label: client.deletedAt
      ? t('master.clientTable.actions.activate')
      : t('master.clientTable.actions.deleteDeactivate'),
    icon: client.deletedAt ? 'mdi:lock-open' : 'mdi:delete',
    color: client.deletedAt ? 'success' : 'error',
    onSelect: () => (client.deletedAt ? restore(client.id) : del(client.id, client.name)),
  },
]

const performDelete = async (mode: 'hard' | 'soft') => {
  const target = deleteTarget.value
  deleteOpen.value = false
  if (!target) return
  try {
    await $fetch(`/api/clients/${target.id}${mode === 'hard' ? '?hard=true' : ''}` as `api/clients/:id`, {
      method: 'DELETE',
    })
    toast.add({
      color: 'success',
      title: t(
        mode === 'hard' ? 'master.clientTable.messages.permanentlyDeleted' : 'master.clientTable.messages.deactivated',
      ),
    })
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: error.data?.message || t('master.clientTable.messages.deleteFailed'),
    })
  } finally {
    deleteTarget.value = null
    await invalidateClients()
  }
}

const restore = async (id: string) => {
  const confirmed = await confirm({
    title: t('master.clientTable.activateDialog.title'),
    message: t('master.clientTable.activateDialog.text'),
    icon: 'mdi:help-circle-outline',
    confirmText: t('master.clientTable.activateDialog.confirm'),
    cancelText: t('master.clientTable.activateDialog.cancel'),
    variant: 'success',
  })
  if (!confirmed) return
  try {
    await $fetch(`/api/clients/${id}` as `api/clients/:id`, {
      method: 'PATCH',
      body: { deletedAt: null },
    })
    toast.add({
      color: 'success',
      title: t('master.clientTable.messages.activated'),
    })
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: error.data?.message || t('master.clientTable.messages.activateFailed'),
    })
  } finally {
    await invalidateClients()
  }
}
</script>
