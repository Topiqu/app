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
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-95"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-150"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-95"
      >
        <DialogPanel
          class="w-full max-w-xl bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-200"
        >
          <DialogTitle class="text-2xl font-bold text-gray-900">
            Tagy článku
          </DialogTitle>

          <div class="flex flex-wrap gap-2 mt-4">
            <div
              v-for="t in tags"
              :key="t.tagId"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
            >
              {{ t.tag.name }}
              <button
                class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-blue-700 hover:text-red-600 transition"
                @click="removeTag(t.tagId)"
              >
                <span class="text-lg leading-none font-bold">×</span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-4 mt-6">
            <div class="flex gap-2">
              <input
                v-model="newTag"
                placeholder="Přidat vlastní tag"
                class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                class="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
                @click="addCustomTag"
              >
                Přidat
              </button>
            </div>

            <div class="flex gap-2">
              <select
                v-model="selectedTagId"
                class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Vyber existující tag</option>
                <option v-for="t in availableTags" :key="t.id" :value="t.id">
                  {{ t.name }}
                </option>
              </select>
              <button
                class="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
                @click="addExistingTag"
              >
                Přidat
              </button>
            </div>
          </div>

          <div class="flex justify-end mt-6">
            <button
              class="px-6 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium transition"
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

const toast = useToast()

type Tag = { id: string; name: string; createdAt: string; updatedAt: string }
type ArticleTag = { tagId: string; tag: { name: string } }

const props = defineProps<{ articleId: string }>()
defineEmits(['close'])

const newTag = ref('')
const selectedTagId = ref('')
const tags = ref<ArticleTag[]>([])

const { data: articleTags, refresh: refreshTags } = await useFetch<
  ArticleTag[]
>(`/api/articles/${props.articleId}/tags`, { default: () => [] })
tags.value = articleTags.value ?? []

const { data: availableTags, refresh: refreshAvailableTags } = await useFetch<
  Tag[]
>(`/api/articles/${props.articleId}/available-tags`, { default: () => [] })

const addCustomTag = async () => {
  if (!newTag.value.trim()) return
  try {
    const tag = await $fetch('/api/tags', {
      method: 'POST',
      body: { name: newTag.value.trim() },
    })
    await $fetch(`/api/articles/${props.articleId}/tags`, {
      method: 'POST',
      body: { tagId: tag.id },
    })
    await Promise.all([refreshTags(), refreshAvailableTags()])
    tags.value = articleTags.value ?? []
    newTag.value = ''
    toast.success({ message: 'Tag přidán' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Přidání tagu selhalo' })
  }
}

const addExistingTag = async () => {
  if (!selectedTagId.value) return
  try {
    await $fetch(`/api/articles/${props.articleId}/tags`, {
      method: 'POST',
      body: { tagId: selectedTagId.value },
    })
    await Promise.all([refreshTags(), refreshAvailableTags()])
    tags.value = articleTags.value ?? []
    selectedTagId.value = ''
    toast.success({ message: 'Tag přidán' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Přidání tagu selhalo' })
  }
}

const removeTag = async (tagId: string) => {
  try {
    await $fetch(`/api/articles/${props.articleId}/tags/${tagId}`, {
      method: 'DELETE',
    })
    await Promise.all([refreshTags(), refreshAvailableTags()])
    tags.value = articleTags.value ?? []
    toast.success({ message: 'Tag odebrán' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Odebrání tagu selhalo' })
  }
}
</script>
