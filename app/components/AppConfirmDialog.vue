<template>
  <UModal v-model:open="open" :title="display.title" :description="display.message">
    <template v-if="$slots.body" #body><slot name="body" /></template>
    <template #footer>
      <slot name="actions">
        <div class="flex w-full justify-end gap-2">
          <UButton v-if="display.cancelText" color="neutral" variant="outline" @click="cancel">
            {{ display.cancelText }}
          </UButton>
          <UButton :color="display.variant === 'danger' ? 'error' : 'primary'" @click="confirm">
            {{ display.confirmText }}
          </UButton>
        </div>
      </slot>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ConfirmOptions } from '~/composables/useConfirm'

const props = withDefaults(defineProps<ConfirmOptions>(), { variant: 'default' })
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = defineModel<boolean>('open', { default: false })
const overrides = shallowRef<ConfirmOptions>({})
const display = computed(() => ({ ...props, ...overrides.value }))
let resolve: ((answer: 'ok' | 'no') => void) | undefined

const ask = (options: ConfirmOptions = {}) => {
  resolve?.('no')
  overrides.value = options
  open.value = true
  return new Promise<'ok' | 'no'>((done) => {
    resolve = done
  })
}

const finish = (answer: 'ok' | 'no') => {
  open.value = false
  resolve?.(answer)
  resolve = undefined
  overrides.value = {}
}
const confirm = () => {
  emit('confirm')
  finish('ok')
}
const cancel = () => {
  emit('cancel')
  finish('no')
}

watch(open, (isOpen, wasOpen) => {
  if (!isOpen && wasOpen && resolve) {
    resolve('no')
    resolve = undefined
    overrides.value = {}
  }
})

onBeforeUnmount(() => resolve?.('no'))

defineExpose({ ask })
</script>
