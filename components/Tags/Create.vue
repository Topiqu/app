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
          <DialogTitle class="text-xl font-bold text-gray-900"
            >Správa tagů</DialogTitle
          >
          <div class="flex flex-col gap-6">
            <label class="flex flex-col gap-3">
              <span
                class="text-sm font-medium uppercase tracking-wide opacity-80"
                >Název tagu</span
              >
              <input
                v-model="newTag.name"
                placeholder="Název tagu"
                class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </label>
          </div>
          <div
            v-if="tags.length"
            class="flex flex-col gap-2 max-h-48 overflow-y-auto"
          >
            <div v-for="t in tags" :key="t.id" class="text-gray-600">
              {{ t.name }}
            </div>
          </div>
          <p v-else class="text-gray-600">Žádné tagy.</p>
          <div class="flex gap-4 justify-end">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
              @click="$emit('close')"
            >
              Zavřít
            </button>
            <button
              :disabled="!newTag.name"
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              @click="createTag"
            >
              Přidat tag
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

const { data: tags, refresh } = await useFetch('/api/tags', {
  default: () => [],
})

const newTag = ref({ name: '' })

const createTag = async () => {
  if (!newTag.value.name) return
  await $fetch('/api/tags', {
    method: 'POST',
    body: {
      name: newTag.value.name,
    },
  })
  newTag.value = { name: '' }
  refresh()
}
</script>
