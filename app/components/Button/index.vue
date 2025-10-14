<template>
  <button
    :type
    :disabled="disabled || loading"
    :aria-label="aria || (typeof $attrs.title === 'string' ? $attrs.title : undefined)"
    :class="[
      'flex items-center justify-center backdrop-blur-sm',
      'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
      { ' transition-all hover:scale-105 active:scale-[0.95]': animation !== 'explode' },
      borderless
        ? 'border-none shadow-none'
        : 'border border-gray-200/50 dark:border-neutral-700/50 shadow-[0_2px_6px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]',
      disabled || loading ? 'cursor-not-allowed opacity-80' : '',
      square
        ? {
            'w-8 h-8': size === 'sm',
            'w-10 h-10': size === 'md',
            'w-12 h-12': size === 'lg',
          }
        : !$slots.default
          ? {
              'w-8 h-8 gap-1 rounded-lg': size === 'sm',
              'w-10 h-10 gap-1.5 rounded-xl': size === 'md',
              'w-12 h-12 gap-2 rounded-2xl': size === 'lg',
            }
          : {
              'h-8 px-2 py-1 gap-1 rounded-lg': size === 'sm',
              'h-10 px-4 py-2 gap-1.5 rounded-xl': size === 'md',
              'h-12 px-6 py-3 gap-2 rounded-2xl': size === 'lg',
            },
      active
        ? {
            'bg-blue-400': variant === 'primary',
            'bg-gray-400': variant === 'secondary',
            'bg-red-400': variant === 'danger',
            'bg-green-400': variant === 'success',
            'bg-yellow-400': variant === 'warning',
            'bg-teal-400': variant === 'info',
            'bg-white/80': variant === 'neutral',
          }
        : {
            'bg-blue-600': variant === 'primary',
            'bg-gray-600': variant === 'secondary',
            'bg-red-600': variant === 'danger',
            'bg-green-600': variant === 'success',
            'bg-yellow-600': variant === 'warning',
            'bg-teal-600': variant === 'info',
            'bg-white': variant === 'neutral',
          },
      {
        'text-white hover:bg-blue-800': variant === 'primary',
        'text-black hover:bg-gray-800': variant === 'secondary',
        'text-white hover:bg-red-800': variant === 'danger',
        'text-white hover:bg-green-800': variant === 'success',
        'text-white hover:bg-yellow-800': variant === 'warning',
        'text-white hover:bg-teal-800': variant === 'info',
        'text-gray-600': variant === 'neutral',
      },
      animation !== 'none' && animating && animationClass(animation),
    ]"
    @click="handleClick"
  >
    <Icon
      v-if="icon.length || loading"
      :name="loading ? 'i-lucide:loader' : icon"
      :class="[
        'text-inherit',
        loading ? 'animate-rotate' : '',
        iconPosition === 'left' ? 'order-first' : '',
        iconPosition === 'center' ? 'mx-auto' : '',
        iconPosition === 'right' ? '-order-first' : '',
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

<script setup lang="ts">
const animating = shallowRef<boolean>(false)
const reversing = shallowRef<boolean>(false)

const handleClick = (e: MouseEvent) => {
  if (disabled || loading || animating.value) return
  if (animation !== 'none') {
    animating.value = true
    triggerAnimation()
  }
  onClick?.(e)
}

const triggerAnimation = () => {
  const duration =
    animation === 'fadeout'
      ? 300
      : animation === 'logout'
        ? 350
        : animation === 'explode'
          ? 250
          : animation === 'softpop'
            ? 450
            : 0
  setTimeout(startReverse, duration)
}
const startReverse = () => {
  reversing.value = true
  setTimeout(() => {
    reversing.value = false
    animating.value = false
  }, 250)
}

const animationClass = (anim: string) => {
  const base = 'transition-all ease-[cubic-bezier(0.4,0,0.2,1)]'
  if (reversing.value) return `${base} duration-200 opacity-100 scale-100 translate-y-0 rotate-0 blur-0`
  switch (anim) {
    case 'fadeout':
      return `${base} duration-300 opacity-0 scale-95`
    case 'logout':
      return `${base} duration-350 -translate-y-2 -rotate-[1deg] scale-92`
    case 'explode':
      return `${base} duration-450 scale-108 blur-[5px] brightness-115 contrast-105`
    case 'softpop':
      return `${base} duration-450 scale-108 blur-[4px] saturate-125 brightness-115`
    default:
      return ''
  }
}

const {
  icon = '',
  iconPosition = 'left',
  size = 'md',
  variant = 'primary',
  active = false,
  disabled = false,
  loading = false,
  square = false,
  borderless = false,
  type = 'button',
  aria = '',
  animation = 'none',
  onClick,
} = defineProps<{
  icon?: string
  iconPosition?: 'left' | 'right' | 'center'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'neutral' | 'transparent'
  type?: 'button' | 'submit' | 'reset'
  active?: boolean
  disabled?: boolean
  loading?: boolean
  square?: boolean
  borderless?: boolean
  aria?: string
  animation?: 'none' | 'fadeout' | 'logout' | 'explode' | 'softpop'
  onClick?: (event: MouseEvent) => void
}>()
</script>
