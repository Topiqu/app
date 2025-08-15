<script lang="ts" setup>
const { data: auth } = useAuth()

if (auth.value?.user.role === 'superadmin') await navigateTo('/master')
else if (auth.value?.user.role === 'admin') await navigateTo('/admin')
else if (auth.value?.user.role === 'reader') await navigateTo('/uzivatel')
</script>

<template>
  <main class="flex items-center justify-center">
    <AuthForm />
  </main>
</template>
