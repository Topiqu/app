<template>
  <UModal v-model:open="open" :title="$t('master.clientUsers.title')" :ui="{ content: 'max-w-5xl' }">
    <slot :open="open" />

    <template #header>
      <div class="flex w-full items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-highlighted">{{ $t('master.clientUsers.title') }}</h2>
        <div class="flex items-center gap-1">
          <UserCreate :clientId="props.clientId" @create="refresh">
            <UButton color="success" variant="soft" icon="i-mdi-plus" :label="$t('common.actions.addUser')" />
          </UserCreate>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-mdi-close"
            square
            :aria-label="$t('common.close')"
            @click="open = false"
          />
        </div>
      </div>
    </template>

    <template #body>
      <div class="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <UFormField :label="$t('common.actions.search')" :ui="{ label: 'sr-only' }">
          <UInput v-model="search" icon="i-mdi-magnify" :placeholder="$t('common.actions.search')" />
        </UFormField>
        <UFormField :label="$t('master.clientUsers.headers.role')" :ui="{ label: 'sr-only' }">
          <USelect v-model="roleFilter" :items="roleItems" />
        </UFormField>
        <UFormField :label="$t('common.labels.status')" :ui="{ label: 'sr-only' }">
          <USelect v-model="statusFilter" :items="statusItems" />
        </UFormField>
      </div>
      <UEmpty
        v-if="filteredUsers.length === 0"
        icon="i-mdi-account-off-outline"
        :title="$t('master.clientUsers.empty')"
      />
      <UTable v-else class="hidden sm:block" :data="filteredUsers" :columns="userColumns">
        <template #username-cell="{ row }">
          <div class="flex items-center gap-2">
            <span>{{ row.original.username }}</span>
            <UBadge :color="row.original.deletedAt === null ? 'success' : 'error'" variant="subtle">
              {{
                row.original.deletedAt === null
                  ? $t('master.clientUsers.status.active')
                  : $t('master.clientUsers.status.blocked')
              }}
            </UBadge>
          </div>
        </template>
        <template #role-cell="{ row }">
          <UBadge v-if="row.original.role !== 'ai'" color="primary" variant="subtle">
            {{ row.original.role }}
          </UBadge>
          <UIcon v-else size="24" name="i-mdi-robot" class="text-primary" />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-2">
            <UserEdit :user="row.original" @saved="refresh">
              <UButton icon="i-mdi-pencil" color="neutral" variant="ghost" :aria-label="$t('common.actions.edit')" />
            </UserEdit>
            <UButton
              v-if="row.original.deletedAt === null"
              icon="i-mdi-delete"
              color="error"
              variant="ghost"
              :aria-label="$t('master.clientUsers.blockDialog.confirm')"
              @click="del(row.original.id)"
            />
            <UButton
              v-else
              icon="i-mdi-lock-open"
              color="success"
              variant="ghost"
              :aria-label="$t('master.clientUsers.messages.restored')"
              @click="restore(row.original.id)"
            />
          </div>
        </template>
      </UTable>
      <div v-if="filteredUsers.length" class="space-y-3 sm:hidden">
        <UCard v-for="user in filteredUsers" :key="user.id" variant="subtle">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="break-words font-semibold text-highlighted">{{ user.username }}</p>
                <UBadge :color="user.deletedAt === null ? 'success' : 'error'" variant="subtle">
                  {{
                    user.deletedAt === null
                      ? $t('master.clientUsers.status.active')
                      : $t('master.clientUsers.status.blocked')
                  }}
                </UBadge>
                <UBadge color="primary" variant="soft">{{ user.role }}</UBadge>
              </div>
              <p class="mt-1 break-all text-sm text-muted">{{ user.email }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UserEdit :user="user" @saved="refresh">
                <UButton
                  icon="i-mdi-pencil"
                  color="neutral"
                  variant="ghost"
                  square
                  :aria-label="$t('common.actions.edit')"
                />
              </UserEdit>
              <UButton
                :icon="user.deletedAt === null ? 'i-mdi-delete' : 'i-mdi-lock-open'"
                :color="user.deletedAt === null ? 'error' : 'success'"
                variant="ghost"
                square
                :aria-label="
                  user.deletedAt === null
                    ? $t('master.clientUsers.blockDialog.confirm')
                    : $t('master.clientUsers.messages.restored')
                "
                @click="user.deletedAt === null ? del(user.id) : restore(user.id)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">{{
        $t('master.clientUsers.actions.close')
      }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

const { t } = useI18n()
const props = defineProps<{ clientId: string }>()
const open = defineModel<boolean>({ default: false })
const confirm = useConfirm()
const toast = useToast()
const { data: users, refresh } = await useFetch(`/api/users/${props.clientId}/by-clientside`, {
  default: () => [],
})
type ClientUser = (typeof users.value)[number]
const search = shallowRef('')
const roleFilter = shallowRef('all')
const statusFilter = shallowRef('all')
const roleItems = computed(() => [
  { label: t('common.labels.all'), value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' },
  { label: 'AI', value: 'ai' },
])
const statusItems = computed(() => [
  { label: t('common.labels.all'), value: 'all' },
  { label: t('master.clientUsers.status.active'), value: 'active' },
  { label: t('master.clientUsers.status.blocked'), value: 'blocked' },
])
const filteredUsers = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return users.value.filter((user) => {
    const matchesText = !needle || `${user.username} ${user.email}`.toLowerCase().includes(needle)
    const matchesRole = roleFilter.value === 'all' || user.role === roleFilter.value
    const matchesStatus =
      statusFilter.value === 'all' || (statusFilter.value === 'active' ? !user.deletedAt : !!user.deletedAt)
    return matchesText && matchesRole && matchesStatus
  })
})
const userColumns = computed<TableColumn<ClientUser>[]>(() => [
  { accessorKey: 'username', header: t('master.clientUsers.headers.username') },
  { accessorKey: 'email', header: t('master.clientUsers.headers.email') },
  { accessorKey: 'role', header: t('master.clientUsers.headers.role') },
  { id: 'actions', header: t('master.clientUsers.headers.actions') },
])

const del = async (id: string) => {
  const r = await confirm({
    title: t('master.clientUsers.blockDialog.title'),
    message: t('master.clientUsers.blockDialog.text'),
    icon: 'i-mdi-alert-outline',
    confirmText: t('master.clientUsers.blockDialog.confirm'),
    cancelText: t('master.clientUsers.blockDialog.cancel'),
    variant: 'danger',
  })
  if (!r) return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'DELETE' })
    toast.add({ color: 'success', title: t('master.clientUsers.messages.blocked') })
    await refresh()
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.clientUsers.messages.blockFailed') })
  }
}

const restore = async (id: string) => {
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'PATCH', body: { deletedAt: null } })
    const user = users.value.find((u) => u.id === id)
    if (user) user.deletedAt = null
    await refresh()
    toast.add({ color: 'success', title: t('master.clientUsers.messages.restored') })
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.clientUsers.messages.restoreFailed') })
  }
}
</script>
