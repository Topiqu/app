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
            class="p-4 rounded-xl text-base bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
            @input="updateSlug"
          />
          <span class="text-sm text-gray-500">URL Titulek: {{ newArticle.slug }}</span>
        </label>

        <div
          v-if="auth?.user.plan !== 'basic'"
          class="flex gap-2 rounded-xl bg-gray-50 p-1 border border-gray-200 w-fit"
        >
          <button
            v-for="option in options"
            :key="option.value"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              mode === option.value ? 'bg-white shadow-sm border border-gray-300' : 'text-gray-600',
            ]"
            @click="mode = option.value"
          >
            <Icon :name="option.icon" class="w-4 h-4" />
            {{ option.label }}
          </button>
        </div>

        <div v-if="mode === 'ai'" class="flex flex-col gap-4 p-4 rounded-2xl border border-gray-200 bg-gray-50/60">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-medium text-gray-700">Vlastní AI Prompt</span>
            <div class="relative">
              <Icon name="mdi:chat-processing" class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                v-model="customPrompt"
                placeholder="Zadejte pokyn pro AI generování článku..."
                class="pl-10 p-3 rounded-xl text-sm bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm w-full resize-y min-h-[100px]"
              ></textarea>
            </div>
          </label>
          <button
            class="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-101"
            @click="generateAIContent"
          >
            <Icon name="mdi:lightning-bolt" class="w-5 h-5" />
            Generovat AI obsah
          </button>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-medium uppercase tracking-wide opacity-80">Obsah</span>
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
          :disabled="!newArticle.title"
          class="px-6 py-3 rounded-xl text-base font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
const customPrompt = ref('')
const mode = ref<'manual' | 'ai'>('manual')

const options: { value: 'manual' | 'ai'; label: string; icon: string }[] = [
  { value: 'manual', label: 'Ruční psaní', icon: 'mdi:pencil' },
  { value: 'ai', label: 'AI generování', icon: 'mdi:robot' },
]

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
      articleTags.value.map((tagId) => $fetch(`/api/articles/${id}/tags`, { method: 'POST', body: { tagId } })),
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
      body: { prompt: customPrompt.value || 'Vygeneruj krátký článek na téma CP77...' },
    })
    if (!data) throw createError({ statusCode: 500, message: 'No content generated' })
    newArticle.value.content = data
    toast.success({ message: 'AI obsah úspěšně vygenerován' })
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se vygenerovat obsah' })
  }
}
</script>
