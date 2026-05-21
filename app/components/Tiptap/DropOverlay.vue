<template>
  <Transition
    enterActiveClass="transition-opacity duration-150"
    enterFromClass="opacity-0"
    enterToClass="opacity-100"
    leaveActiveClass="transition-opacity duration-150"
    leaveFromClass="opacity-100"
    leaveToClass="opacity-0"
  >
    <div
      v-if="active"
      class="absolute inset-0 z-20 flex items-center justify-center bg-indigo-500/10 border-2 border-dashed border-indigo-400 rounded-lg pointer-events-none backdrop-blur-[1px]"
      aria-hidden="true"
    >
      <div class="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-300">
        <Icon name="mdi:tray-arrow-down" class="size-12" />
        <span class="text-sm font-medium">{{ $t('articles.editor.dropZone') }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{ active: boolean }>()
</script>
