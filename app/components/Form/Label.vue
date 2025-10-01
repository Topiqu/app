<template>
  <label
    class="p-1 flex items-center justify-start gap-1 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300"
  >
    <slot name="icon">
      <div class="flex items-center justify-center size-4 text-xl">
        <Icon v-if="icon" :name="icon" class="size-full text-[inherit]" />
      </div>
    </slot>
    <slot>
      {{ text }}
    </slot>
  </label>
</template>

<script lang="ts" setup>
const { text, icon } = defineProps<{ text?: string; icon?: string }>()
</script>
