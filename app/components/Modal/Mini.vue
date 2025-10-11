<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[1000] flex items-center dark:!bg-transparent justify-center p-4">
      <div
        class="absolute inset-0 bg-neutral-900/60 dark:!bg-black/70 backdrop-blur-[2px] transition-opacity duration-200"
        :class="{ 'opacity-0': !showOverlay, 'opacity-100': showOverlay }"
        @click="close"
      />

      <div
        class="relative bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] rounded-2xl p-5 flex items-center gap-4 max-w-lg w-full backdrop-blur-xl transform transition-all duration-200"
        :class="{ 'opacity-0 scale-95': !showContent, 'opacity-100 scale-100': showContent }"
      >
        <div v-if="$slots.icon || icon" class="flex-shrink-0">
          <slot name="icon">
            <Icon v-if="icon" :name="icon" size="26" class="text-gray-500 dark:text-gray-300" />
          </slot>
        </div>

        <div class="flex-grow flex flex-col gap-1">
          <h3
            v-if="title"
            class="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-500 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent"
          >
            {{ title }}
          </h3>
          <p v-if="message" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {{ message }}
          </p>
          <slot name="content" />
        </div>

        <div class="flex-shrink-0 flex items-center gap-2">
          <slot name="actions">
            <Button
              v-if="cancelText"
              :square="true"
              size="sm"
              variant="warning"
              icon="mdi:close"
              class="!text-gray-700 dark:!text-gray-300 hover:!bg-gray-100/60 dark:hover:!bg-white/10"
              @click="cancel"
            />
            <Button
              v-if="confirmText"
              :square="true"
              size="sm"
              variant="primary"
              icon="mdi:check"
              class="!text-white hover:!brightness-110 dark:hover:!brightness-125"
              @click="confirm"
            />
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  message?: string
  icon?: string
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  (event: 'close' | 'confirm' | 'cancel'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const showOverlay = shallowRef<boolean>(false)
const showContent = shallowRef<boolean>(false)

const close = () => {
  showContent.value = false
  setTimeout(() => {
    showOverlay.value = false
    setTimeout(() => {
      isOpen.value = false
      emit('close')
    }, 100)
  }, 200)
}

const cancel = () => {
  emit('cancel')
  close()
}

const confirm = () => {
  emit('confirm')
  close()
}

watch(isOpen, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
  if (val) {
    showOverlay.value = true
    setTimeout(() => (showContent.value = true), 50)
  } else {
    close()
  }
})

onMounted(() => {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen.value) close()
  })
  if (isOpen.value) {
    showOverlay.value = true
    setTimeout(() => (showContent.value = true), 50)
  }
})
</script>
