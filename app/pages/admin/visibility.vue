<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('visibility.title') })
</script>
<template><StatsVisibilityOverview /></template>
