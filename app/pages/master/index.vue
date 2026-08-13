<template>
  <main class="max-w-xl mx-auto pt-28 flex flex-col items-center gap-6">
    <ClientTable />
  </main>
</template>

<script lang="ts" setup>
definePageMeta({ middleware: 'superadmin' })
</script>
