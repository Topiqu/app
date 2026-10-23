<template>
  <div class="mx-auto w-full max-w-screen-xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <UButton :to="localePath({ name: 'master' })" color="neutral" variant="link" icon="mdi:arrow-left">
      {{ $t('operations.clients') }}
    </UButton>
    <OperationsOverview />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'superadmin', shell: 'dashboard' })
const localePath = useLocalePath()
</script>
