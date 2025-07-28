<template>
  <button
    class="w-10 h-10 flex items-center justify-center rounded-md p-1.5 border border-red-400 text-red-600 bg-red-50 hover:bg-red-100 hover:shadow-sm transition-all duration-150"
    title="Odhlásit se"
    @click="logout"
  >
    <Icon name="mdi:logout" class="w-6 h-6 text-red-600" />
  </button>
</template>

<script setup lang="ts">
const { signOut } = useAuth()

const logout = async () => {
  await signOut({ redirect: true, callbackUrl: '/' })
}
</script>
