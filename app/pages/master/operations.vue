<template>
  <div class="topiqu-dashboard-page space-y-5 py-6">
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
