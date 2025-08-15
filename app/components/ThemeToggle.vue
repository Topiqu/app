<template>
  <button
    class="h-9 w-9 flex items-center justify-center rounded-full bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors duration-300 shadow-sm"
    @click="theme.toggle"
  >
    <Icon
      :name="theme.mode === 'light' ? 'mingcute:sun-fill' : 'mingcute:moon-fill'"
      size="20"
      class="text-gray-700 dark:text-gray-300"
    />
  </button>
</template>

<script setup>
const theme = useThemeStore()
</script>
