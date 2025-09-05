<template>
  <button
    :type
    :disabled="disabled || loading"
    :class="[
      { 'flex items-center justify-center': true },
      { 'backdrop-blur-sm transition-all hover:scale-105 active:scale-[0.95]': true },
      { 'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2': true },

      {
        'border border-gray-200/50 dark:border-neutral-700/50 shadow-[0_2px_6px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]':
          !borderless,
      },

      { 'cursor-not-allowed opacity-80': disabled || loading },

      square
        ? {
            'w-8 h-8': size === 'sm',
            'w-10 h-10': size === 'md',
            'h-12 h-12': size === 'lg',
          }
        : !$slots.default
          ? {
              'w-8 h-8 rounded-lg': size === 'sm',
              'w-10 h-10 rounded-xl': size === 'md',
              'h-12 h-12 rounded-2xl': size === 'lg',
            }
          : {
              'h-8 px-2 py-1 rounded-lg': size === 'sm',
              'h-10 px-4 py-2 rounded-xl': size === 'md',
              'h-12 px-6 py-3 rounded-2xl': size === 'lg',
            },

      {
        'text-white bg-blue-600': variant === 'primary',
        'text-black bg-gray-600': variant === 'secondary',
        'text-white bg-red-600': variant === 'danger',
        'text-white bg-green-600': variant === 'success',
        'text-black bg-yellow-600': variant === 'warning',
        'text-white bg-teal-600': variant === 'info',
        'text-gray-600 bg-white': variant === 'neutral',
      },
    ]"
    @click="!disabled && !loading && onClick?.($event)"
  >
    <Icon
      v-if="icon"
      :name="loading ? 'i-lucide:loader' : icon"
      :class="[
        { 'text-inherit': true },

        { 'animate-rotate': loading },

        { 'order-first': iconPosition === 'left' },
        { 'mx-auto': iconPosition === 'center' },
        { '-order-first': iconPosition === 'right' },

        {
          'w-4 h-4': size === 'sm',
          'w-5 h-5': size === 'md',
          'w-6 h-6': size === 'lg',
        },
      ]"
      class="transition-all"
    />
    <slot v-if="!square" />
  </button>
</template>

<script lang="ts" setup>
const {
  icon,
  iconPosition = 'left',
  size = 'md',
  variant = 'primary',
  disabled = false,
  loading = false,
  square = false,
  borderless = false,
  type = 'button',
  onClick,
} = defineProps<{
  icon?: string
  iconPosition?: 'left' | 'right' | 'center'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'neutral'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  square?: boolean
  borderless?: boolean
  onClick?: (event: MouseEvent) => void
}>()
</script>
