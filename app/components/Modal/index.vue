<template>
  <slot v-bind="actions">
    <button type="button" @click="open = true">Open dialog</button>
  </slot>
  <TransitionRoot appear :show="open" as="template">
    <Dialog as="div" class="relative z-[1000]" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div class="fixed inset-0 bg-gradient-to-br from-black/70 to-black/50 backdrop-blur-md" />
      </TransitionChild>

      <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-10"
          enterTo="opacity-100 translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-10"
        >
          <DialogPanel
            class="h-11/12 w-full max-w-xl bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 flex flex-col gap-6 overflow-y-auto border border-gray-200/70"
          >
            <div class="flex justify-between items-center gap-4">
              <slot name="header" v-bind="actions">
                <div class="grow flex flex-col">
                  <slot name="title" v-bind="actions">
                    <DialogTitle
                      v-if="title"
                      class="text-2xl font-bold bg-gradient-to-r from-gray-600 to-gray-400 bg-clip-text text-transparent"
                    >
                      {{ title }}
                    </DialogTitle>
                  </slot>
                  <slot name="description" v-bind="actions">
                    <DialogDescription
                      v-if="description"
                      class="text-lg font-semibold bg-gradient-to-r from-gray-600 to-gray-400 bg-clip-text text-transparent"
                    >
                      {{ description }}
                    </DialogDescription>
                  </slot>
                </div>
                <slot v-if="closeBtn" name="close" v-bind="actions">
                  <button
                    class="ml-auto flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors"
                    @click="close"
                  >
                    <Icon name="mdi:close" class="size-5" />
                  </button>
                </slot>
              </slot>
            </div>

            <div class="grow">
              <slot name="content" v-bind="actions" />
            </div>

            <div class="flex justify-end">
              <slot name="footer" v-bind="actions" />
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild, DialogDescription } from '@headlessui/vue'

const open = defineModel<boolean>()

const { close: closeBtn = true, onClose } = defineProps<{
  title?: string
  description?: string
  close?: boolean
  onClose?: () => void
}>()

const close = onClose || (() => (open.value = false))

const actions = computed(() => ({ open, close }))
</script>
