<template>
  <Modal v-model="open" title="Seznam uživatelů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Hledat podle jména nebo emailu..."
        class="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-300"
      />

      <div v-if="loading && !users?.length" class="text-gray-600">Načítání...</div>
      <div v-else-if="error" class="text-red-600">{{ error }}</div>
      <div v-else ref="scrollParent" class="relative">
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
            class="border-b py-2 px-1 flex justify-between items-center"
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
            <div v-if="session?.user?.role === 'superadmin'" class="flex gap-2">
              <button
                v-if="filteredUsers[virtualRow.index]?.deletedAt === null"
                class="w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 rounded-full hover:from-red-300 hover:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="del(filteredUsers[virtualRow.index]?.id)"
              >
                <Icon name="mdi:lock" class="w-5 h-5 text-black" />
              </button>
              <button
                v-else
                class="w-10 h-10 bg-gradient-to-r from-yellow-200 to-yellow-300 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                @click="restore(filteredUsers[virtualRow.index]?.id)"
              >
                <Icon name="mdi:lock-open" class="w-5 h-5 text-black" />
              </button>
            </div>
          </div>
        </div>
        <div v-if="!filteredUsers?.length" class="text-gray-600 px-2 py-4">Žádní uživatelé nenalezeni.</div>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { useVirtualizer } from '@tanstack/vue-virtual'

const open = defineModel<boolean>()

const toast = useToast()

const searchQuery = shallowRef<string>('')

const scrollParent = useTemplateRef('scrollParent')

const {
  data: users,
  pending: loading,
  error,
  refresh,
} = useFetch('/api/users', {
  immediate: true,
  server: false,
})

const { data: session } = useAuth()

const filteredUsers = computed(() => {
  if (!users.value) return []
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter((u) => u?.username?.toLowerCase().includes(q) || u?.email?.toLowerCase().includes(q))
})

const virtualizer = useVirtualizer({
  count: filteredUsers.value.length,
  getScrollElement: () => scrollParent.value,
  estimateSize: () => 100,
  overscan: 5,
})

watch(filteredUsers, () => (virtualizer.value.options.count = filteredUsers.value.length))

const del = async (id: string | undefined) => {
  if (!id) return

  const r = await Swal.fire({
    title: 'Zablokovat uživatele?',
    text: 'Tímto zablokujete uživatele.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zablokovat',
    cancelButtonText: 'Ne',
    background: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
  })
  if (!r.isConfirmed) return

  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'DELETE' })

    toast.success({ message: 'Uživatel zablokován' })

    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Zablokování selhalo' })
  }
}

const restore = async (id: string | undefined) => {
  if (!id) return

  try {
    await $fetch(`/api/users/${id}`, { method: 'PATCH', body: { deletedAt: null } })

    const user = users.value?.find((u) => u?.id === id)
    if (user) user.deletedAt = null

    toast.success({ message: 'Uživatel obnoven' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Obnovení selhalo' })
  }
}
</script>
