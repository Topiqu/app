<template>
  <svg viewBox="0 0 30 20" class="inline-block h-4 w-6 shrink-0 overflow-hidden rounded-sm" aria-hidden="true">
    <template v-if="language === 'cs'">
      <path fill="#fff" d="M0 0h30v10H0z" />
      <path fill="#d7141a" d="M0 10h30v10H0z" />
      <path fill="#11457e" d="m0 0 15 10L0 20z" />
    </template>
    <template v-else-if="language === 'de'">
      <path fill="#000" d="M0 0h30v7H0z" />
      <path fill="#d00" d="M0 7h30v6H0z" />
      <path fill="#ffce00" d="M0 13h30v7H0z" />
    </template>
    <template v-else-if="language === 'fr'">
      <path fill="#002395" d="M0 0h10v20H0z" />
      <path fill="#fff" d="M10 0h10v20H10z" />
      <path fill="#ed2939" d="M20 0h10v20H20z" />
    </template>
    <template v-else>
      <path fill="#012169" d="M0 0h30v20H0z" />
      <path stroke="#fff" stroke-width="4" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#c8102e" stroke-width="1.5" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#fff" stroke-width="7" d="M15 0v20M0 10h30" />
      <path stroke="#c8102e" stroke-width="4" d="M15 0v20M0 10h30" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ language: string }>()
</script>
