<template>
  <UButton
    type="button"
    :disabled
    :aria-pressed="toggle ? active : undefined"
    class="inline-flex items-center gap-1.5 max-w-56 rounded-full border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="[size === 'md' ? 'h-8 px-3 text-xs' : 'h-6 px-2.5 text-[11px]', surface, text]"
  >
    <UIcon v-if="icon" :name="icon" :size="size === 'md' ? 14 : 12" class="shrink-0" aria-hidden="true" />
    <!-- `text` is handed out because base.scss colours bare `span`/`label`/`a` directly, which
         beats anything inherited from this button: a slot that wraps its label in an element has
         to restate the colour, and guessing it in the consumer is how the series pill went dark
         text on an indigo fill. -->
    <slot :textTone="text" />
  </UButton>
</template>

<script setup lang="ts">
const {
  size = 'sm',
  active,
  filled,
} = defineProps<{
  /** Toggle is on. Spends the indigo accent, so keep it for on/off controls. */
  active?: boolean
  /** Control holds a value. Reads as "filled in" without competing with the publish button. */
  filled?: boolean
  toggle?: boolean
  disabled?: boolean
  icon?: string
  size?: 'sm' | 'md'
}>()

const NEUTRAL = 'bg-white! dark:bg-gray-900! hover:bg-gray-50! dark:hover:bg-gray-800!'

const surface = computed(() => {
  if (active) return 'bg-indigo-600! hover:bg-indigo-700! border-indigo-600!'
  return `${NEUTRAL} ${filled ? 'border-gray-400! dark:border-gray-500!' : 'border-gray-300! dark:border-gray-700!'}`
})

const text = computed(() => {
  if (active) return 'text-white!'
  return filled ? 'text-gray-900! dark:text-gray-100!' : 'text-gray-600! dark:text-gray-300!'
})
</script>
