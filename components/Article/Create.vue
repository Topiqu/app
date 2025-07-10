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
          class="w-full max-w-lg bg-white p-6 rounded-3xl shadow-2xl border backdrop-blur-sm flex flex-col max-h-[80vh]"
        >
          <div class="flex-1 overflow-y-auto pr-4">
            <DialogTitle class="text-xl font-bold text-gray-900 mb-6">
              Přidat článek
            </DialogTitle>

            <div class="flex flex-col gap-6">
              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                >
                  Název článku
                </span>
                <input
                  v-model="newArticle.title"
                  placeholder="Název článku"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                  @input="updateSlug"
                />
                <span class="text-sm text-gray-500"
                  >URL Titulek: {{ newArticle.slug }}</span
                >
              </label>

              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                >
                  Obsah (volitelné)
                </span>
                <TiptapEditor v-model="newArticle.content" edit />
              </label>

              <label class="flex flex-col gap-3">
                <span
                  class="text-sm font-medium uppercase tracking-wide opacity-80"
                >
                  Titulní Obrázek
                </span>
                <FileUploader @upload="handleUpload" />
                <span v-if="newArticle.imageUrl" class="text-sm text-gray-500">
                  Obrázek: {{ newArticle.imageUrl }}
                </span>
              </label>
              <TagsManager v-model:tags="articleTags" />
              <div
                v-if="articles.length"
                class="flex flex-col gap-2 max-h-48 overflow-y-auto"
              >
                <div v-for="a in articles" :key="a.id" class="text-gray-600">
                  {{ a.title }}
                  {{ a.status === 'published' ? '(Publikováno)' : '' }}
                </div>
              </div>
              <p v-else class="text-gray-600">Žádné články.</p>
            </div>
          </div>
          <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
            <button
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
              @click="$emit('close')"
            >
              Zavřít
            </button>
            <button
              :disabled="!newArticle.title"
              class="px-6 py-3 rounded-xl text-base font-medium hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              @click="createArticle"
            >
              Přidat článek
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
import type { ArticleStatus } from '@zenstackhq/runtime/models'
import slugify from 'slugify'

const toast = useToast()
const { data } = useAuth()
defineEmits(['close'])

const { data: articles, refresh } = await useFetch('/api/articles', {
  default: () => [],
})

const newArticle = ref({
  title: '',
  content: '',
  slug: '',
  userId: data.value?.user.id,
  imageUrl: '',
  status: 'draft' as ArticleStatus,
})

const articleTags = ref<string[]>([])

const updateSlug = () => {
  newArticle.value.slug = slugify(newArticle.value.title, {
    lower: true,
    strict: true,
    trim: true,
  })
}

const handleUpload = (file: { url: string }) => {
  newArticle.value.imageUrl = file.url
}

const createArticle = async () => {
  if (!newArticle.value.title) return
  try {
    const { id } = await $fetch('/api/articles', {
      method: 'POST',
      body: {
        title: newArticle.value.title,
        content: newArticle.value.content || undefined,
        slug: newArticle.value.slug,
        userId: newArticle.value.userId,
        imageUrl: newArticle.value.imageUrl,
        status: newArticle.value.status,
      },
    })

    for (const tagId of articleTags.value) {
      await $fetch(`/api/articles/${id}/tags`, {
        method: 'POST',
        body: { tagId },
      })
    }

    toast.success({ message: 'Článek byl úspěšně přidán' })

    newArticle.value = {
      title: '',
      content: '',
      slug: '',
      userId: newArticle.value.userId,
      imageUrl: '',
      status: 'draft' as ArticleStatus,
    }
    articleTags.value = []

    refresh()
  } catch (error: any) {
    toast.error({
      message: error.data?.message || 'Nepodařilo se přidat článek',
    })
  }
}
</script>
