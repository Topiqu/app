<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <div class="w-full max-w-md space-y-6">
      <AuthForm :mode="initialMode" />
    </div>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'auth' })

const route = useRoute()

const initialMode = computed(() => (route.query.mode === 'register' ? 'register' : 'login'))
</script>
