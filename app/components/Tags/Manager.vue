<template>
  <div class="flex flex-col gap-6">
    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80">Vybrat tagy</span>
      <select
        v-model="selectedTagId"
        class="p-4 rounded-2xl text-base border-b-2 focus:outline-none focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
        @change="addTagToBuffer"
      >
        <option value="" disabled>Vyber tag</option>
        <option v-for="t in tags" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
    </label>
    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80">Nový tag</span>
      <div class="flex gap-2">
        <input
          v-model="newTag.name"
          placeholder="Název nového tagu"
          class="flex-1 p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          @input="updateSlug"
          @keyup.enter="createAndAddTag"
        />
        <button
          :disabled="!newTag.name"
          class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          @click="createAndAddTag"
        >
          Přidat
        </button>
      </div>
    </label>
    <div v-if="tagBuffer.length" class="flex flex-col gap-4 max-h-64 overflow-y-auto">
      <div class="flex flex-col divide-y divide-gray-200">
        <div v-for="t in tagBuffer" :key="t.id" class="flex items-center justify-between py-2 group">
          <span class="text-gray-800 text-sm font-medium">{{ t.name }}</span>
          <button
            class="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            @click="removeTagFromBuffer(t.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
    <p v-else class="text-gray-600 text-sm">Žádné tagy nevybrány.</p>
  </div>
</template>

<script lang="ts" setup>
import type { Article } from '@zenstackhq/runtime/models'

import slugify from 'slugify'

type Tag = { id: string; name: string }
const emit = defineEmits(['update:tags', 'delete:tag'])
const toast = useToast()

const props = defineProps<{
  article?: Article
}>()

const { data: artTags } = useFetch(`/api/articles/${props.article?.id}/tags`, {
  default: () => [],
  key: `article-tags-${props.article?.id}`,
})

const { data: tags, refresh } = await useFetch<Tag[]>('/api/tags', {
  default: () => [],
})
const newTag = ref<{ name: string; slug: string }>({ name: '', slug: '' })
const selectedTagId = ref('')
const tagBuffer = ref<Tag[]>(
  props.article?.id && artTags.value?.length ? [...artTags.value.map((t) => ({ id: t.tagId, name: t.tag.name }))] : [],
)

const updateSlug = () => {
  newTag.value.slug = slugify(newTag.value.name, {
    lower: true,
    strict: true,
    trim: true,
  })
}

const addTagToBuffer = () => {
  if (!selectedTagId.value) return
  const tag = tags.value.find((t: Tag) => t.id === selectedTagId.value)
  if (tag && !tagBuffer.value.some((t: Tag) => t.id === tag.id)) {
    tagBuffer.value.push({ id: tag.id, name: tag.name })
    emit(
      'update:tags',
      tagBuffer.value.map((t) => t.id),
    )
  }
  selectedTagId.value = ''
}

const createAndAddTag = async () => {
  if (!newTag.value.name) return
  updateSlug()
  try {
    const { id, name } = await $fetch('/api/tags', {
      method: 'POST',
      body: { name: newTag.value.name, slug: newTag.value.slug },
    })
    tagBuffer.value.push({ id, name })
    emit(
      'update:tags',
      tagBuffer.value.map((t) => t.id),
    )
    newTag.value = { name: '', slug: '' }
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Chyba při vytváření tagu.' })
  }
}

const removeTagFromBuffer = (id: string) => {
  tagBuffer.value = tagBuffer.value.filter((t: Tag) => t.id !== id)
  if (props.article?.id) {
    emit('delete:tag', id)
  } else {
    emit(
      'update:tags',
      tagBuffer.value.map((t) => t.id),
    )
  }
}
</script>
