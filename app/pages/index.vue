<script lang="ts" setup>
const { data: auth } = useAuth()
</script>

<template>
  <main class="flex items-center justify-center">
    <UserAccount v-if="auth" />
    <AuthForm v-else />
  </main>
</template>
