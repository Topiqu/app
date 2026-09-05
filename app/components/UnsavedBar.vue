<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-header flex justify-center px-4 sm:bottom-6 sm:px-6">
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
          role="status"
          aria-live="polite"
          class="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default/85 p-2 pl-4 shadow-xl ring-1 ring-warning/15 backdrop-blur-md sm:w-auto sm:rounded-full"
        >
          <span class="relative flex size-2.5 shrink-0">
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-warning/60 motion-reduce:hidden"
              aria-hidden="true"
            />
            <span class="relative inline-flex size-2.5 rounded-full bg-warning" aria-hidden="true" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-highlighted">
              {{ $t('common.preferences.unsaved') }}
            </span>
            <span class="hidden truncate text-xs text-muted sm:block">
              {{ $t('common.preferences.unsavedDescription') }}
            </span>
          </span>

          <span class="flex shrink-0 items-center gap-1.5">
            <UButton color="neutral" variant="ghost" size="sm" :disabled="loading" @click="emit('reset')">
              {{ $t('common.actions.reset') }}
            </UButton>
            <UButton size="sm" icon="mdi:content-save-outline" :loading @click="emit('save')">
              {{ $t('common.actions.saveChanges') }}
            </UButton>
          </span>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ dirty: boolean; loading?: boolean }>()
const emit = defineEmits<{ reset: []; save: [] }>()
</script>
