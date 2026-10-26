<template>
  <UBadge color="info" variant="soft" icon="mdi:robot-outline" :label="$t(`articles.aiDisclosure.${involvement}`)" />
</template>

<script setup lang="ts">
defineProps<{ involvement: string }>()
</script>
