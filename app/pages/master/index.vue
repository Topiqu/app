<template>
  <div
    class="mx-auto flex min-h-0 w-full max-w-screen-2xl flex-col gap-4 px-4 py-6 sm:px-6 md:h-full md:overflow-hidden lg:px-8"
  >
    <h1 class="sr-only">{{ $t('master.clientTable.title') }}</h1>
    <ClientTable />
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'superadmin', shell: 'dashboard' })
</script>
