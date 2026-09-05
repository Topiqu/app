<template>
  <UModal v-model:open="open" :title="$t('master.userList.title')">
    <slot :open="open" />

    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField :label="$t('master.userList.searchPlaceholder')" :ui="{ label: 'sr-only' }">
          <UInput v-model="searchQuery" :placeholder="$t('master.userList.searchPlaceholder')" icon="mdi:search" />
        </UFormField>

        <UProgress v-if="fetching && !users?.length" />
        <UAlert v-else-if="error" color="error" :title="String(error)" />
        <div v-else class="relative">
          <div class="flex flex-col gap-3">
            <UCard v-for="user in users" :key="user.id">
              <div
                class="flex items-center justify-between"
                :class="{ 'opacity-75 grayscale': user.deletedAt !== null }"
              >
                <div class="flex items-center gap-4 min-w-0">
                  <UserPicture :url="user.avatarUrl" :name="user.username" size="lg" />
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="break-words font-semibold text-highlighted">
                        {{ user.username ?? $t('master.userList.notAvailable') }}
                      </span>
                      <UBadge :color="roleColor(user.role)" variant="soft">
                        {{ user.role ?? $t('master.userList.notAvailable') }}
                      </UBadge>
                    </div>
                    <span class="mt-1 break-all text-sm text-muted">
                      <UIcon size="16" name="mdi:email-outline" class="inline-block mr-1 align-text-bottom" />
                      {{ user.email ?? $t('master.userList.notAvailable') }}
                    </span>

                    <div class="flex items-center gap-3 mt-2 text-xs text-muted">
                      <UBadge v-if="user.clientSite?.name" color="neutral" variant="soft" icon="mdi:domain">
                        {{ user.clientSite.name }}
                      </UBadge>
                      <UBadge
                        color="neutral"
                        variant="soft"
                        icon="mdi:comment-outline"
                        :title="$t('master.userList.labels.comments')"
                      >
                        {{ user._count?.comments || 0 }}
                      </UBadge>
                    </div>
                    <p v-if="user.bio" class="mt-2 line-clamp-1 text-xs italic text-muted">"{{ user.bio }}"</p>
                  </div>
                </div>

                <div v-if="session?.user?.role === 'superadmin'" class="flex gap-2 shrink-0 ml-4">
                  <UButton
                    v-if="user.deletedAt === null"
                    color="error"
                    variant="solid"
                    icon="mdi:lock"
                    square
                    :aria-label="$t('common.actions.blockUser')"
                    :title="$t('common.actions.blockUser')"
                    @click="del(user.id)"
                  />
                  <UButton
                    v-else
                    color="warning"
                    variant="solid"
                    icon="mdi:lock-open"
                    square
                    :aria-label="$t('common.actions.restoreUser')"
                    :title="$t('common.actions.restoreUser')"
                    @click="restore(user.id)"
                  />
                </div>
              </div>
            </UCard>
          </div>
          <div ref="sentinel" class="h-4"></div>
          <UEmpty v-if="!users?.length" icon="mdi:account-off-outline" :title="$t('master.userList.noUsers')" />
          <UProgress v-if="fetching && users.length" />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" size="lg" @click="close">{{
        $t('master.userList.actions.close')
      }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })
const confirm = useConfirm()
const toast = useToast()
const { t } = useI18n()
const searchQuery = shallowRef<string>('')
const sentinel = useTemplateRef('sentinel')
const { data: session } = useAuth()

const roleColor = (role?: string | null): 'primary' | 'secondary' | 'neutral' => {
  if (role === 'admin') return 'primary'
  if (role === 'superadmin') return 'secondary'
  return 'neutral'
}

const page = shallowRef<number>(1)
const hasMore = shallowRef<boolean>(true)
const loading = shallowRef<boolean>(false)
const users = shallowRef<any[]>([])
const total = shallowRef<number>(0)

const {
  data: usersData,
  pending: fetching,
  error,
  refresh,
} = useFetch(() => `/api/users?page=${page.value}&query=${searchQuery.value}`, {
  default: () => ({ data: [], total: 0 }),
  immediate: false,
  watch: false,
})

watch(open, (isOpen) => {
  if (!isOpen) return
  page.value = 1
  users.value = []
  refresh()
})

watch(
  usersData,
  (v) => {
    if (!v) return
    users.value = page.value === 1 ? v.data : [...users.value, ...v.data]
    total.value = v.total
    hasMore.value = users.value.length < v.total
  },
  { immediate: true },
)

watch(error, (e) => {
  if (!e) return
  const data = e.data as { message?: string } | undefined
  toast.add({ color: 'error', title: data?.message || t('master.userList.messages.fetchFailed') })
})

watch(
  searchQuery,
  useDebounceFn(() => {
    page.value = 1
    users.value = []
    refresh()
  }, 300),
)

useInfiniteScroll(
  sentinel,
  async () => {
    if (!hasMore.value || loading.value) return
    page.value++
    await refresh()
  },
  { distance: 100, interval: 300 },
)

const del = async (id: string | undefined) => {
  if (!id) return
  const r = await confirm({
    title: t('master.userList.blockDialog.title'),
    message: t('master.userList.blockDialog.text'),
    icon: 'mdi:alert-outline',
    confirmText: t('master.userList.blockDialog.confirm'),
    cancelText: t('master.userList.blockDialog.cancel'),
    variant: 'danger',
  })
  if (!r) return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'DELETE' })
    toast.add({ color: 'success', title: t('master.userList.messages.blocked') })
    await refresh()
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.userList.messages.blockFailed') })
  }
}

const restore = async (id: string | undefined) => {
  if (!id) return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'PATCH', body: { deletedAt: null } })
    toast.add({ color: 'success', title: t('master.userList.messages.restored') })
    await refresh()
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.userList.messages.restoreFailed') })
  }
}
</script>
