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
            Správa úkolů
          </DialogTitle>
          <div class="flex flex-col gap-6">
            <label class="flex flex-col gap-3">
              <span
                class="text-sm font-medium uppercase tracking-wide opacity-80"
              >
                Název úkolu
              </span>
              <input
                v-model="newTask.title"
                placeholder="Název úkolu"
                class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </label>
            <label class="flex flex-col gap-3">
              <span
                class="text-sm font-medium uppercase tracking-wide opacity-80"
              >
                Popis (volitelné)
              </span>
              <textarea
                v-model="newTask.description"
                placeholder="Popis (volitelné)"
                rows="5"
                class="p-4 rounded-2xl text-base resize-none border-b-2 focus:outline-none focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </label>
            <label class="flex flex-col gap-3">
              <span
                class="text-sm font-medium uppercase tracking-wide opacity-80"
              >
                Datum splnění
              </span>
              <input
                v-model="newTask.dueDate"
                type="date"
                class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </label>
          </div>
          <div
            v-if="tasks.length"
            class="flex flex-col gap-2 max-h-48 overflow-y-auto"
          >
            <div v-for="t in tasks" :key="t.id" class="text-gray-600">
              {{ t.title }} {{ t.completed ? '(Dokončeno)' : '' }}
            </div>
          </div>
          <p v-else class="text-gray-600">Žádné úkoly.</p>
          <div class="flex gap-4 justify-end">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
              @click="$emit('close')"
            >
              Zavřít
            </button>
            <button
              :disabled="!newTask.title"
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              @click="createTask"
            >
              Přidat úkol
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

const { data: tasks, refresh } = await useFetch('/api/tasks', {
  default: () => [],
})

const newTask = ref({ title: '', description: '', dueDate: '' })

const createTask = async () => {
  if (!newTask.value.title) return
  await $fetch('/api/tasks', {
    method: 'POST',
    body: {
      title: newTask.value.title,
      description: newTask.value.description || undefined,
      dueDate: newTask.value.dueDate || undefined,
    },
  })
  newTask.value = { title: '', description: '', dueDate: '' }
  refresh()
}
</script>
