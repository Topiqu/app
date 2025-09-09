<template>
  <Modal v-model="open" title="Tagy článku">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-wrap gap-2 mt-4">
        <div
          v-for="t in articleTags"
          :key="t.tagId"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
        >
          {{ t.tag.name }}
          <Button icon="mdi:close" size="sm" variant="danger" class="!rounded-full" @click="removeTag(t.tagId)" />
        </div>
      </div>
      <div class="flex flex-col gap-4 mt-6">
        <div class="flex gap-2">
          <input
            v-model="newTag.name"
            placeholder="Přidat vlastní tag"
            class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            @input="updateSlug"
          />
          <Button @click="addCustomTag">Přidat</Button>
        </div>
        <div class="flex gap-2">
          <select
            v-model="selectedTagId"
            class="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Vyber existující tag</option>
            <option v-for="t in availableTags" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
          <Button @click="addExistingTag">Přidat</Button>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <Button size="lg" @click="close">Zavřít</Button>
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

    toast.success({ message: method === 'POST' ? 'Tag přidán' : 'Tag odebrán' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Operace selhala' })
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
    toast.error({ message: e.data?.message || 'Přidání tagu selhalo' })
  }
}

const addExistingTag = async () => {
  if (!selectedTagId.value) return

  await apiCall(`/api/articles/${props.articleId}/tags`, 'POST', { tagId: selectedTagId.value })

  selectedTagId.value = ''
}

const removeTag = async (id: string) => await apiCall(`/api/articles/${props.articleId}/tags/${id}`, 'DELETE')
</script>
