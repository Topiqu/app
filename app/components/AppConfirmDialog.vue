<template>
  <UModal
    :open
    portal
    scrollable
    :title
    data-confirm-dialog
    :ui="{
      content: 'confirm-dialog-content max-w-md',
      header: 'confirm-dialog-header',
      title: 'confirm-dialog-title',
      close: 'confirm-dialog-close',
      body: 'confirm-dialog-body',
      footer: 'confirm-dialog-footer',
    }"
    @update:open="onOpenChange"
  >
    <template #body>
      <slot name="body">
        <div class="flex items-start gap-4">
          <span
            v-if="resolvedIcon"
            class="confirm-dialog-icon flex size-10 shrink-0 items-center justify-center rounded-full"
            :data-variant="variant"
            aria-hidden="true"
          >
            <UIcon size="22" :name="resolvedIcon" />
          </span>
          <p v-if="message" class="min-w-0 pt-1.5 text-sm leading-6 text-muted">
            {{ message }}
          </p>
        </div>
      </slot>
    </template>
    <template #footer>
      <slot name="actions">
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            v-if="cancelText"
            color="neutral"
            variant="outline"
            icon="mdi:close"
            :label="cancelText"
            class="confirm-dialog-button"
            @click="finish(false)"
          />
          <UButton
            :color="confirmColor"
            variant="solid"
            icon="mdi:check"
            :label="confirmText"
            class="confirm-dialog-button confirm-dialog-button-primary"
            @click="finish(true)"
          />
        </div>
      </slot>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ConfirmOptions } from '~/composables/useConfirm'

const props = withDefaults(defineProps<ConfirmOptions>(), { confirmText: 'OK', variant: 'default' })
const emit = defineEmits<{ close: [confirmed: boolean]; confirm: []; cancel: [] }>()
const open = defineModel<boolean>('open', { default: false })
const finish = (confirmed: boolean) => {
  open.value = false
  emit('close', confirmed)
  if (confirmed) emit('confirm')
  else emit('cancel')
}
const onOpenChange = (isOpen: boolean) => {
  if (isOpen) open.value = true
  else finish(false)
}
const confirmColor = computed(() =>
  props.variant === 'danger' ? 'error' : props.variant === 'success' ? 'success' : 'primary',
)
const resolvedIcon = computed(
  () =>
    props.icon ||
    (props.variant === 'danger'
      ? 'mdi:alert-outline'
      : props.variant === 'success'
        ? 'mdi:check-circle-outline'
        : 'mdi:help-circle-outline'),
)
</script>
