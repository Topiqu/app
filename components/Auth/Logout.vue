<template>
  <button
    class="border border-red-300 text-red-500 bg-red-100 hover:bg-red-200 hover:text-red-600 transition active:scale-95"
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
