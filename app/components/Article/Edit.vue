<template>
  <Modal v-model="open" title="Úprava článku" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">Název článku</span>
          <input
            v-model="editedArticle.title"
            placeholder="Název článku"
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
            @input="updateSlug"
          />
          <span class="text-sm text-gray-500">URL Titulek: {{ editedArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">Perex</span>
          <textarea
            v-model="editedArticle.excerpt"
            placeholder="Zadejte krátký popis článku..."
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          ></textarea>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">Obsah</span>
          <TiptapEditor v-model="editedArticle.content" edit />
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">Titulní Obrázek</span>
          <FileUploader :imageUrl="editedArticle.imageUrl" @upload="handleUpload" />
          <span v-if="editedArticle.imageUrl" class="text-sm text-gray-500">
            Obrázek: {{ editedArticle.imageUrl }}
          </span>
        </label>

        <label v-if="showReleaseAt" class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide">Datum vydání</span>
          <input
            v-model="editedArticle.releaseAt"
            type="datetime-local"
            :min="minDate"
            :max="maxDate"
            class="p-4 rounded-xl text-base bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500">
            Slouží pro nastavení data a času publikace článku. Můžete nechat prázdné pro manuální vydání.
          </span>
        </label>

        <TagsManager :article="editedArticle" @update:tags="updateTags" @delete:tag="deleteTag" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium bg-gray-100 hover:bg-gray-200 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
        >
          Zavřít
        </button>
        <button
          :disabled="!editedArticle.title"
          class="px-6 py-3 rounded-xl text-base font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          @click="saveEdit"
        >
          Uložit změny
        </button>
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
  releaseAt: props.article.releaseAt ? new Date(props.article.releaseAt).toISOString().slice(0, 16) : null,
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

  toast.success({ message: 'Tag přidán.' })
}

const deleteTag = async (tagId: string) => {
  try {
    await $fetch(`/api/articles/${editedArticle.value.id}/tags/${tagId}`, { method: 'DELETE' })
    toast.success({ message: 'Tag odebrán.' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Chyba při odebírání tagu.' })
  }
}

const saveEdit = async () => {
  if (editedArticle.value.releaseAt) {
    const releaseDate = new Date(editedArticle.value.releaseAt)
    const minDateObj = new Date(minDate)
    const maxDateObj = new Date(maxDate)
    if (releaseDate < minDateObj || releaseDate > maxDateObj) {
      return toast.error({ message: 'Datum vydání musí být od teď do ' + (currentDate.getFullYear() + 100) })
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
    toast.success({ message: 'Článek byl úspěšně upraven' })
    open.value = false
    emit('saved')
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Úprava článku selhala' })
  }
}

const confirmClose = async () => {
  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Úprava článku bude zrušena. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}
</script>
