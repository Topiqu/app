<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-header flex justify-center px-4 sm:px-6">
      <Transition
        enterActiveClass="transition duration-200 ease-out"
        enterFromClass="opacity-0 translate-y-3"
        enterToClass="opacity-100 translate-y-0"
        leaveActiveClass="transition duration-150 ease-in"
        leaveFromClass="opacity-100 translate-y-0"
        leaveToClass="opacity-0 translate-y-3"
      >
        <div
          v-if="dirty"
          ref="bar"
          data-unsaved-bar
          role="status"
          aria-live="polite"
          class="pointer-events-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-(--topiqu-surface-radius) border-2 border-warning bg-elevated p-4 shadow-xl"
        >
          <UIcon name="mdi:content-save-alert-outline" class="size-6 shrink-0 text-warning" aria-hidden="true" />

          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-highlighted">
              {{ $t('common.preferences.unsaved') }}
            </span>
            <span class="block text-xs text-muted">
              {{ $t('common.preferences.unsavedDescription') }}
            </span>
          </span>

          <span class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <UButton color="neutral" variant="outline" :disabled="loading" @click="emit('reset')">
              {{ $t('common.actions.discardChanges') }}
            </UButton>
            <UButton icon="mdi:content-save-outline" :loading :disabled="loading" @click="emit('save')">
              {{ $t('common.actions.saveChanges') }}
            </UButton>
          </span>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { dirty } = defineProps<{ dirty: boolean; loading?: boolean }>()
const emit = defineEmits<{ reset: []; save: [] }>()
const bar = useTemplateRef('bar')
const { height } = useElementSize(bar, { width: 0, height: 0 }, { box: 'border-box' })
const reservedHeight = useCssVar('--topiqu-unsaved-bar-height', undefined, { initialValue: '0px' })
watchEffect(() => {
  reservedHeight.value = dirty ? `${height.value + 16}px` : '0px'
})
onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.style.setProperty('--topiqu-unsaved-bar-height', '0px')
})
</script>
