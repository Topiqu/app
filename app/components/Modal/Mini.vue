<template>
  <TransitionRoot appear :show="isOpen" as="template">
    <Dialog as="div" class="relative z-overlay" :initialFocus="initialFocusRef" @close="close">
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

      <div
        class="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4"
        @keydown.enter.stop="onEnter"
      >
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95 translate-y-2 sm:translate-y-0"
          enterTo="opacity-100 scale-100 translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <DialogPanel
            ref="panelRef"
            :class="[
              'relative w-full bg-white/90 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] rounded-2xl backdrop-blur-xl',
              'flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5',
              'p-4 sm:p-5 pt-5 sm:pt-5',
              'max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto',
              parentWidth ?? 'max-w-lg',
            ]"
          >
            <div v-if="icon || $slots.icon" class="flex-shrink-0 hidden sm:block">
              <slot name="icon">
                <Icon
                  v-if="icon"
                  :name="icon"
                  size="26"
                  aria-hidden="true"
                  class="text-gray-500 dark:text-gray-300"
                />
              </slot>
            </div>

            <div class="flex-grow flex flex-col gap-1 min-w-0">
              <div v-if="title || icon || $slots.icon" class="flex items-center gap-2 pr-10">
                <div class="flex-shrink-0 sm:hidden">
                  <slot name="icon">
                    <Icon
                      v-if="icon"
                      :name="icon"
                      size="22"
                      aria-hidden="true"
                      class="text-gray-500 dark:text-gray-300"
                    />
                  </slot>
                </div>
                <DialogTitle
                  v-if="title"
                  class="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-500 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent break-words"
                >
                  {{ title }}
                </DialogTitle>
              </div>
              <DialogDescription
                v-if="message"
                class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed break-words"
              >
                {{ message }}
              </DialogDescription>
              <div class="mt-1">
                <slot name="content" />
              </div>
            </div>

            <div class="flex-shrink-0 flex sm:flex-col items-stretch sm:items-center gap-2 sm:ml-2">
              <slot name="actions">
                <Button
                  v-if="cancelText"
                  size="sm"
                  variant="warning"
                  icon="mdi:close"
                  animation="softpop"
                  :aria="cancelText"
                  :title="cancelText"
                  class="sm:hidden flex-1 !text-gray-700 dark:!text-gray-300 hover:!bg-gray-100/60 dark:hover:!bg-white/10"
                  @click="cancel"
                >
                  {{ cancelText }}
                </Button>
                <Button
                  v-if="cancelText"
                  square
                  size="sm"
                  variant="warning"
                  icon="mdi:close"
                  animation="softpop"
                  :aria="cancelText"
                  :title="cancelText"
                  class="hidden sm:flex !text-gray-700 dark:!text-gray-300 hover:!bg-gray-100/60 dark:hover:!bg-white/10"
                  @click="cancel"
                />

                <Button
                  v-if="confirmText"
                  size="sm"
                  variant="primary"
                  icon="mdi:check"
                  animation="softpop"
                  :aria="confirmText"
                  :title="confirmText"
                  class="sm:hidden flex-1 !text-white hover:!brightness-110 dark:hover:!brightness-125"
                  @click="confirm"
                >
                  {{ confirmText }}
                </Button>
                <Button
                  v-if="confirmText"
                  square
                  size="sm"
                  variant="primary"
                  icon="mdi:check"
                  animation="softpop"
                  :aria="confirmText"
                  :title="confirmText"
                  class="hidden sm:flex !text-white hover:!brightness-110 dark:hover:!brightness-125"
                  @click="confirm"
                />
              </slot>
            </div>

            <div class="absolute top-2 right-2 sm:top-3 sm:right-3">
              <slot name="close">
                <Button
                  v-if="!cancelText"
                  square
                  variant="transparent"
                  size="sm"
                  borderless
                  :aria="$t('common.closeDialog')"
                  :title="$t('common.closeDialog')"
                  icon="mdi:close"
                  class="!text-gray-600 dark:!text-gray-400 hover:!bg-gray-100 dark:hover:!bg-gray-800"
                  @click="close"
                />
              </slot>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogDescription,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue'

const props = defineProps<{
  title?: string
  message?: string
  icon?: string
  confirmText?: string
  cancelText?: string
  parentWidth?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const isOpen = defineModel<boolean>('open', { default: false })

const slots = useSlots()
const panelRef = useTemplateRef<{ el?: HTMLElement } | HTMLElement>('panelRef')
const initialFocusRef = shallowRef<HTMLElement | null>(null)

watch(isOpen, async (open) => {
  if (!open) return (initialFocusRef.value = null)
  await nextTick()
  const root = (panelRef.value as { el?: HTMLElement })?.el ?? (panelRef.value as HTMLElement | null)
  if (!root) return
  initialFocusRef.value =
    root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]',
    ) ?? null
})

const close = () => (isOpen.value = false)

const cancel = () => {
  emit('cancel')
  close()
}

const confirm = () => {
  emit('confirm')
  close()
}

const onEnter = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.tagName === 'TEXTAREA' || target?.getAttribute('contenteditable') === 'true') return
  if (event.isComposing) return
  if (slots.actions || !props.confirmText) return
  event.preventDefault()
  confirm()
}
</script>
