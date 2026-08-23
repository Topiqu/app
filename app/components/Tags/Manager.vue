<template>
  <div class="flex flex-col gap-6">
    <UFormField :label="$t('articles.tags.selectExistingTag')">
      <USelectMenu
        v-model="selectedTagId"
        :items="availableTags"
        valueKey="id"
        labelKey="name"
        :placeholder="$t('articles.tags.selectExistingTag')"
        class="w-full"
        @update:modelValue="addExisting"
      />
    </UFormField>

    <UFormField :label="$t('articles.tags.addCustomTagPlaceholder')">
      <div class="flex gap-2">
        <UInput
          v-model="newTagName"
          :placeholder="$t('articles.tags.addCustomTagPlaceholder')"
          class="flex-1"
          @keyup.enter="createNew"
        />
        <UButton color="primary" variant="solid" :disabled="!newTagName" @click="createNew">
          {{ $t('articles.tags.addButton') }}
        </UButton>
      </div>
    </UFormField>

    <div v-if="tagBuffer.length" class="flex flex-wrap gap-2">
      <div
        v-for="t in tagBuffer"
        :key="t.id"
        class="flex min-w-0 max-w-full items-center rounded-[var(--ui-radius)] border border-default bg-elevated pl-3"
      >
        <span class="max-w-64 truncate text-sm font-medium" :title="t.name">{{ t.name }}</span>
        <UButton
          color="neutral"
          variant="ghost"
          class="tag-destructive-control"
          icon="i-mdi-close"
          size="sm"
          square
          :aria-label="$t('common.actions.deleteTag')"
          :title="$t('common.actions.deleteTag')"
          @click="remove(t.id)"
        />
      </div>
    </div>
    <UEmpty v-else icon="i-mdi-tag-off-outline" :title="$t('articles.tags.noTagsFound')" />
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

const props = defineProps<{
  article?: ArticleWithDetails
  initialTags?: string[]
}>()

const emit = defineEmits<{
  'add:tag': [tagId: string]
  'delete:tag': [tagId: string]
  'create:tag': [tagId: string]
}>()

type TagOption = { id: string; name: string }
type ArticleTagRow = { tagId: string; tag: { id: string; name: string } }

const toast = useAppToast()
const requestFetch = useRequestFetch()
const { invalidateTags } = useCacheInvalidation()

const { data: allTags } = useQuery({
  key: () => queryKeys.tags.list,
  query: () => requestFetch<TagOption[]>('/api/tags'),
  placeholderData: () => [],
})

const { data: articleTags } = useQuery({
  key: () => queryKeys.articles.tags(props.article?.id ?? ''),
  query: () => requestFetch<ArticleTagRow[]>(`/api/articles/${props.article!.id}/tags`),
  enabled: () => !!props.article?.id,
  placeholderData: () => [],
})

const tagOptions = computed(() => allTags.value ?? [])

const selectedTagId = shallowRef('')
const newTagName = shallowRef('')

const tagBuffer = shallowReactive<{ id: string; name: string }[]>([])

watch(
  articleTags,
  (newVal) => {
    if (!props.article?.id) return
    const rows = newVal ?? []
    tagBuffer.length = 0
    rows.forEach((t) => tagBuffer.push({ id: t.tagId, name: t.tag.name }))
  },
  { immediate: true },
)

watch(
  () => props.initialTags,
  (newIds) => {
    if (!props.article?.id && newIds && tagOptions.value.length) {
      const tagsToAdd = tagOptions.value.filter((t) => newIds.includes(t.id))
      tagsToAdd.forEach((t) => {
        if (!tagBuffer.some((b) => b.id === t.id)) {
          tagBuffer.push({ id: t.id, name: t.name })
        }
      })
    }
  },
  { deep: true },
)

const availableTags = computed(() => tagOptions.value.filter((t) => !tagBuffer.some((b) => b.id === t.id)))

const addExisting = () => {
  if (!selectedTagId.value) return
  const tag = tagOptions.value.find((t) => t.id === selectedTagId.value)
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
    await invalidateTags()
  } catch (e: any) {
    toast.add({ color: 'error', title: $t('articles.tags.createFailed') + e.data?.message })
  }
}

const remove = (id: string) => {
  const index = tagBuffer.findIndex((t) => t.id === id)
  if (index !== -1) {
    tagBuffer.splice(index, 1)
    emit('delete:tag', id)
  }
}
</script>
