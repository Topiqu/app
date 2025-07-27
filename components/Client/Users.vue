<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-200"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-md" />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-4">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-95"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-200"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-95"
      >
        <DialogPanel
          class="bg-white p-6 rounded-2xl shadow-lg max-w-xl w-full max-h-[80vh] overflow-y-auto"
        >
          <DialogTitle class="text-xl font-bold text-gray-900 mb-4">
            Uživatelé klienta
          </DialogTitle>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm divide-y divide-gray-200">
              <thead class="bg-gray-100 text-left font-semibold text-gray-600">
                <tr>
                  <th class="px-4 py-2">Uživatelské jméno</th>
                  <th class="px-4 py-2">Email</th>
                  <th class="px-4 py-2">Role</th>
                  <th class="px-4 py-2">Akce</th>
                </tr>
              </thead>
              <tbody class="text-gray-800">
                <tr
                  v-for="user in users"
                  :key="user.id"
                  class="transition hover:bg-gray-50"
                >
                  <td class="px-4 py-2 break-words max-w-[180px] text-center">
                    {{ user.username }}
                  </td>
                  <td class="px-4 py-2 break-words max-w-[180px] text-center">
                    {{ user.email }}
                  </td>
                  <td class="px-4 py-2 text-center">{{ user.role }}</td>
                  <td
                    class="px-4 py-2 flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center"
                  >
                    <button
                      class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                      @click="$emit('edit', user)"
                    >
                      <Icon name="mdi:pencil" class="w-5 h-5" />
                    </button>
                    <button
                      v-if="session?.user?.role === 'superadmin'"
                      class="flex items-center justify-center w-full sm:w-10 h-10 bg-gradient-to-r from-red-200 to-red-300 text-gray-800 rounded-full hover:from-red-300 hover:to-red-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                      @click="del(user.id)"
                    >
                      <Icon name="mdi:delete" class="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-6 flex justify-end">
            <button
              class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              @click="$emit('close')"
            >
              Zavřít
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
} from '@headlessui/vue'
import Swal from 'sweetalert2'

const props = defineProps<{ clientId: string }>()
defineEmits(['close', 'edit'])
const toast = useToast()
const { data: session } = useAuth()

const { data: clientData } = await useFetch(
  `/api/users/${props.clientId}/by-clientside`,
  {
    default: () => null,
  },
)

const users = ref(clientData.value || [])

const del = async (id: string) => {
  const r = await Swal.fire({
    title: 'Smazat uživatele?',
    text: 'Tento uživatel bude trvale odstraněn.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, smazat',
    cancelButtonText: 'Ne',
    background: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
  })
  if (r.isConfirmed) {
    try {
      await $fetch(`/api/users/${id}`, { method: 'DELETE' })
      toast.success({ message: 'Uživatel smazán' })
      users.value = users.value.filter((u) => u.id !== id)
    } catch (e: any) {
      toast.error({ message: e.data?.message || 'Smazání selhalo' })
    }
  }
}
</script>
