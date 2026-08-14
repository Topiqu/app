<template>
  <UModal v-model:open="open" :title="$t('articles.tags.title')" :ui="{ content: 'max-w-xl' }">
    <slot :open="open" />

    <template #body>
      <div class="flex flex-wrap gap-2">
        <UFieldGroup v-for="tag in articleTags" :key="tag.tagId">
          <UBadge color="primary" variant="soft" size="lg">{{ tag.tag.name }}</UBadge>
          <UButton
            icon="i-mdi-close"
            size="sm"
            color="neutral"
            variant="ghost"
            class="tag-destructive-control"
            :loading="isRemoving"
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
              :items="availableTags"
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
const props = defineProps<{ articleId: string }>()

const { invalidateArticleDetail, invalidateTags: invalidateTagLibrary } = useCacheInvalidation()
const requestFetch = useRequestFetch()

const newTag = shallowReactive<{ name: string; slug: string }>({ name: '', slug: '' })
const selectedTagId = shallowRef<string>('')

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

const invalidateTags = () => invalidateArticleDetail(props.articleId)

const updateSlug = () => (newTag.slug = slugify(newTag.name, { lower: true, strict: true, trim: true }))

const onTagError = (e: any) =>
  toast.add({ color: 'error', title: e.data?.message || $t('articles.tags.operationFailed') })

const { mutate: addTag, isLoading: isAdding } = useMutation({
  mutation: async (tagId: string) => {
    await $fetch(`/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`, {
      method: 'POST',
      body: { tagId },
    })
  },
  onSuccess: () => toast.add({ color: 'success', title: $t('articles.tags.addTagSuccess') }),
  onError: onTagError,
  onSettled: invalidateTags,
})

const { mutate: removeTag, isLoading: isRemoving } = useMutation({
  mutation: async (tagId: string) => {
    await $fetch(`/api/articles/${props.articleId}/tags/${tagId}`, { method: 'DELETE' })
  },
  onSuccess: () => toast.add({ color: 'success', title: $t('articles.tags.removeTagSuccess') }),
  onError: onTagError,
  onSettled: invalidateTags,
})

const { mutate: createAndAddTag, isLoading: isCreating } = useMutation({
  mutation: async () => {
    const tag = await $fetch('/api/tags', {
      method: 'POST',
      body: { name: newTag.name.trim(), slug: newTag.slug },
    })
    await $fetch(`/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`, {
      method: 'POST',
      body: { tagId: tag.id },
    })
  },
  onSuccess: () => {
    newTag.name = ''
    newTag.slug = ''
    toast.add({ color: 'success', title: $t('articles.tags.addTagSuccess') })
  },
  onError: (e: any) => toast.add({ color: 'error', title: e.data?.message || $t('articles.tags.addCustomTagFailed') }),
  onSettled: () => Promise.all([invalidateTags(), invalidateTagLibrary()]),
})

const isBusy = computed(() => isAdding.value || isRemoving.value || isCreating.value)

const addCustomTag = () => {
  if (!newTag.name.trim() || isBusy.value) return
  updateSlug()
  createAndAddTag()
}

const addExistingTag = () => {
  if (!selectedTagId.value || isBusy.value) return
  addTag(selectedTagId.value)
  selectedTagId.value = ''
}
</script>
