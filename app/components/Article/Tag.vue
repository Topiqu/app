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
          <Button icon="mdi:close" size="sm" variant="danger" class="!rounded-full" @click="removeTag(tag.tagId)" />
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
          <Button @click="addCustomTag">{{ $t('articles.tags.addButton') }}</Button>
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
          <Button @click="addExistingTag">{{ $t('articles.tags.addButton') }}</Button>
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

const newTag = ref<{ name: string; slug: string }>({ name: '', slug: '' })

const selectedTagId = shallowRef<string>('')

const { data: articleTags, refresh: refreshTags } = useFetch(
  `/api/articles/${props.articleId}/tags` as `/api/articles/:id/tags`,
  { default: () => [] },
)

const { data: availableTags, refresh: refreshAvailableTags } = useFetch(
  `/api/articles/${props.articleId}/available-tags` as `/api/articles/:id/available-tags`,
  { default: () => [] },
)

const updateSlug = () => (newTag.value.slug = slugify(newTag.value.name, { lower: true, strict: true, trim: true }))

const apiCall = async (url: string, method: 'POST' | 'DELETE', body?: any) => {
  try {
    await $fetch(url, { method, body })

    await Promise.all([refreshTags(), refreshAvailableTags()])

    toast.success({
      message: method === 'POST' ? $t('articles.tags.addTagSuccess') : $t('articles.tags.removeTagSuccess'),
    })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.tags.operationFailed') })
  }
}

const addCustomTag = async () => {
  if (!newTag.value.name.trim()) return

  updateSlug()

  try {
    const tag = await $fetch('/api/tags', {
      method: 'POST',
      body: { name: newTag.value.name.trim(), slug: newTag.value.slug },
    })

    await apiCall(`/api/articles/${props.articleId}/tags`, 'POST', { tagId: tag.id })

    newTag.value = { name: '', slug: '' }
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.tags.addCustomTagFailed') })
  }
}

const addExistingTag = async () => {
  if (!selectedTagId.value) return

  await apiCall(`/api/articles/${props.articleId}/tags`, 'POST', { tagId: selectedTagId.value })

  selectedTagId.value = ''
}

const removeTag = async (id: string) => await apiCall(`/api/articles/${props.articleId}/tags/${id}`, 'DELETE')
</script>
