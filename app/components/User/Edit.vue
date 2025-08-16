<template>
  <Modal v-model="open" title="Upravit uživatele" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>
    <template #content>
      <div class="flex-1 overflow-y-auto pr-4">
        <div class="flex flex-col gap-6">
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200"
              >Uživatelské jméno</span
            >
            <input
              v-model="editedUser.username"
              placeholder="Uživatelské jméno"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">Email</span>
            <input
              v-model="editedUser.email"
              placeholder="Email"
              type="email"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">Heslo</span>
            <input
              v-model="editedUser.password"
              placeholder="Nové heslo (nechte prázdné pro zachování)"
              type="password"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            />
          </label>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex gap-4 justify-end flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
        >
          Zavřít
        </button>
        <button
          :disabled="!editedUser.username || !editedUser.email"
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveEdit"
        >
          Uložit změny
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'

const props = defineProps<{
  user: { id: string; username: string; email: string; role?: string }
}>()
const emit = defineEmits(['saved'])
const open = defineModel<boolean>()
const toast = useToast()

const editedUser = ref({
  id: props.user.id,
  username: props.user.username,
  email: props.user.email,
  password: '',
})

const saveEdit = async () => {
  if (!editedUser.value.username || !editedUser.value.email) {
    toast.error({ message: 'Vyplňte uživatelské jméno a email' })
    return
  }
  try {
    const body: any = {
      username: editedUser.value.username,
      email: editedUser.value.email,
    }
    if (editedUser.value.password) body.password = editedUser.value.password
    await $fetch(`/api/users/${editedUser.value.id}`, {
      method: 'PATCH',
      body,
    })
    emit('saved')
    toast.success({ message: 'Uživatel úspěšně upraven' })
    open.value = false
  } catch (error: any) {
    toast.error({ message: error?.data?.message || error.message || 'Nepodařilo se aktualizovat uživatele' })
  }
}

const confirmClose = async () => {
  if (!editedUser.value.username && !editedUser.value.email && !editedUser.value.password) {
    open.value = false
    return
  }
  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Úprava uživatele bude zrušena. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}
</script>
