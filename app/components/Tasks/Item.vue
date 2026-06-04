<template>
  <div class="text-gray-600 p-4 border-b last:border-b-0">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span :class="{ 'line-through': task.completed }">{{ task.title }}</span>
        <span v-if="task.completed" class="text-green-500 ml-2">({{ $t('common.tasks.completed') }})</span>
        <span v-if="task.dueDate" class="text-sm ml-2">
          <AppTime :datetime="task.dueDate" preset="date" />
        </span>
      </div>
      <div class="flex gap-2 items-center">
        <button @click="$emit('toggleCompleted', task.id)">
          <NuxtIcon
            :name="task.completed ? 'mdi:check-circle' : 'mdi:circle-outline'"
            class="w-6 h-6"
            :class="task.completed ? 'text-green-500' : 'text-gray-400'"
          />
        </button>
        <button class="text-blue-500 hover:underline text-sm" @click="tagsOpen = true">
          {{ $t('common.tasks.tags') }}
        </button>
      </div>
    </div>

    <TransitionRoot :show="tagsOpen" as="template">
      <TasksTag :taskId="task.id" :tags="task.tags ?? []" @close="tagsOpen = false" />
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import { TransitionRoot } from '@headlessui/vue'

defineProps<{
  task: {
    id: string
    title: string
    completed: boolean
    dueDate?: string | null
    tags?: { tagId: string; tag: { name: string } }[]
  }
}>()

const tagsOpen = ref(false)
defineEmits<{
  (e: 'toggleCompleted', taskId: string): void
}>()
</script>
