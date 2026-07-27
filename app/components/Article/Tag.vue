<template>
  <Modal v-model="open" :title="$t('articles.tags.title')">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-wrap gap-2 mt-4">
        <div
          v-for="tag in articleTags"
          :key="tag.tagId"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
        >
          {{ tag.tag.name }}
          <Button
            icon="mdi:close"
            size="sm"
            variant="danger"
            :disabled="isBusy"
            class="!rounded-full"
            @click="removeTag(tag.tagId)"
          />
        </div>
      </div>
      <div class="flex flex-col gap-4 mt-6">
        <div class="flex gap-2">
          <input
            v-model="newTag.name"
            :placeholder="$t('articles.tags.addCustomTagPlaceholder')"
            class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            @input="updateSlug"
          />
          <Button :disabled="isBusy || !newTag.name.trim()" @click="addCustomTag">{{
            $t('articles.tags.addButton')
          }}</Button>
        </div>
        <div class="flex gap-2">
          <select
            v-model="selectedTagId"
            class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{{ $t('articles.tags.selectExistingTag') }}</option>
            <option v-for="tag in availableTags" :key="tag.id" :value="tag.id">
              {{ tag.name }}
            </option>
          </select>
          <Button :disabled="isBusy || !selectedTagId" @click="addExistingTag">{{
            $t('articles.tags.addButton')
          }}</Button>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <Button size="lg" @click="close">{{ $t('common.close') }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import slugify from 'slugify'

const toast = useToast()
const open = defineModel<boolean>()
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

const onTagError = (e: any) => toast.error({ message: e.data?.message || $t('articles.tags.operationFailed') })

const { mutate: addTag, isLoading: isAdding } = useMutation({
  mutation: async (tagId: string) => {
    await $fetch(`/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`, {
      method: 'POST',
      body: { tagId },
    })
  },
  onSuccess: () => toast.success({ message: $t('articles.tags.addTagSuccess') }),
  onError: onTagError,
  onSettled: invalidateTags,
})

const { mutate: removeTag, isLoading: isRemoving } = useMutation({
  mutation: async (tagId: string) => {
    await $fetch(`/api/articles/${props.articleId}/tags/${tagId}`, { method: 'DELETE' })
  },
  onSuccess: () => toast.success({ message: $t('articles.tags.removeTagSuccess') }),
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
    toast.success({ message: $t('articles.tags.addTagSuccess') })
  },
  onError: (e: any) => toast.error({ message: e.data?.message || $t('articles.tags.addCustomTagFailed') }),
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
