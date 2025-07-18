<template>
  <button
    class="flex items-center justify-center w-9 h-9 rounded-full text-red-500 hover:text-red-700 hover:bg-red-100 transition active:scale-95"
    title="Odhlásit se"
    @click="logout"
  >
    <Icon name="mdi:logout" class="w-5 h-5" />
  </button>
</template>

<script setup lang="ts">
const { signOut } = useAuth()
const toast = useToast()

const logout = async () => {
  const res = await signOut({ redirect: false })
  if (res) {
    toast.success({ message: 'Odhlášení bylo úspěšné' })
  } else {
    toast.error({ message: 'Odhlášení selhalo' })
  }
}
</script>
