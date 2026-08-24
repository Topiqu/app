<template>
  <UModal
    portal
    scrollable
    :title="title"
    data-confirm-dialog
    :ui="{
      content: 'confirm-dialog-content max-w-md',
      header: 'confirm-dialog-header',
      title: 'confirm-dialog-title',
      close: 'confirm-dialog-close',
      body: 'confirm-dialog-body',
      footer: 'confirm-dialog-footer',
    }"
  >
    <template #body>
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
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          v-if="cancelText"
          color="neutral"
          variant="outline"
          icon="i-mdi-close"
          :label="cancelText"
          class="confirm-dialog-button"
          @click="emit('close', false)"
        />
        <UButton
          :color="confirmColor"
          variant="solid"
          icon="i-mdi-check"
          :label="confirmText"
          class="confirm-dialog-button confirm-dialog-button-primary"
          @click="emit('close', true)"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    icon?: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'danger' | 'success'
  }>(),
  {
    title: undefined,
    message: undefined,
    icon: undefined,
    confirmText: 'OK',
    cancelText: undefined,
    variant: 'default',
  },
)

const emit = defineEmits<{ close: [confirmed: boolean] }>()
const confirmColor = computed(() =>
  props.variant === 'danger' ? 'error' : props.variant === 'success' ? 'success' : 'primary',
)
const resolvedIcon = computed(
  () =>
    props.icon ||
    (props.variant === 'danger'
      ? 'i-mdi-alert-outline'
      : props.variant === 'success'
        ? 'i-mdi-check-circle-outline'
        : 'i-mdi-help-circle-outline'),
)
</script>
