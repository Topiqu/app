<template>
  <UModal v-model:open="open" :title="$t('articles.tags.title')" :ui="{ content: 'max-w-xl' }">
    <slot :open="openDialog" />

    <template #body>
      <div class="flex flex-wrap gap-2">
        <UFieldGroup v-for="tag in displayArticleTags" :key="tag.tagId">
          <UBadge color="primary" variant="soft" size="lg">{{ tag.tag.name }}</UBadge>
          <UButton
            icon="mdi:close"
            size="sm"
            color="neutral"
            variant="ghost"
            class="tag-destructive-control"
            :loading="removingTagIds.has(tag.tagId)"
            :disabled="isBusy"
            square
            :aria-label="$t('common.remove')"
            :title="$t('common.remove')"
            @click="removeTag(tag.tagId)"
          />
        </UFieldGroup>
      </div>
      <div class="flex flex-col gap-4">
        <UFormField :label="$t('articles.tags.addCustomTagPlaceholder')">
          <UFieldGroup class="w-full">
            <UInput
              v-model="newTag.name"
              :placeholder="$t('articles.tags.addCustomTagPlaceholder')"
              class="min-w-48 flex-1"
              @input="updateSlug"
            />
            <UButton :loading="isCreating" :disabled="isBusy || !newTag.name.trim()" @click="addCustomTag">
              {{ $t('articles.tags.addButton') }}
            </UButton>
          </UFieldGroup>
        </UFormField>
        <UFormField :label="$t('articles.tags.selectExistingTag')">
          <UFieldGroup class="w-full">
            <USelectMenu
              v-model="selectedTagId"
              :items="displayAvailableTags"
              valueKey="id"
              labelKey="name"
              :placeholder="$t('articles.tags.selectExistingTag')"
              class="flex-1"
            />
            <UButton :loading="isAdding" :disabled="isBusy || !selectedTagId" @click="addExistingTag">
              {{ $t('articles.tags.addButton') }}
            </UButton>
          </UFieldGroup>
        </UFormField>
      </div>
    </template>

    <template #footer="{ close }">
      <UButton size="lg" @click="close">{{ $t('common.close') }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import slugify from 'slugify'

const toast = useToast()
const open = defineModel<boolean>({ default: false })
const openDialog = () => (open.value = true)
const props = defineProps<{ articleId: string }>()

const { invalidateArticleDetail, invalidateTags: invalidateTagLibrary } = useCacheInvalidation()
const requestFetch = useRequestFetch()

const newTag = shallowReactive<{ name: string; slug: string }>({ name: '', slug: '' })
const selectedTagId = shallowRef<string>('')
const optimisticArticleTags = ref<ArticleTagRow[]>([])
const removingTagIds = ref(new Set<string>())
const isAdding = shallowRef(false)
const isCreating = shallowRef(false)
const optimisticStatus = useOptimisticStatus()

type ArticleTagRow = { tagId: string; tag: { id: string; name: string } }
type AvailableTag = { id: string; name: string }

const { data: articleTags } = useQuery({
  key: () => queryKeys.articles.tags(props.articleId),
  query: () => requestFetch<ArticleTagRow[]>(`/api/articles/${props.articleId}/tags`),
  placeholderData: () => [],
})

const { data: availableTags } = useQuery({
  key: () => queryKeys.articles.availableTags(props.articleId),
  query: () => requestFetch<AvailableTag[]>(`/api/articles/${props.articleId}/available-tags`),
  placeholderData: () => [],
})

const displayArticleTags = computed(() => [
  ...(articleTags.value ?? []).filter((row) => !removingTagIds.value.has(row.tagId)),
  ...optimisticArticleTags.value,
])
const displayAvailableTags = computed(() => {
  const assigned = new Set(displayArticleTags.value.map((row) => row.tagId))
  const removed = (articleTags.value ?? []).filter((row) => removingTagIds.value.has(row.tagId)).map((row) => row.tag)
  return [...(availableTags.value ?? []).filter((tag) => !assigned.has(tag.id)), ...removed]
})

const invalidateTags = () => invalidateArticleDetail(props.articleId)

const updateSlug = () => (newTag.slug = slugify(newTag.name, { lower: true, strict: true, trim: true }))

const addTag = async (tagId: string) => {
  const tag = displayAvailableTags.value.find((item) => item.id === tagId)
  if (!tag || isBusy.value) return
  const optimistic = { tagId, tag }
  isAdding.value = true
  optimisticArticleTags.value.push(optimistic)
  optimisticStatus.saving()
  try {
    await $fetch(`/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`, {
      method: 'POST',
      body: { tagId },
    })
    await invalidateTags()
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('articles.tags.addTagSuccess') })
  } catch (e: any) {
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: e.data?.message || $t('articles.tags.operationFailed') })
  } finally {
    optimisticArticleTags.value = optimisticArticleTags.value.filter((row) => row !== optimistic)
    isAdding.value = false
  }
}

const removeTag = async (tagId: string) => {
  if (isBusy.value || removingTagIds.value.has(tagId)) return
  removingTagIds.value = new Set([...removingTagIds.value, tagId])
  optimisticStatus.saving()
  try {
    await $fetch(`/api/articles/${props.articleId}/tags/${tagId}`, { method: 'DELETE' })
    await invalidateTags()
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('articles.tags.removeTagSuccess') })
  } catch (e: any) {
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: e.data?.message || $t('articles.tags.operationFailed') })
  } finally {
    const removing = new Set(removingTagIds.value)
    removing.delete(tagId)
    removingTagIds.value = removing
  }
}

const createAndAddTag = async () => {
  const draft = { name: newTag.name.trim(), slug: newTag.slug }
  const optimisticId = `optimistic-${crypto.randomUUID?.() ?? Date.now()}`
  const optimistic = { tagId: optimisticId, tag: { id: optimisticId, name: draft.name } }
  isCreating.value = true
  optimisticArticleTags.value.push(optimistic)
  newTag.name = ''
  newTag.slug = ''
  optimisticStatus.saving()
  try {
    const tag = await $fetch<{ id: string }>('/api/tags', {
      method: 'POST',
      body: draft,
    })
    await $fetch(`/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`, {
      method: 'POST',
      body: { tagId: tag.id },
    })
    await Promise.all([invalidateTags(), invalidateTagLibrary()])
    optimisticStatus.saved()
    toast.add({ color: 'success', title: $t('articles.tags.addTagSuccess') })
  } catch (e: any) {
    newTag.name = draft.name
    newTag.slug = draft.slug
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: e.data?.message || $t('articles.tags.addCustomTagFailed') })
  } finally {
    optimisticArticleTags.value = optimisticArticleTags.value.filter((row) => row !== optimistic)
    isCreating.value = false
  }
}

const isBusy = computed(() => isAdding.value || removingTagIds.value.size > 0 || isCreating.value)

const addCustomTag = () => {
  if (!newTag.name.trim() || isBusy.value) return
  updateSlug()
  void createAndAddTag()
}

const addExistingTag = () => {
  if (!selectedTagId.value || isBusy.value) return
  void addTag(selectedTagId.value)
  selectedTagId.value = ''
}
</script>
