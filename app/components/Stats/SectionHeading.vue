<template>
  <div class="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-default pb-3">
    <h3 class="min-w-0 text-xs font-semibold leading-5 uppercase tracking-wider text-muted">
      {{ title }}
    </h3>
    <p v-if="note" class="min-w-0 text-xs text-muted">{{ note }}</p>
    <div v-if="$slots.action" class="ml-auto flex shrink-0 items-center"><slot name="action" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; note?: string }>()
</script>
