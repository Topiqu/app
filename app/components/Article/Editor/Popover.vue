<template>
  <div ref="root" class="relative">
    <ArticleEditorChip
      :active
      :icon
      :size
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="open = !open"
      @keydown.escape="open = false"
    >
      <slot name="trigger" />
      <Icon
        name="mdi:chevron-down"
        class="shrink-0 transition-transform opacity-60"
        :class="[size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3', { 'rotate-180': open }]"
        aria-hidden="true"
      />
    </ArticleEditorChip>

    <Transition
      enterActiveClass="transition duration-150 ease-out"
      enterFromClass="opacity-0 -translate-y-1"
      enterToClass="opacity-100 translate-y-0"
      leaveActiveClass="transition duration-100 ease-in"
      leaveFromClass="opacity-100 translate-y-0"
      leaveToClass="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        role="dialog"
        :aria-label="label"
        class="absolute top-full z-popover mt-2 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
        :class="align === 'right' ? 'right-0' : 'left-0'"
        @keydown.escape="open = false"
      >
        <slot :close="() => (open = false)" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { align = 'left', size = 'sm' } = defineProps<{
  label: string
  icon?: string
  active?: boolean
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
}>()

const open = shallowRef(false)
const root = useTemplateRef<HTMLElement>('root')

onClickOutside(root, () => (open.value = false))
onKeyStroke('Escape', () => (open.value = false))
</script>
