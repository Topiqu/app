<template>
  <div class="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-2 dark:border-neutral-800">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
      {{ title }}
    </h3>
    <p v-if="note" class="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400" :title="note">{{ note }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; note?: string }>()
</script>
