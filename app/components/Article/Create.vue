<template>
  <Modal v-model="open" title="Přidat článek" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Název článku</span>
          <input
            v-model="newArticle.title"
            placeholder="Název článku"
            class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
            @input="updateSlug"
          />
          <span class="text-sm text-gray-500">URL Titulek: {{ newArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Obsah (volitelné)</span>
          <TiptapEditor v-model="newArticle.content" edit />
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Titulní Obrázek</span>
          <FileUploader @upload="handleUpload" />
          <span v-if="newArticle.imageUrl" class="text-sm text-gray-500">Obrázek: {{ newArticle.imageUrl }}</span>
        </label>
        <TagsManager v-model:tags="articleTags" />
        <div v-if="articles.length" class="flex flex-col gap-2 max-h-48 overflow-y-auto">
          <p v-for="a in articles" :key="a.id">
            {{ a.title }}
            {{ a.status === 'published' ? '(Publikováno)' : '' }}
          </p>
        </div>
        <p v-else class="text-gray-600">Žádné články.</p>
        <button
          class="px-6 py-3 rounded-xl text-base font-medium bg-gray-200 hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 shadow-sm"
          @click="generateAIContent"
        >
          Generovat AI obsah
        </button>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0">
        <button
          class="px-6 py-3 rounded-xl text-base font-medium hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
          @click="close"
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
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { ArticleStatus } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import Swal from 'sweetalert2'

const toast = useToast()

const { data: auth } = useAuth()

const { emitArticleCreated } = useArticleEvent()

const open = defineModel<boolean>()

const { data: articles } = await useFetch('/api/articles', { default: () => [] })

const newArticle = ref({
  title: '',
  content: '',
  slug: '',
  userId: auth.value?.user.id,
  imageUrl: '',
  status: 'draft' as ArticleStatus,
})

const articleTags = ref<string[]>([])

const updateSlug = () =>
  (newArticle.value.slug = slugify(newArticle.value.title, {
    lower: true,
    strict: true,
    trim: true,
  }))

const handleUpload = (file: { url: string }) => (newArticle.value.imageUrl = file.url)

const createArticle = async () => {
  if (!newArticle.value.title) return toast.error({ message: 'Název článku je povinný' })

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

    await Promise.all(
      articleTags.value.map((tagId) => {
        $fetch(`/api/articles/${id}/tags`, { method: 'POST', body: { tagId } })
      }),
    )

    toast.success({ message: 'Článek byl úspěšně přidán' })
    emitArticleCreated()
    open.value = false
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se přidat článek' })
  }
}

const confirmClose = async () => {
  if (!newArticle.value.title.length && (!newArticle.value.content.length || newArticle.value.content === '<p></p>'))
    return (open.value = false)

  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Přidávání článku bude zrušeno. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })

  if (r.isConfirmed) return (open.value = false)
}

const generateAIContent = async () => {
  try {
    const data = await $fetch('/api/articles/ai-gen', {
      method: 'POST',
      body: { prompt: 'Vygeneruj krátký článek na téma CP77...' },
    })
    if (!data) throw createError({ statusCode: 500, message: 'No content generated' })

    newArticle.value.content = data

    toast.success({ message: 'AI obsah úspěšně vygenerován' })
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se vygenerovat obsah' })
  }
}
</script>
