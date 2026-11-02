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
    <template v-else-if="language === 'es'">
      <path fill="#aa151b" d="M0 0h30v20H0z" />
      <path fill="#f1bf00" d="M0 5h30v10H0z" />
    </template>
    <template v-else-if="language === 'it'">
      <path fill="#009246" d="M0 0h10v20H0z" />
      <path fill="#fff" d="M10 0h10v20H10z" />
      <path fill="#ce2b37" d="M20 0h10v20H20z" />
    </template>
    <template v-else-if="language === 'pl'">
      <path fill="#fff" d="M0 0h30v10H0z" />
      <path fill="#dc143c" d="M0 10h30v10H0z" />
    </template>
    <template v-else-if="language === 'sk'">
      <path fill="#fff" d="M0 0h30v7H0z" />
      <path fill="#0b4ea2" d="M0 7h30v6H0z" />
      <path fill="#ee1c25" d="M0 13h30v7H0z" />
      <path fill="#fff" d="M7 4h8v8.5c0 2.6-2 4-4 5-2-1-4-2.4-4-5z" />
      <path fill="#ee1c25" d="M7.6 4.6h6.8v7.9c0 2.2-1.7 3.4-3.4 4.3-1.7-.9-3.4-2.1-3.4-4.3z" />
      <path fill="#fff" d="M10.6 6h.8v8h-.8zM9 7.6h4v.8H9zM9.4 9.6h3.2v.8H9.4z" />
    </template>
    <template v-else-if="language === 'nl'">
      <path fill="#ae1c28" d="M0 0h30v7H0z" />
      <path fill="#fff" d="M0 7h30v6H0z" />
      <path fill="#21468b" d="M0 13h30v7H0z" />
    </template>
    <template v-else-if="language === 'pt'">
      <path fill="#046a38" d="M0 0h12v20H0z" />
      <path fill="#da291c" d="M12 0h18v20H12z" />
      <circle cx="12" cy="10" r="3.5" fill="#ffe900" />
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
