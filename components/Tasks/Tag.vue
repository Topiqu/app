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
                v-model="newTag"
                placeholder="Název tagu"
                class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </label>
            <div class="flex gap-4">
              <button
                class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!newTag"
                @click="addCustomTag"
              >
                Přidat vlastní tag
              </button>
              <select
                v-model="selectedTagId"
                class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                @change="addExistingTag"
              >
                <option value="" disabled>Vybrat existující tag</option>
                <option
                  v-for="tag in availableTags"
                  :key="tag.id"
                  :value="tag.id"
                >
                  {{ tag.name }}
                </option>
              </select>
            </div>
          </div>
          <Icon
            v-if="status === 'pending'"
            name="mdi:loading"
            class="animate-spin"
          />
          <div
            v-else-if="tags.length"
            class="flex flex-col gap-2 max-h-48 overflow-y-auto"
          >
            <div
              v-for="tag in tags"
              :key="tag.tagId"
              class="flex justify-between items-center text-gray-600"
            >
              <span>{{ tag.tag.name }}</span>
              <button
                class="text-red-500 hover:text-red-700 font-medium hover:underline"
                @click="removeTag(tag.tagId)"
              >
                Odstranit
              </button>
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

type Tag = { id: string; name: string; createdAt: string; updatedAt: string }
type TaskTag = { tagId: string; tag: { name: string } }

const props = defineProps<{
  taskId: string
  tags: { tagId: string; tag: { name: string } }[]
}>()
defineEmits<{ (e: 'close'): void }>()

const newTag = ref('')
const selectedTagId = ref('')
const tags = ref(props.tags)

const { data: taskTags, refresh: refreshTaskTags } = await useFetch<TaskTag[]>(
  `/api/tasks/${props.taskId}/tags`,
  { default: () => [] },
)
const {
  data: availableTags,
  status,
  refresh: refreshAvailableTags,
} = await useFetch<Tag[]>(`/api/tasks/${props.taskId}/available-tags`, {
  default: () => [],
})

tags.value = taskTags.value ?? []

const addCustomTag = async () => {
  if (newTag.value.trim()) {
    try {
      const tag = await $fetch('/api/tags', {
        method: 'POST',
        body: { name: newTag.value.trim() },
      })
      await $fetch(`/api/tasks/${props.taskId}/tags`, {
        method: 'POST',
        body: { taskId: props.taskId, tagId: tag.id },
      })
      await Promise.all([refreshTaskTags(), refreshAvailableTags()])
      newTag.value = ''
    } catch (e) {
      console.error(e)
    }
  }
}

const addExistingTag = async () => {
  if (selectedTagId.value) {
    await $fetch(`/api/tasks/${props.taskId}/tags`, {
      method: 'POST',
      body: { tagId: selectedTagId.value },
    })
    await Promise.all([refreshTaskTags(), refreshAvailableTags()])
    selectedTagId.value = ''
  }
}

const removeTag = async (tagId: string) => {
  await $fetch(`/api/tasks/${props.taskId}/tags/${tagId}`, { method: 'DELETE' })
  await Promise.all([refreshTaskTags(), refreshAvailableTags()])
}
</script>
