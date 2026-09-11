<template>
  <span class="inline-block shrink-0 overflow-hidden rounded-md">
    <img src="/app-logo.png" :alt="alt" width="271" height="270" class="size-full object-contain dark:hidden" />
    <img
      src="/app-logo-dark.png"
      :alt="alt"
      width="264"
      height="252"
      class="hidden size-full object-contain dark:block"
    />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ alt?: string }>(), { alt: 'Topiqu' })
</script>
