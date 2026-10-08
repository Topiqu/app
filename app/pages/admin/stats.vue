<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <StatsDashboard />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })

useSeoMeta({ title: () => $t('stats.title') })
</script>
