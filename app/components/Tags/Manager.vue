<template>
  <div class="flex flex-col gap-3">
    <div>
      <div class="mb-2 flex items-center justify-between gap-3">
        <p class="text-xs font-medium text-muted">{{ $t('articles.tags.selected') }}</p>
        <span v-if="tagBuffer.length" class="text-xs tabular-nums text-muted">{{ tagBuffer.length }}</span>
      </div>

      <div v-if="tagBuffer.length" class="flex flex-wrap gap-1.5" :aria-label="$t('articles.tags.selected')">
        <span
          v-for="tag in tagBuffer"
          :key="tag.id"
          class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-default bg-elevated/60 py-1 pl-2.5 pr-1 text-sm text-highlighted"
        >
          <span class="max-w-64 truncate" :title="tag.name">{{ tag.name }}</span>
          <UButton
            color="neutral"
            variant="ghost"
            class="tag-destructive-control"
            icon="mdi:close"
            size="xs"
            square
            :aria-label="$t('articles.tags.removeNamed', { name: tag.name })"
            :title="$t('articles.tags.removeNamed', { name: tag.name })"
            @click="remove(tag.id)"
          />
        </span>
      </div>
      <p v-else class="text-xs leading-5 text-muted">{{ $t('articles.tags.selectedEmpty') }}</p>
    </div>

    <UFormField :label="$t('articles.tags.addExisting')" :ui="{ label: 'sr-only' }">
      <USelectMenu
        v-model="selectedTagId"
        :items="availableTags"
        valueKey="id"
        labelKey="name"
        icon="mdi:tag-plus-outline"
        :placeholder="$t('articles.tags.addExisting')"
        class="w-full"
        @update:modelValue="addExisting"
      />
    </UFormField>

    <UCollapsible v-model:open="createOpen">
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        icon="mdi:plus"
        :trailingIcon="createOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :label="$t('articles.tags.createNew')"
      />
      <template #content>
        <UFormField :label="$t('articles.tags.newTagName')" class="mt-2" :ui="{ label: 'sr-only' }">
          <div class="flex gap-2">
            <UInput
              v-model="newTagName"
              :placeholder="$t('articles.tags.newTagName')"
              class="min-w-0 flex-1"
              @keyup.enter="createNew"
            />
            <UButton
              color="primary"
              variant="soft"
              icon="mdi:plus"
              :loading="creating"
              :disabled="!newTagName.trim()"
              :aria-label="$t('articles.tags.createNew')"
              @click="createNew"
            />
          </div>
        </UFormField>
      </template>
    </UCollapsible>
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

const { t } = useI18n()
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
const createOpen = shallowRef(false)
const creating = shallowRef(false)
const tagBuffer = shallowReactive<{ id: string; name: string }[]>([])

watch(
  articleTags,
  (newVal) => {
    if (!props.article?.id) return
    const rows = newVal ?? []
    tagBuffer.length = 0
    rows.forEach((tag) => tagBuffer.push({ id: tag.tagId, name: tag.tag.name }))
  },
  { immediate: true },
)

watch(
  [() => props.initialTags, tagOptions],
  ([newIds]) => {
    if (!props.article?.id && newIds?.length) {
      const tagsToAdd = tagOptions.value.filter((tag) => newIds.includes(tag.id))
      tagsToAdd.forEach((tag) => {
        if (!tagBuffer.some((buffered) => buffered.id === tag.id)) tagBuffer.push({ id: tag.id, name: tag.name })
      })
    }
  },
  { deep: true, immediate: true },
)

const availableTags = computed(() => tagOptions.value.filter((tag) => !tagBuffer.some((item) => item.id === tag.id)))

const addExisting = () => {
  if (!selectedTagId.value) return
  const tag = tagOptions.value.find((item) => item.id === selectedTagId.value)
  if (tag && !tagBuffer.some((item) => item.id === tag.id)) {
    tagBuffer.push({ id: tag.id, name: tag.name })
    emit('add:tag', tag.id)
  }
  selectedTagId.value = ''
}

const createNew = async () => {
  const name = newTagName.value.trim()
  if (!name || creating.value) return

  const existing = tagOptions.value.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (existing) {
    if (!tagBuffer.some((tag) => tag.id === existing.id)) {
      tagBuffer.push({ id: existing.id, name: existing.name })
      emit('add:tag', existing.id)
    }
    newTagName.value = ''
    createOpen.value = false
    return
  }

  creating.value = true
  try {
    const { id, name: createdName } = await $fetch('/api/tags', {
      method: 'POST',
      body: { name, slug: slugify(name, { lower: true, strict: true, trim: true }) },
    })
    tagBuffer.push({ id, name: createdName })
    emit('create:tag', id)
    newTagName.value = ''
    createOpen.value = false
    await invalidateTags()
  } catch (error: any) {
    toast.add({ color: 'error', title: t('articles.tags.createFailed') + (error.data?.message ?? '') })
  } finally {
    creating.value = false
  }
}

const remove = (id: string) => {
  const index = tagBuffer.findIndex((tag) => tag.id === id)
  if (index === -1) return
  tagBuffer.splice(index, 1)
  emit('delete:tag', id)
}
</script>
