<template>
  <div class="flex flex-col gap-6">
    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">
        {{ $t('articles.tags.selectExistingTag') }}
      </span>
      <select
        v-model="selectedTagId"
        class="p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        @change="addExisting"
      >
        <option value="" disabled>{{ $t('articles.tags.selectExistingTag') }}</option>
        <option v-for="t in availableTags" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
    </label>

    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">
        {{ $t('articles.tags.addCustomTagPlaceholder') }}
      </span>
      <div class="flex gap-2">
        <input
          v-model="newTagName"
          :placeholder="$t('articles.tags.addCustomTagPlaceholder')"
          class="flex-1 p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          @keyup.enter="createNew"
        />
        <button
          :disabled="!newTagName"
          class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
          @click="createNew"
        >
          {{ $t('articles.tags.addButton') }}
        </button>
      </div>
    </label>

    <div v-if="tagBuffer.length" class="flex flex-wrap gap-2">
      <div
        v-for="t in tagBuffer"
        :key="t.id"
        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all duration-200 group dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
        {{ t.name }}
        <button
          class="ml-1 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          @click="remove(t.id)"
        >
          <Icon name="mdi:close" class="w-4 h-4 text-red-500 hover:text-red-600" />
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-gray-600 dark:text-gray-400">
      {{ $t('articles.tags.noTagsFound') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

const props = defineProps<{ article?: ArticleWithDetails }>()

const emit = defineEmits<{
  'add:tag': [tagId: string]
  'delete:tag': [tagId: string]
  'create:tag': [tagId: string]
}>()

const toast = useToast()
const { data: allTags, refresh } = await useFetch('/api/tags', { default: () => [] })

const { data: articleTags } = useFetch(`/api/articles/${props.article?.id}/tags`, { default: () => [] })

const selectedTagId = shallowRef('')
const newTagName = shallowRef('')

const tagBuffer = shallowReactive<{ id: string; name: string }[]>(
  articleTags.value?.map((t) => ({ id: t.tagId, name: t.tag.name })) || [],
)

watch(
  articleTags,
  (newVal) => {
    tagBuffer.length = 0
    newVal?.forEach((t) => tagBuffer.push({ id: t.tagId, name: t.tag.name }))
  },
  { immediate: true },
)

const availableTags = computed(() => allTags.value.filter((t) => !tagBuffer.some((b) => b.id === t.id)))

const addExisting = () => {
  if (!selectedTagId.value) return
  const tag = allTags.value.find((t) => t.id === selectedTagId.value)
  if (tag && !tagBuffer.some((b) => b.id === tag.id)) {
    tagBuffer.push({ id: tag.id, name: tag.name })
    emit('add:tag', tag.id)
  }
  selectedTagId.value = ''
}

const createNew = async () => {
  if (!newTagName.value.trim()) return
  const slug = slugify(newTagName.value, { lower: true, strict: true, trim: true })
  try {
    const { id, name } = await $fetch('/api/tags', {
      method: 'POST',
      body: { name: newTagName.value.trim(), slug },
    })
    tagBuffer.push({ id, name })
    emit('create:tag', id)
    newTagName.value = ''
    await refresh()
  } catch (e: any) {
    toast.error({ message: $t('articles.tags.createFailed') + e.data?.message })
  }
}

const remove = (id: string) => {
  tagBuffer.splice(
    tagBuffer.findIndex((t) => t.id === id),
    1,
  )
  if (props.article?.id) {
    emit('delete:tag', id)
  }
}
</script>
