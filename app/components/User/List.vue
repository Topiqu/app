<template>
  <Modal v-model="open" :title="$t('master.userList.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-4">
        <FormField v-model="searchQuery" :placeholder="$t('master.userList.searchPlaceholder')" icon="mdi:search" />

        <div v-if="fetching && !users?.length" class="flex justify-center p-8">
          <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div v-else-if="error" class="text-red-500 bg-red-50 p-4 rounded-xl text-center font-medium">{{ error }}</div>
        <div v-else class="relative">
          <div class="flex flex-col gap-3">
            <div
              v-for="user in users"
              :key="user.id"
              class="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
              :class="{ 'opacity-75 grayscale': user.deletedAt !== null }"
            >
              <div class="flex items-center gap-4 min-w-0">
                <UserPicture :url="user.avatarUrl" :name="user.username" size="lg" />
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-gray-900 dark:text-white truncate">
                      {{ user.username ?? $t('master.userList.notAvailable') }}
                    </span>
                    <span
                      class="px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full"
                      :class="{
                        'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': user.role === 'admin',
                        'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300':
                          user.role === 'superadmin',
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300':
                          user.role === 'reader' || !user.role,
                      }"
                    >
                      {{ user.role ?? $t('master.userList.notAvailable') }}
                    </span>
                  </div>
                  <span class="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                    <Icon name="mdi:email-outline" class="w-4 h-4 inline-block mr-1 align-text-bottom" />
                    {{ user.email ?? $t('master.userList.notAvailable') }}
                  </span>

                  <div class="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      v-if="user.clientSite?.name"
                      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md"
                    >
                      <Icon name="mdi:domain" class="w-3.5 h-3.5" />
                      {{ user.clientSite.name }}
                    </span>
                    <span
                      class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md"
                      :title="$t('master.userList.labels.comments')"
                    >
                      <Icon name="mdi:comment-outline" class="w-3.5 h-3.5" />
                      {{ user._count?.comments || 0 }}
                    </span>
                  </div>
                  <p v-if="user.bio" class="text-xs text-gray-400 mt-2 line-clamp-1 italic">"{{ user.bio }}"</p>
                </div>
              </div>

              <div v-if="session?.user?.role === 'superadmin'" class="flex gap-2 shrink-0 ml-4">
                <Button
                  v-if="user.deletedAt === null"
                  variant="danger"
                  icon="mdi:lock"
                  class="rounded-full !p-2"
                  @click="del(user.id)"
                />
                <Button
                  v-else
                  variant="warning"
                  icon="mdi:lock-open"
                  class="rounded-full !p-2"
                  @click="restore(user.id)"
                />
              </div>
            </div>
          </div>
          <div ref="sentinel" class="h-4"></div>
          <div v-if="!users?.length" class="text-center text-gray-500 py-8">
            <Icon name="mdi:account-off-outline" class="w-12 h-12 mb-3 text-gray-300 mx-auto" />
            <p>{{ $t('master.userList.noUsers') }}</p>
          </div>
          <div v-if="fetching && users.length" class="flex justify-center py-4">
            <div class="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <Button variant="neutral" size="lg" @click="close">{{ $t('master.userList.actions.close') }}</Button>
    </template>
  </Modal>
  <ModalMini ref="blockDialog" />
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
const blockDialog = useTemplateRef<ModalMiniRef>('blockDialog')
const toast = useToast()
const { t } = useI18n()
const searchQuery = shallowRef<string>('')
const sentinel = useTemplateRef('sentinel')
const { data: session } = useAuth()

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
  watch: false,
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

watch(error, (e) => e && toast.error({ message: e.data?.message || t('master.userList.messages.fetchFailed') }))

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
  const r = await blockDialog.value?.ask({
    title: t('master.userList.blockDialog.title'),
    message: t('master.userList.blockDialog.text'),
    icon: 'mdi:alert-outline',
    confirmText: t('master.userList.blockDialog.confirm'),
    cancelText: t('master.userList.blockDialog.cancel'),
    variant: 'danger',
  })
  if (r !== 'ok') return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'DELETE' })
    toast.success({ message: t('master.userList.messages.blocked') })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.userList.messages.blockFailed') })
  }
}

const restore = async (id: string | undefined) => {
  if (!id) return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'PATCH', body: { deletedAt: null } })
    toast.success({ message: t('master.userList.messages.restored') })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.userList.messages.restoreFailed') })
  }
}
</script>
