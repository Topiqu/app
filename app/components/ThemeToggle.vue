<template>
  <button
    class="h-9 w-9 flex items-center justify-center rounded-full bg-[var(--button-bg)] text-[var(--base-text)] hover:bg-[var(--color-primary-500)] transition-colors duration-300"
    @click="theme.toggle"
  >
    <Icon
      :name="theme.mode === 'light' ? 'mingcute:sun-fill' : 'mingcute:moon-fill'"
      size="20"
      class="text-[var(--base-text)]"
    />
  </button>
</template>

<script setup>
import { useThemeStore } from '~~/stores/theme'
const theme = useThemeStore()
</script>
