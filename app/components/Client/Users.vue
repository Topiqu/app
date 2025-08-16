<template>
  <Modal v-model="open" title="Uživatelé klienta">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div v-if="users.length === 0" class="text-center text-red-500">Žádní uživatelé nenalezeni</div>
      <div class="flex justify-end mb-4">
        <LazyUserCreate
          v-slot="{ open: userCreateOpen }"
          :clientId="props.clientId"
          hydrateOnInteraction
          @create="refresh"
        >
          <button
            class="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-green-200 to-green-300 text-gray-800 rounded-full hover:from-green-300 hover:to-green-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 dark:text-gray-200"
            @click="userCreateOpen.value = true"
          >
            <Icon name="mdi:plus" class="w-5 h-5" />
          </button>
        </LazyUserCreate>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-600">
          <thead class="bg-gray-100 dark:bg-gray-700 text-left font-semibold text-gray-600 dark:text-gray-200">
            <tr>
              <th class="px-4 py-2">Uživatelské jméno</th>
              <th class="px-4 py-2">Email</th>
              <th class="px-4 py-2">Role</th>
              <th class="px-4 py-2">Akce</th>
            </tr>
          </thead>
          <tbody class="text-gray-800 dark:text-gray-200">
            <tr
              v-for="user in users"
              :key="user.id"
              :class="[
                'transition-colors duration-200 group',
                user.deletedAt === null
                  ? 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 dark:border-green-400'
                  : 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400',
              ]"
              @mouseover="console.log('Rendering user:', user.id)"
            >
              <td class="px-4 py-2 break-words max-w-[180px] text-center">
                {{ user.username }}
                <div
                  class="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                  :class="
                    user.deletedAt === null
                      ? 'bg-green-200 text-green-800 dark:bg-green-600 dark:text-green-100'
                      : 'bg-red-200 text-red-800 dark:bg-red-600 dark:text-red-100'
                  "
                >
                  {{ user.deletedAt === null ? 'Aktivní' : 'Zablokovaný' }}
                </div>
              </td>
              <td class="px-4 py-2 break-words max-w-[180px] text-center">
                {{ user.email }}
              </td>
              <td class="px-4 py-2 text-center">
                <span
                  class="inline-block px-2 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-blue-200 text-blue-800 dark:bg-blue-600 dark:text-blue-100': user.role === 'admin',
                    'bg-purple-200 text-purple-800 dark:bg-purple-600 dark:text-purple-100': user.role === 'superadmin',
                    'bg-yellow-200 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-100': user.role === 'reader',
                  }"
                >
                  {{ user.role }}
                </span>
              </td>
              <td class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center">
                <LazyUserEdit v-slot="{ open }" :user="user" hydrateOnInteraction @saved="refresh">
                  <button
                    class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 rounded-full hover:from-blue-300 hover:to-blue-400 transition shadow-sm hover:shadow-md transform hover:scale-105 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 dark:text-gray-200"
                    @click="open.value = true"
                  >
                    <Icon name="mdi:pencil" class="w-5 h-5 text-black" />
                  </button>
                </LazyUserEdit>
                <button
                  v-if="user.deletedAt === null"
                  class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 text-gray-800 rounded-full hover:from-red-300 hover:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:from-red-600 dark:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800 dark:text-gray-200"
                  @click="del(user.id)"
                >
                  <Icon name="mdi:lock" class="w-5 h-5" />
                </button>
                <button
                  v-if="user.deletedAt !== null"
                  class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-yellow-200 to-yellow-300 text-gray-800 rounded-full hover:from-yellow-300 hover:to-yellow-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:from-yellow-600 dark:to-yellow-700 dark:hover:from-yellow-700 dark:hover:to-yellow-800 dark:text-gray-200"
                  @click="restore(user.id)"
                >
                  <Icon name="mdi:lock-open" class="w-5 h-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer="{ close }">
      <button
        class="px-6 py-3 rounded-xl text-base font-medium bg-gray-50 hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
        @click="close"
      >
        Zavřít
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'

const props = defineProps<{ clientId: string }>()
const open = defineModel<boolean>()
const toast = useToast()
const { data: users, refresh } = await useFetch(`/api/users/${props.clientId}/by-clientside`, {
  default: () => [],
})

const del = async (id: string) => {
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
    await $fetch(`/api/users/${id}`, { method: 'DELETE' })
    toast.success({ message: 'Uživatel zablokován' })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Zablokování selhalo' })
  }
}

const restore = async (id: string) => {
  try {
    await $fetch(`/api/users/${id}`, { method: 'PATCH', body: { deletedAt: null } })
    const user = users.value.find((u) => u.id === id)
    if (user) user.deletedAt = null
    await refresh()
    toast.success({ message: 'Uživatel obnoven' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Obnovení selhalo' })
  }
}
</script>
