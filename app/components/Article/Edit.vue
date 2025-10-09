<template>
  <Modal v-model="open" :title="$t('articles.editor.title')" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">{{ $t('common.labels.articleTitle') }}</span>
          <input
            v-model="editedArticle.title"
            :placeholder="$t('common.labels.articleTitle')"
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
            @input="updateSlug"
          />
          <span class="text-sm text-gray-500">URL: {{ editedArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">{{ $t('common.labels.excerpt') }}</span>
          <textarea
            v-model="editedArticle.excerpt"
            :placeholder="$t('common.labels.articleExcerpt')"
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          ></textarea>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">{{ $t('common.labels.content') }}</span>
          <TiptapEditor v-model="editedArticle.content" edit />
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">{{ $t('common.labels.image') }}</span>
          <FileUploader :imageUrl="editedArticle.imageUrl" type="article-image" @upload="handleUpload" />
          <span v-if="editedArticle.imageUrl" class="text-sm text-gray-500">
            {{ $t('common.labels.image') + ': ' + editedArticle.imageUrl }}
          </span>
        </label>

        <label v-if="showReleaseAt" class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">{{ $t('common.labels.releaseDate') }}</span>
          <input
            v-model="editedArticle.releaseAt"
            type="datetime-local"
            :min="minDate"
            :max="maxDate"
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500">
            {{ $t('articles.editor.releaseDateNote') }}
          </span>
        </label>

        <TagsManager :article="editedArticle" @update:tags="updateTags" @delete:tag="deleteTag" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <Button variant="danger" @click="close">{{ $t('common.close') }}</Button>
        <Button :disabled="!editedArticle.title" @click="saveEdit">{{ $t('common.actions.saveChanges') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { Article } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import Swal from 'sweetalert2'

const toast = useToast()
const open = defineModel<boolean>()
const emit = defineEmits(['saved'])
const props = defineProps<{ article: Article }>()

const editedArticle = ref({
  ...props.article,
  excerpt: props.article.excerpt || '',
  releaseAt: props.article.releaseAt ? new Date(props.article.releaseAt) : null,
})
const { data: artTags } = useFetch(`/api/articles/${props.article?.id}/tags`, {
  default: () => [],
  key: `article-tags-${props.article?.id}`,
})

const currentDate = new Date()
const minDate = currentDate.toISOString().slice(0, 16)
const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59).toISOString().slice(0, 16)

const showReleaseAt = computed(() => {
  if (editedArticle.value.status === 'published') return false
  if (editedArticle.value.releaseAt) {
    const releaseDate = new Date(editedArticle.value.releaseAt)
    return releaseDate >= currentDate
  }
  return true
})

const updateSlug = () =>
  (editedArticle.value.slug = slugify(editedArticle.value.title, {
    lower: true,
    strict: true,
    trim: true,
  }))

const handleUpload = (file: { url: string }) => (editedArticle.value.imageUrl = file.url)

const updateTags = async (tagIds: string[]) => {
  const currentTags = (artTags.value || []).map((t) => t.tagId)
  const tagsToAdd = tagIds.filter((id) => !currentTags.includes(id))

  await Promise.all(
    tagsToAdd.map((tagId) =>
      $fetch(`/api/articles/${editedArticle.value.id}/tags`, {
        method: 'POST',
        body: { tagId },
      }).catch((e) => console.error('POST error:', e)),
    ),
  )

  toast.success({ message: $t('articles.tags.addTagSuccess') })
}

const deleteTag = async (tagId: string) => {
  try {
    await $fetch(`/api/articles/${editedArticle.value.id}/tags/${tagId}`, { method: 'DELETE' })
    toast.success({ message: $t('articles.tags.removeTagSuccess') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.tags.operationFailed') })
  }
}

const saveEdit = async () => {
  if (editedArticle.value.releaseAt) {
    const releaseDate = new Date(editedArticle.value.releaseAt)
    const minDateObj = new Date(minDate)
    const maxDateObj = new Date(maxDate)
    if (releaseDate < minDateObj || releaseDate > maxDateObj) {
      return toast.error({ message: $t('common.messages.invalidDateRange', [minDate, maxDate]) })
    }
  }
  try {
    await $fetch(`/api/articles/${editedArticle.value.id}`, {
      method: 'PATCH',
      body: {
        title: editedArticle.value.title,
        excerpt: editedArticle.value.excerpt || '',
        content: editedArticle.value.content,
        slug: editedArticle.value.slug,
        userId: editedArticle.value.userId,
        imageUrl: editedArticle.value.imageUrl,
        releaseAt: editedArticle.value.releaseAt || undefined,
      },
    })
    toast.success({ message: $t('common.messages.saveSuccess') })
    open.value = false
    emit('saved')
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.messages.saveFailed') })
  }
}

const confirmClose = async () => {
  const r = await Swal.fire({
    title: $t('common.messages.closeConfirmTitle'),
    text: $t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.messages.closeConfirmButton'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}
</script>
