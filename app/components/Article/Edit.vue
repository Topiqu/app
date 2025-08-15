<template>
  <Modal v-model="open" title="Úprava článku" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex-1 overflow-y-auto pr-4">
        <div class="flex flex-col gap-6">
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název článku</span>
            <input
              v-model="editedArticle.title"
              class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
              @input="updateSlug"
            />
            <span class="text-sm text-gray-500">URL Titulek: {{ editedArticle.slug }}</span>
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Obsah</span>
            <TiptapEditor v-model="editedArticle.content" edit />
          </label>
          <label class="flex flex-col gap-3">
            <span class="text-sm font-medium uppercase tracking-wide opacity-80">Titulní Obrázek</span>
            <FileUploader @upload="handleUpload" />
            <span v-if="editedArticle.imageUrl" class="text-sm text-gray-500">
              Obrázek: {{ editedArticle.imageUrl }}
            </span>
          </label>
          <TagsManager :article="editedArticle" @update:tags="updateTags" @delete:tag="deleteTag" />
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
        >
          Zavřít
        </button>
        <button
          :disabled="!editedArticle.title"
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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

const editedArticle = ref({ ...props.article })
const { data: artTags } = useFetch(`/api/articles/${props.article?.id}/tags`, {
  default: () => [],
  key: `article-tags-${props.article?.id}`,
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
  try {
    await $fetch(`/api/articles/${editedArticle.value.id}`, {
      method: 'PATCH',
      body: {
        title: editedArticle.value.title,
        content: editedArticle.value.content,
        slug: editedArticle.value.slug,
        userId: editedArticle.value.userId,
        imageUrl: editedArticle.value.imageUrl,
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
