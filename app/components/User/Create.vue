<template>
  <UModal v-model:open="open" :title="$t('master.userCreate.title')">
    <slot :open="open" />

    <template #body>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">{{ $t('master.userCreate.assignNew') }}</h3>
          <UFormField :label="$t('master.userCreate.username')">
            <UInput v-model="newUser.username" :placeholder="$t('master.userCreate.username')" />
          </UFormField>
          <UFormField :label="$t('master.userCreate.email')">
            <UInput v-model="newUser.email" :placeholder="$t('master.userCreate.email')" />
          </UFormField>
          <UFormField :label="$t('master.userCreate.password')">
            <UInput v-model="newUser.password" type="password" :placeholder="$t('master.userCreate.password')" />
          </UFormField>
          <UButton
            color="primary"
            variant="solid"
            :loading="creating"
            :disabled="creating || !newUser.username || !newUser.email || !newUser.password"
            @click="createUser"
          >
            {{ $t('master.userCreate.createBtn') }}
          </UButton>
        </div>

        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">{{ $t('master.userCreate.addExisting') }}</h3>
          <UFormField :label="$t('master.userCreate.searchPlaceholder')" :ui="{ label: 'sr-only' }">
            <UInput v-model="searchQuery" icon="mdi:magnify" :placeholder="$t('master.userCreate.searchPlaceholder')" />
          </UFormField>
          <UProgress v-if="loading && !users?.data.length" />
          <UAlert
            v-else-if="error"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('common.error')"
            :description="error.message"
          />
          <div v-else ref="scrollParent" class="relative max-h-96 overflow-auto">
            <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
              <div
                v-for="virtualRow in virtualizer.getVirtualItems()"
                :key="String(virtualRow.key)"
                :style="{
                  position: 'absolute',
                  top: `${virtualRow.start}px`,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                }"
                class="flex items-center justify-between px-1 py-2"
              >
                <UUser
                  :name="filteredUsers[virtualRow.index]?.username ?? $t('master.userCreate.notAvailable')"
                  :description="filteredUsers[virtualRow.index]?.email ?? $t('master.userCreate.notAvailable')"
                >
                  <template #trailing>
                    <UBadge color="neutral" variant="soft">
                      {{ filteredUsers[virtualRow.index]?.role ?? $t('master.userCreate.notAvailable') }}
                    </UBadge>
                  </template>
                </UUser>
                <div class="flex gap-2">
                  <UButton
                    v-if="filteredUsers[virtualRow.index]?.deletedAt === null"
                    color="primary"
                    variant="soft"
                    square
                    icon="mdi:plus"
                    :loading="assigningUserId === filteredUsers[virtualRow.index]?.id"
                    :disabled="!!assigningUserId"
                    :aria-label="$t('common.actions.assignUser')"
                    :title="$t('common.actions.assignUser')"
                    @click="assignToClientSite(filteredUsers[virtualRow.index]?.id)"
                  />
                </div>
                <USeparator class="absolute inset-x-0 bottom-0" />
              </div>
            </div>
            <UEmpty
              v-if="!filteredUsers?.length"
              size="sm"
              icon="mdi:account-search-outline"
              :title="$t('master.userCreate.noUsers')"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" @click="close">
        {{ $t('master.userCreate.close') }}
      </UButton>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
import { useVirtualizer } from '@tanstack/vue-virtual'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ clientId: string }>()
const emit = defineEmits(['create'])

const toast = useToast()
const { t } = useI18n()
const searchQuery = shallowRef<string>('')
const scrollParent = useTemplateRef('scrollParent')
const creating = shallowRef(false)
const assigningUserId = shallowRef<string | null>(null)

const newUser = ref({
  username: '',
  email: '',
  password: '',
  role: 'admin' as 'admin' | 'reader',
})

const {
  data: users,
  pending: loading,
  error,
  refresh,
} = useFetch('/api/users', {
  immediate: true,
  server: false,
})

const filteredUsers = computed(() => {
  if (!users.value) return []
  const q = searchQuery.value.toLowerCase()
  return users.value.data.filter(
    (u) =>
      (u?.username?.toLowerCase().includes(q) || u?.email?.toLowerCase().includes(q)) &&
      u?.clientSiteId !== props.clientId &&
      u?.deletedAt === null,
  )
})

const virtualizer = useVirtualizer({
  count: filteredUsers.value.length,
  getScrollElement: () => scrollParent.value,
  estimateSize: () => 100,
  overscan: 5,
})

watch(filteredUsers, () => (virtualizer.value.options.count = filteredUsers.value.length))

const createUser = async () => {
  if (creating.value) return
  creating.value = true
  try {
    const response = await $fetch('/api/users', {
      method: 'POST',
      body: { ...newUser.value, clientSiteId: props.clientId },
    })
    if (!response) throw createError('Chyba')

    emit('create')
    toast.add({ color: 'success', title: t('master.userCreate.messages.created') })
    open.value = false
    newUser.value = { username: '', email: '', password: '', role: 'reader' }
    await refresh()
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.userCreate.messages.createFailed') })
  } finally {
    creating.value = false
  }
}

const assignToClientSite = async (userId: string | undefined) => {
  if (!userId || assigningUserId.value) return

  assigningUserId.value = userId
  try {
    const response = await $fetch(`/api/users/${userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { clientSiteId: props.clientId, role: 'admin' },
    })
    if (!response) throw createError('Chyba')

    toast.add({ color: 'success', title: t('master.userCreate.messages.assigned') })
    emit('create')
    await refresh()
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || t('master.userCreate.messages.assignFailed') })
  } finally {
    assigningUserId.value = null
  }
}
</script>
