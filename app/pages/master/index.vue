<template>
  <div class="mx-auto flex w-full max-w-[var(--topiqu-dashboard-width)] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <UPageHeader :title="$t('master.clientTable.title')" :description="$t('master.clientTable.description')" />
    <ClientTable />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'superadmin', shell: 'dashboard' })
</script>
