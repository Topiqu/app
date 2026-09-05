<template>
  <label :for="forId" class="inline-flex items-center gap-1.5 text-sm font-medium text-highlighted">
    <UIcon v-if="icon" :name="icon" size="16" />
    {{ text }}
  </label>
</template>

<script setup lang="ts">
defineProps<{ forId?: string; text: string; icon?: string }>()
</script>
