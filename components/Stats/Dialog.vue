<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-90"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-100"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-90"
      >
        <DialogPanel
          class="w-full max-w-lg bg-white p-10 rounded-3xl shadow-2xl flex flex-col gap-8 border backdrop-blur-sm"
        >
          <DialogTitle class="text-xl font-bold text-gray-900">
            Statistiky
          </DialogTitle>

          <div class="flex flex-col gap-6">
            <p class="text-gray-600 text-sm">Viky</p>
          </div>

          <div class="flex gap-4 justify-end">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm"
              @click="$emit('close')"
            >
              Zavřít
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
} from '@headlessui/vue'

defineEmits(['close'])
</script>
