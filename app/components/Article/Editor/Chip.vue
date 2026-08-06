<template>
  <button
    type="button"
    :disabled
    :aria-pressed="toggle ? active : undefined"
    class="inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[
      size === 'md' ? 'h-8 px-3 text-xs' : 'h-6 px-2.5 text-[11px]',
      active
        ? 'bg-indigo-600! hover:bg-indigo-700! border-indigo-600! text-white!'
        : 'bg-white! dark:bg-gray-900! hover:bg-gray-50! dark:hover:bg-gray-800! border-gray-300! dark:border-gray-700! text-gray-700! dark:text-gray-200!',
    ]"
  >
    <Icon
      v-if="icon"
      :name="icon"
      class="shrink-0"
      :class="size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>

<script setup lang="ts">
const { size = 'sm' } = defineProps<{
  active?: boolean
  toggle?: boolean
  disabled?: boolean
  icon?: string
  size?: 'sm' | 'md'
}>()
</script>
