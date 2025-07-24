<template>
  <Dialog as="div" class="relative z-[1000]" @close="$emit('close')">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />
    </TransitionChild>
    <div class="fixed inset-0 flex items-center justify-center p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-90"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-100"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-90"
      >
        <DialogPanel
          class="w-full max-w-lg bg-white p-10 rounded-3xl shadow-2xl flex flex-col gap-8 border backdrop-blur-sm max-h-[80vh]"
        >
          <DialogTitle class="text-xl font-bold text-gray-900"
            >Úprava článku</DialogTitle
          >
          <div class="flex-1 overflow-y-auto pr-4">
            <div class="flex flex-col gap-6">
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Název článku</span
                >
                <input
                  v-model="editedArticle.title"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                  @input="updateSlug"
                />
                <span class="text-sm text-gray-500"
                  >URL Titulek: {{ editedArticle.slug }}</span
                >
              </label>
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Obsah</span
                >
                <TiptapEditor v-model="editedArticle.content" edit />
              </label>
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                  >Titulní Obrázek</span
                >
                <FileUploader @upload="handleUpload" />
                <span
                  v-if="editedArticle.imageUrl"
                  class="text-sm text-gray-500"
                >
                  Obrázek: {{ editedArticle.imageUrl }}
                </span>
              </label>
              <TagsManager
                :article="editedArticle"
                @update:tags="updateTags"
                @delete:tag="deleteTag"
              />
            </div>
          </div>
          <div class="flex gap-4 justify-end flex-shrink-0">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
              @click="$emit('close')"
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
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
} from '@headlessui/vue'
import type { Article } from '@zenstackhq/runtime/models'
import slugify from 'slugify'

const toast = useToast()
const emit = defineEmits(['close', 'saved'])
const props = defineProps<{ article: Article }>()

const editedArticle = ref({ ...props.article })
const { data: artTags } = useFetch(`/api/articles/${props.article?.id}/tags`, {
  default: () => [],
  key: `article-tags-${props.article?.id}`,
})

const updateSlug = () => {
  editedArticle.value.slug = slugify(editedArticle.value.title, {
    lower: true,
    strict: true,
    trim: true,
  })
}

const handleUpload = (file: { url: string }) => {
  editedArticle.value.imageUrl = file.url
}

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
    await $fetch(`/api/articles/${editedArticle.value.id}/tags/${tagId}`, {
      method: 'DELETE',
    })
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
    emit('close')
    emit('saved')
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Úprava článku selhala' })
  }
}
</script>
