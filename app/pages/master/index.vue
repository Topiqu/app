<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-col gap-4 py-6 md:h-full md:overflow-hidden">
    <h1 class="sr-only">{{ $t('master.clientTable.title') }}</h1>
    <UButton
      :to="localePath({ name: 'master-operations' })"
      color="neutral"
      variant="soft"
      icon="mdi:heart-pulse"
      class="self-start"
    >
      {{ $t('operations.title') }}
    </UButton>
    <ClientTable />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'superadmin', shell: 'dashboard' })
const localePath = useLocalePath()
</script>
