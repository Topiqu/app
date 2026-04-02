<template>
  <Modal v-model="open" :title="$t('master.userCreate.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">{{ $t('master.userCreate.assignNew') }}</h3>
          <FormField
            v-model="newUser.username"
            :label="$t('master.userCreate.username')"
            :placeholder="$t('master.userCreate.username')"
          />
          <FormField
            v-model="newUser.email"
            :label="$t('master.userCreate.email')"
            :placeholder="$t('master.userCreate.email')"
          />
          <FormField
            v-model="newUser.password"
            type="password"
            :label="$t('master.userCreate.password')"
            :placeholder="$t('master.userCreate.password')"
          />
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            :disabled="!newUser.username || !newUser.email || !newUser.password"
            @click="createUser"
          >
            {{ $t('master.userCreate.createBtn') }}
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">{{ $t('master.userCreate.addExisting') }}</h3>
          <FormField v-model="searchQuery" :placeholder="$t('master.userCreate.searchPlaceholder')" />
          <div v-if="loading && !users?.data.length" class="text-gray-600">{{ $t('master.userCreate.loading') }}</div>
          <div v-else-if="error" class="text-red-600">{{ error }}</div>
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
                class="border-b py-2 px-1 flex justify-between items-center text-gray-700"
              >
                <div>
                  <div>
                    <span class="font-medium">{{ $t('master.userCreate.userLabel') }}</span>
                    {{ filteredUsers[virtualRow.index]?.username ?? $t('master.userCreate.notAvailable') }}
                  </div>
                  <div>
                    <span class="font-medium">{{ $t('master.userCreate.emailLabel') }}</span>
                    {{ filteredUsers[virtualRow.index]?.email ?? $t('master.userCreate.notAvailable') }}
                  </div>
                  <div>
                    <span class="font-medium">{{ $t('master.userCreate.roleLabel') }}</span>
                    {{ filteredUsers[virtualRow.index]?.role ?? $t('master.userCreate.notAvailable') }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button
                    v-if="filteredUsers[virtualRow.index]?.deletedAt === null"
                    class="w-10 h-10 bg-blue-200 rounded-full hover:bg-blue-300 transition-all duration-200 flex justify-center items-center"
                    @click="assignToClientSite(filteredUsers[virtualRow.index]?.id)"
                  >
                    <Icon name="mdi:plus" class="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="!filteredUsers?.length" class="text-gray-600 px-2 py-4">
              {{ $t('master.userCreate.noUsers') }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
        @click="close"
      >
        {{ $t('master.userCreate.close') }}
      </button>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
import { useVirtualizer } from '@tanstack/vue-virtual'

const open = defineModel<boolean>()
const props = defineProps<{ clientId: string }>()
const emit = defineEmits(['create'])

const toast = useToast()
const { t } = useI18n()
const searchQuery = shallowRef<string>('')
const scrollParent = useTemplateRef('scrollParent')

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
  try {
    const response = await $fetch('/api/users', {
      method: 'POST',
      body: { ...newUser.value, clientSiteId: props.clientId },
    })
    if (!response) throw createError('Chyba')

    emit('create')
    toast.success({ message: t('master.userCreate.messages.created') })
    open.value = false
    newUser.value = { username: '', email: '', password: '', role: 'reader' }
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.userCreate.messages.createFailed') })
  }
}

const assignToClientSite = async (userId: string | undefined) => {
  if (!userId) return

  try {
    const response = await $fetch(`/api/users/${userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { clientSiteId: props.clientId, role: 'admin' },
    })
    if (!response) throw createError('Chyba')

    toast.success({ message: t('master.userCreate.messages.assigned') })
    emit('create')
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.userCreate.messages.assignFailed') })
  }
}
</script>
