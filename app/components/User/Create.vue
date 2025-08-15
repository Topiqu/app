<template>
  <Modal v-model="open" title="Přidat uživatele">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-4">
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
          </select>
        </label>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="mt-6 flex justify-end gap-4">
        <button class="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition" @click="close">Zrušit</button>

        <button
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          :disabled="!newUser.username || !newUser.email || !newUser.password"
          @click="createUser"
        >
          Vytvořit
        </button>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
const toast = useToast()

const open = defineModel<boolean>()

const props = defineProps<{ clientId: string }>()

const emit = defineEmits(['create'])

const newUser = ref({
  username: '',
  email: '',
  password: '',
  role: 'user' as 'admin' | 'user',
})

const createUser = async () => {
  try {
    const response = await $fetch('/api/users', {
      method: 'POST',
      body: { ...newUser.value, clientSiteId: props.clientId },
    })
    if (!response) throw createError('Failed to create user')

    emit('create')

    toast.success({ message: 'Uživatel vytvořen' })

    open.value = false

    newUser.value = { username: '', email: '', password: '', role: 'admin' }
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Vytvoření selhalo' })
  }
}
</script>
