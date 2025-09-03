<template>
  <Modal v-model="open" title="Přidat uživatele">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">Přidat nového uživatele</h3>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium">Uživatelské jméno</span>
            <input
              v-model="newUser.username"
              placeholder="Uživatelské jméno"
              class="p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium">Email</span>
            <input
              v-model="newUser.email"
              placeholder="Email"
              class="p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium">Heslo</span>
            <input
              v-model="newUser.password"
              type="password"
              placeholder="Heslo"
              class="p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium">Role</span>
            <select
              v-model="newUser.role"
              class="p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="admin">Admin</option>
              <option value="user">Uživatel</option>
            </select>
          </label>
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            :disabled="!newUser.username || !newUser.email || !newUser.password"
            @click="createUser"
          >
            Vytvořit
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <h3 class="text-lg font-medium">Přidat existujícího uživatele</h3>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Hledat podle jména nebo emailu..."
            class="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <div v-if="loading && !users?.length" class="text-gray-600">Načítání...</div>
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
                    <span class="font-medium">Uživatel: </span>
                    {{ filteredUsers[virtualRow.index]?.username ?? 'Není k dispozici' }}
                  </div>
                  <div>
                    <span class="font-medium">Email: </span>
                    {{ filteredUsers[virtualRow.index]?.email ?? 'Není k dispozici' }}
                  </div>
                  <div>
                    <span class="font-medium">Role: </span>
                    {{ filteredUsers[virtualRow.index]?.role ?? 'Není k dispozici' }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button
                    v-if="filteredUsers[virtualRow.index]?.deletedAt === null"
                    class="w-10 h-10 bg-blue-200 rounded-full hover:bg-blue-300 transition-all duration-200"
                    @click="assignToClientSite(filteredUsers[virtualRow.index]?.id)"
                  >
                    <Icon name="mdi:plus" class="w-5 h-5 text-black" />
                  </button>
                </div>
              </div>
            </div>
            <div v-if="!filteredUsers?.length" class="text-gray-600 px-2 py-4">Žádní uživatelé nenalezeni.</div>
          </div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
        @click="close"
      >
        Zavřít
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
const searchQuery = shallowRef<string>('')
const scrollParent = useTemplateRef('scrollParent')

const newUser = ref({
  username: '',
  email: '',
  password: '',
  role: 'reader' as 'admin' | 'reader',
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
  return users.value.filter(
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
    toast.success({ message: 'Uživatel vytvořen' })
    open.value = false
    newUser.value = { username: '', email: '', password: '', role: 'reader' }
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Vytvoření selhalo' })
  }
}

const assignToClientSite = async (userId: string | undefined) => {
  if (!userId) return

  try {
    const response = await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { clientSiteId: props.clientId, role: 'admin' },
    })
    if (!response) throw createError('Chyba')

    toast.success({ message: 'Uživatel přiřazen ke klientovi' })
    emit('create')
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Přiřazení selhalo' })
  }
}
</script>
