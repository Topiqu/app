<template>
  <Modal v-model="open" :title="$t('master.clientUsers.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div v-if="users.length === 0" class="text-center text-red-500">{{ $t('master.clientUsers.empty') }}</div>
      <div class="flex justify-end mb-4">
        <LazyUserCreate
          v-slot="{ open: userCreateOpen }"
          :clientId="props.clientId"
          hydrateOnInteraction
          @create="refresh"
        >
          <Button variant="success" icon="mdi:plus" class="rounded-full!" @click="userCreateOpen.value = true" />
        </LazyUserCreate>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-600">
          <thead class="bg-gray-100 dark:bg-gray-700 text-left font-semibold text-gray-600 dark:text-gray-200">
            <tr>
              <th class="px-4 py-2">{{ $t('master.clientUsers.headers.username') }}</th>
              <th class="px-4 py-2">{{ $t('master.clientUsers.headers.email') }}</th>
              <th class="px-4 py-2">{{ $t('master.clientUsers.headers.role') }}</th>
              <th class="px-4 py-2">{{ $t('master.clientUsers.headers.actions') }}</th>
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
                  {{
                    user.deletedAt === null
                      ? $t('master.clientUsers.status.active')
                      : $t('master.clientUsers.status.blocked')
                  }}
                </div>
              </td>
              <td class="px-4 py-2 break-words max-w-[180px] text-center">
                {{ user.email }}
              </td>
              <td class="px-4 py-2 text-center">
                <span
                  v-if="user.role !== 'ai'"
                  class="inline-block px-2 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-blue-200 text-blue-800 dark:bg-blue-600 dark:text-blue-100': user.role === 'admin',
                    'bg-purple-200 text-purple-800 dark:bg-purple-600 dark:text-purple-100': user.role === 'superadmin',
                    'bg-yellow-200 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-100': user.role === 'reader',
                  }"
                >
                  {{ user.role }}
                </span>
                <Icon v-else name="mdi:robot" class="w-6 h-6 text-indigo-600 dark:text-indigo-400 mx-auto" />
              </td>
              <td class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center">
                <LazyUserEdit v-slot="{ open: userEditOpen }" :user="user" hydrateOnInteraction @saved="refresh">
                  <Button icon="mdi:pencil" variant="primary" @click="userEditOpen.value = true" />
                </LazyUserEdit>
                <Button v-if="user.deletedAt === null" icon="mdi:delete" variant="danger" @click="del(user.id)" />
                <Button v-else icon="mdi:lock-open" variant="warning" @click="restore(user.id)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template #footer="{ close }">
      <Button variant="neutral" size="lg" @click="close">{{ $t('master.clientUsers.actions.close') }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'

const { t } = useI18n()
const props = defineProps<{ clientId: string }>()
const open = defineModel<boolean>()
const toast = useToast()
const { data: users, refresh } = await useFetch(`/api/users/${props.clientId}/by-clientside`, {
  default: () => [],
})

const del = async (id: string) => {
  const r = await Swal.fire({
    title: t('master.clientUsers.blockDialog.title'),
    text: t('master.clientUsers.blockDialog.text'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('master.clientUsers.blockDialog.confirm'),
    cancelButtonText: t('master.clientUsers.blockDialog.cancel'),
    background: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
  })
  if (!r.isConfirmed) return
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'DELETE' })
    toast.success({ message: t('master.clientUsers.messages.blocked') })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.clientUsers.messages.blockFailed') })
  }
}

const restore = async (id: string) => {
  try {
    await $fetch(`/api/users/${id}` as `/api/users/:id`, { method: 'PATCH', body: { deletedAt: null } })
    const user = users.value.find((u) => u.id === id)
    if (user) user.deletedAt = null
    await refresh()
    toast.success({ message: t('master.clientUsers.messages.restored') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('master.clientUsers.messages.restoreFailed') })
  }
}
</script>
