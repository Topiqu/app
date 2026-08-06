<template>
  <button
    type="button"
    :disabled
    :aria-pressed="toggle ? active : undefined"
    class="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="
      active
        ? 'bg-indigo-600! hover:bg-indigo-700! border-indigo-600! text-white!'
        : 'bg-transparent! hover:bg-gray-100! dark:hover:bg-gray-800! border-gray-200! dark:border-gray-700! text-gray-600! dark:text-gray-400!'
    "
  >
    <Icon v-if="icon" :name="icon" class="w-3 h-3 shrink-0" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  active?: boolean
  toggle?: boolean
  disabled?: boolean
  icon?: string
}>()
</script>
