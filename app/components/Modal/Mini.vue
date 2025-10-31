<template>
  <Teleport to="body">
    <TransitionRoot appear :show="isOpen" as="template">
      <Dialog as="div" class="relative z-[1000]" @close="close">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div class="fixed inset-0 bg-neutral-900/60 dark:bg-black/70 backdrop-blur-[2px]" />
        </TransitionChild>

        <div class="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              :class="[
                'relative bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] rounded-2xl p-5 flex items-center w-full backdrop-blur-xl',
                parentWidth ?? 'max-w-lg',
              ]"
            >
              <div v-if="$slots.icon || icon" class="flex-shrink-0">
                <slot name="icon">
                  <Icon v-if="icon" :name="icon" size="26" class="text-gray-500 dark:text-gray-300" />
                </slot>
              </div>

              <div class="flex-grow flex flex-col gap-1">
                <DialogTitle
                  v-if="title"
                  class="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-500 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent"
                >
                  {{ title }}
                </DialogTitle>
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
                    animation="softpop"
                    class="!text-gray-700 dark:!text-gray-300 hover:!bg-gray-100/60 dark:hover:!bg-white/10"
                    @click="cancel"
                  />
                  <Button
                    v-if="confirmText"
                    :square="true"
                    size="sm"
                    variant="primary"
                    icon="mdi:check"
                    animation="softpop"
                    class="!text-white hover:!brightness-110 dark:hover:!brightness-125"
                    @click="confirm"
                  />
                </slot>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue'

defineProps<{
  title?: string
  message?: string
  icon?: string
  confirmText?: string
  cancelText?: string
  parentWidth?: string
}>()

const emit = defineEmits<{
  (event: 'confirm' | 'cancel'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const close = () => {
  isOpen.value = false
}

const cancel = () => {
  emit('cancel')
  close()
}

const confirm = () => {
  emit('confirm')
  close()
}
</script>
