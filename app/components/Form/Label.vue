<template>
  <component
    :is="as"
    class="p-1 flex items-center justify-start gap-1 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300"
  >
    <slot name="icon">
      <div v-if="icon" class="flex items-center justify-center size-4 text-xl">
        <Icon :name="icon" class="size-full text-[inherit]" />
      </div>
    </slot>
    <slot>
      {{ text }}
    </slot>
  </component>
</template>

<script lang="ts" setup>
// `as="span"` for group titles (radiogroups, fieldsets) that label a control set, not a single input.
const { text, icon, as = 'label' } = defineProps<{ text?: string; icon?: string; as?: string }>()
</script>
