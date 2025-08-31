<template>
  <button
    class="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 shadow-sm hover:shadow-md"
    @click="theme.toggle"
  >
    <Icon
      :name="theme.mode === 'light' ? 'mingcute:sun-fill' : 'mingcute:moon-fill'"
      class="w-6 h-6 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
    />
  </button>
</template>

<script setup>
const theme = useThemeStore()
</script>
