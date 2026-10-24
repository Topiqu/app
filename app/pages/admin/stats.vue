<template>
  <div class="topiqu-dashboard-page py-6">
    <StatsDashboard />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })

useSeoMeta({ title: () => $t('stats.title') })
</script>
