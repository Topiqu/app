<template>
  <div class="flex flex-col gap-6">
    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">{{
        $t('articles.tags.selectExistingTag')
      }}</span>
      <select
        v-model="selectedTagId"
        class="p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        @change="addTagToBuffer"
      >
        <option value="" disabled>{{ $t('articles.tags.selectExistingTag') }}</option>
        <option v-for="t in tags.filter((t) => !tagBuffer.some((b) => b.id === t.id))" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
    </label>
    <label class="flex flex-col gap-3">
      <span class="text-sm font-medium uppercase tracking-wide opacity-80 dark:text-gray-200">{{
        $t('articles.tags.addCustomTagPlaceholder')
      }}</span>
      <div class="flex gap-2">
        <input
          v-model="newTag.name"
          :placeholder="$t('articles.tags.addCustomTagPlaceholder')"
          class="flex-1 p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          @input="updateSlug"
          @keyup.enter="createAndAddTag"
        />
        <button
          :disabled="!newTag.name"
          class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700"
          @click="createAndAddTag"
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
          class="ml-1 w-5 h-5 flex items-center justify-center transition-colors duration-200 bg-transparent hover:bg-transparent border-none outline-none opacity-0 group-hover:opacity-100 dark:text-red-400 dark:hover:text-red-300"
          @click="removeTagFromBuffer(t.id)"
        >
          <Icon name="mdi:close" class="w-4 h-4 text-red-500 hover:text-red-600 cursor-pointer" />
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-gray-600 dark:text-gray-400">{{ $t('articles.tags.noTagsFound') }}</p>
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

const { data: tags, refresh } = await useFetch('/api/tags', { default: () => [] })
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
    toast.error({ message: $t('articles.tags.createFailed') + e.data?.message })
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
