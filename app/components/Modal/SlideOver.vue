<template>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div class="fixed inset-0 bg-black/30" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div :class="['pointer-events-none fixed inset-y-0 flex max-w-full', side === 'left' ? 'left-0' : 'right-0']">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-300"
              :enterFrom="side === 'left' ? '-translate-x-full' : 'translate-x-full'"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-200"
              leaveFrom="translate-x-0"
              :leaveTo="side === 'left' ? '-translate-x-full' : 'translate-x-full'"
            >
              <DialogPanel
                :class="[
                  'pointer-events-auto w-screen bg-white dark:bg-gray-950 shadow-2xl flex flex-col',
                  widthClass,
                ]"
              >
                <div
                  v-if="title || closeBtn || $slots.header"
                  class="sticky top-0 z-10 px-6 py-4 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur"
                >
                  <slot name="header" v-bind="actions">
                    <DialogTitle v-if="title" class="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                      {{ title }}
                    </DialogTitle>
                  </slot>
                  <Button
                    v-if="closeBtn"
                    variant="neutral"
                    icon="mdi:close"
                    :aria="$t('common.actions.close')"
                    @click="close"
                  />
                </div>

                <div class="flex-1 overflow-y-auto">
                  <slot v-bind="actions" />
                </div>

                <div v-if="$slots.footer" class="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
                  <slot name="footer" v-bind="actions" />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue'

const open = defineModel<boolean>()

const {
  closeBtn = true,
  onClose,
  side = 'right',
  width = 'md',
} = defineProps<{
  title?: string
  closeBtn?: boolean
  onClose?: () => void
  side?: 'left' | 'right'
  width?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const close = onClose || (() => (open.value = false))

const widthClass = computed(
  () =>
    ({
      sm: 'sm:max-w-sm',
      md: 'sm:max-w-md',
      lg: 'sm:max-w-lg',
      xl: 'sm:max-w-xl',
    })[width],
)

const actions = computed(() => ({ open, close }))
</script>
