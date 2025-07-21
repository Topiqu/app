<template>
  <div class="space-y-6 max-w-xl mx-auto mt-10">
    <ClientTable @refresh="refresh" />
  </div>
</template>

<script lang="ts" setup>
const { refresh } = await useFetch('/api/clients', {
  lazy: true,
  server: false,
})
</script>
