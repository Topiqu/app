<template>
  <Modal v-model="open" title="Správa úkolů">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Název úkolu </span>
          <input
            v-model="newTask.title"
            placeholder="Název úkolu"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Popis (volitelné) </span>
          <textarea
            v-model="newTask.description"
            placeholder="Popis (volitelné)"
            rows="5"
            class="p-4 rounded-2xl text-base resize-none border-b-2 focus:outline-none focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Datum splnění </span>
          <input
            v-model="newTask.dueDate"
            type="date"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
        </label>
      </div>

      <div v-if="tasks.length" class="flex flex-col gap-2 max-h-48 overflow-y-auto">
        <div v-for="t in tasks" :key="t.id" class="text-gray-600">
          {{ t.title }} {{ t.completed ? '(Dokončeno)' : '' }}
        </div>
      </div>
      <p v-else class="text-gray-600">Žádné úkoly.</p>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
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
    </template>
  </Modal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()

const { data: tasks, refresh } = await useFetch<{ id: string; title: string; completed: boolean }[]>('/api/tasks', {
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
