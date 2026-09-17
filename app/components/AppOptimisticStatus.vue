<template>
  <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ message }}<span aria-hidden="true">{{ marker }}</span>
  </p>
</template>

<script setup lang="ts">
const { status } = useOptimisticStatus()
const message = computed(() => (status.value.kind ? $t(`common.messages.optimistic.${status.value.kind}`) : ''))
const marker = computed(() => (status.value.sequence % 2 ? '\u00a0' : '\u00a0\u00a0'))
</script>
