<template>
  <Dialog as="div" class="relative z-[1000]" @close="confirmClose">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div class="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-90"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-100"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-90"
      >
        <DialogPanel
          class="w-full max-w-lg bg-white p-6 rounded-3xl shadow-2xl border backdrop-blur-sm flex flex-col max-h-[80vh]"
        >
          <div class="flex-1 overflow-y-auto pr-4">
            <DialogTitle class="text-xl font-bold mb-6"> Přidat článek </DialogTitle>

            <div class="flex flex-col gap-6">
              <label class="flex flex-col gap-3">
                <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Název článku </span>
                <input
                  v-model="newArticle.title"
                  placeholder="Název článku"
                  class="p-4 rounded-2xl text-base focus:outline-none border-b-2 focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
                  @input="updateSlug"
                />
                <span class="text-sm text-gray-500">URL Titulek: {{ newArticle.slug }}</span>
              </label>

              <label class="flex flex-col gap-3">
                <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Obsah (volitelné) </span>
                <TiptapEditor v-model="newArticle.content" edit />
              </label>

              <label class="flex flex-col gap-3">
                <span class="text-sm font-medium uppercase tracking-wide opacity-80"> Titulní Obrázek </span>
                <FileUploader @upload="handleUpload" />
                <span v-if="newArticle.imageUrl" class="text-sm text-gray-500">
                  Obrázek: {{ newArticle.imageUrl }}
                </span>
              </label>
              <TagsManager v-model:tags="articleTags" />
              <div v-if="articles.length" class="flex flex-col gap-2 max-h-48 overflow-y-auto">
                <p v-for="a in articles" :key="a.id">
                  {{ a.title }}
                  {{ a.status === 'published' ? '(Publikováno)' : '' }}
                </p>
              </div>
              <p v-else class="text-gray-600">Žádné články.</p>
              <!-- <button
                class="px-6 py-3 rounded-xl text-base font-medium bg-gray-200 hover:bg-gray-300 transition-all duration-300 transform hover:scale-105 shadow-sm"
                @click="generateAIContent"
              >
                Generovat AI obsah
              </button> -->
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
import type { ArticleStatus } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import Swal from 'sweetalert2'
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

const toast = useToast()

const { data } = useAuth()

const emit = defineEmits(['close'])

const { data: articles, refresh } = await useFetch('/api/articles', { default: () => [] })

const newArticle = ref({
  title: '',
  content: '',
  slug: '',
  userId: data.value?.user.id,
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

    refresh()

    emit('close')
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se přidat článek' })
  }
}

const confirmClose = async () => {
  if (!newArticle.value.title.length && (!newArticle.value.content.length || newArticle.value.content === '<p></p>'))
    return emit('close')

  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Přidávání článku bude zrušeno. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })

  if (r.isConfirmed) return emit('close')
}

// const generateAIContent = async () => {
//   try {
//     const { data } = await useFetch('/api/articles/ai-gen', {
//       method: 'POST',
//       body: { prompt: 'Vygeneruj krátký článek na téma CP77...' },
//     })

//     newArticle.value.content = data.value

//     toast.success({ message: 'AI obsah úspěšně vygenerován' })

//     console.log('AI Content:', data.value)
//   } catch (error: any) {
//     toast.error({ message: error.data?.message || 'Nepodařilo se vygenerovat obsah' })

//     console.error('Error:', error)
//   }
// }
</script>
