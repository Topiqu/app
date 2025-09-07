<template>
  <Modal v-model="open" title="Přidat článek" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">Název článku</span>
          <input
            v-model="newArticle.title"
            placeholder="Název článku"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
            @input="updateSlug"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">URL Titulek: {{ newArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">Perex</span>
          <textarea
            v-model="newArticle.excerpt"
            placeholder="Zadejte krátký popis článku..."
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          ></textarea>
        </label>

        <div
          class="flex gap-2 rounded-2xl bg-gray-100 dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 w-fit"
        >
          <Button
            v-for="option in options"
            :key="option.value"
            :class="[
              mode === option.value
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                : '!text-black bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            ]"
            :icon="option.icon"
            @click="mode = option.value"
          >
            {{ option.label }}
          </Button>
        </div>

        <div
          v-if="mode === 'ai'"
          class="flex flex-col gap-4 p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50"
        >
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Vlastní AI Prompt</span>
            <div class="relative">
              <Icon name="mdi:chat-processing" class="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <textarea
                v-model="customPrompt"
                placeholder="Zadejte pokyn pro AI generování článku..."
                class="pl-10 p-3 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm w-full resize-y min-h-[100px]"
              />
            </div>
          </label>
          <div v-if="aiGenerating" class="flex justify-center">
            <NuxtImg src="/topik_premysli_rm.png" alt="Topík přemýšlí" class="w-16 animate-pulse" />
          </div>
          <div
            v-else-if="auth?.user.plan === 'BASIC' || client?.tokenRemaining === 0"
            class="relative p-4 rounded-xl bg-white dark:bg-gray-800 border-t-4 border-gradient-to-r from-blue-500 to-indigo-600 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div class="flex items-center gap-3 pl-10">
              <Icon name="mdi:lightning-bolt" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-200">AI generování není dostupné.</p>
                <NuxtLink
                  to="/"
                  class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline hover:underline-offset-4 transition-all duration-200 inline-flex items-center gap-1"
                >
                  Zjistit více
                  <Icon name="mdi:arrow-right" class="w-4 h-4" />
                </NuxtLink>
              </div>
            </div>
          </div>
          <div v-else class="flex justify-center">
            <NuxtImg src="/topik_normal_rm.png" alt="Topík normální" class="w-16" />
            <Button
              icon="mdi:lightning-bolt"
              class="text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              @click="generateAIContent"
            >
              Generovat AI obsah
            </Button>
          </div>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">Obsah</span>
          <TiptapEditor v-model="newArticle.content" edit />
          <div v-if="drafts?.length" class="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon="mdi:file-document-outline"
              class="px-4 py-2 rounded-lg font-medium shadow-sm transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-md dark:from-indigo-500 dark:to-purple-600 dark:hover:from-indigo-600 dark:hover:to-purple-700"
              @click="showDraftsDialog"
            >
              Načíst návrhy
            </Button>
            <span v-if="successMessage" class="text-sm text-green-600 dark:text-green-400">
              {{ successMessage }}
            </span>
          </div>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">Titulní Obrázek</span>
          <FileUploader @upload="handleUpload" />
          <span v-if="newArticle.imageUrl" class="text-sm text-gray-500 dark:text-gray-400"
            >Obrázek: {{ newArticle.imageUrl }}</span
          >
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">Datum vydání</span>
          <input
            v-model="newArticle.releaseAt"
            type="datetime-local"
            :min="minDate"
            :max="maxDate"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400"
            >Slouží pro nastavení data a času publikace článku. Můžete nechat prázdné pro manuální vydání.</span
          >
        </label>

        <TagsManager v-model:tags="articleTags" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-2">
        <Button variant="danger" size="lg" @click="close">Zavřít</Button>
        <Button :disabled="!newArticle.title" size="lg" @click="createArticle">Přidat článek</Button>
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
const { data: client } = useFetch(`/api/clients/${auth.value?.user.clientSiteId}`)
const { emitArticleCreated } = useArticleEvent()
const open = defineModel<boolean>()
const { idle } = useIdle(5 * 60 * 1000)

const init = () => ({
  title: '',
  excerpt: '',
  content: '',
  slug: '',
  userId: auth.value?.user.id,
  imageUrl: '',
  status: 'draft' as ArticleStatus,
  releaseAt: null as string | null,
})

const newArticle = reactive(init())
const articleTags = ref<string[]>([])
const customPrompt = shallowRef('')
const mode = shallowRef<'manual' | 'ai'>('manual')
const aiGenerating = shallowRef(false)
const successMessage = shallowRef('')

const options = [
  { value: 'manual', label: 'Ruční psaní', icon: 'mdi:pencil' },
  { value: 'ai', label: 'AI generování', icon: 'mdi:robot' },
] as const

const currentDate = new Date()
const minDate = currentDate.toISOString().slice(0, 16)
const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59).toISOString().slice(0, 16)

const isReleaseDateValid = computed(() => {
  if (!newArticle.releaseAt) return true
  const releaseDate = new Date(newArticle.releaseAt)
  return releaseDate >= new Date(minDate) && releaseDate <= new Date(maxDate)
})

const { data: drafts, error } = useAsyncData(
  'drafts',
  async () => {
    if (!auth.value?.user.id) return []
    return (await $fetch('/api/articles/draft')).drafts
  },
  { default: () => [] },
)

const showDraftsDialog = async () => {
  if (!drafts.value?.length) {
    toast.info({ message: 'Žádné návrhy nebyly nalezeny' })
    return
  }
  const result = await Swal.fire({
    title: 'Našli jsme neuložené návrhy',
    text: `Chcete pokračovat v úpravách návrhu z ${new Date(drafts.value[0].updatedAt).toLocaleString()}?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Pokračovat',
    cancelButtonText: 'Zrušit',
    showDenyButton: drafts.value.length > 1,
    denyButtonText: 'Vybrat jiný návrh',
  })
  if (result.isConfirmed) {
    Object.assign(newArticle, {
      title: drafts.value[0].title,
      excerpt: drafts.value[0].excerpt || '',
      content: drafts.value[0].content,
      slug: slugify(drafts.value[0].title, { lower: true, strict: true, trim: true }),
    })
  } else if (result.isDenied) {
    const { value: selectedDraft } = await Swal.fire({
      title: 'Vyberte návrh',
      input: 'select',
      inputOptions: drafts.value.reduce(
        (acc, draft) => ({
          ...acc,
          [draft.id]: `${draft.title || 'Bez názvu'} (${new Date(draft.updatedAt).toLocaleString()})`,
        }),
        {},
      ),
      inputPlaceholder: 'Vyberte návrh',
      showCancelButton: true,
    })
    if (selectedDraft) {
      const draft = drafts.value.find((d) => d.id === selectedDraft)
      Object.assign(newArticle, {
        title: draft.title,
        excerpt: draft.excerpt || '',
        content: draft.content,
        slug: slugify(draft.title, { lower: true, strict: true, trim: true }),
      })
    }
  }
}

watch(error, (err) => {
  if (err) toast.error({ message: 'Načítání návrhů selhalo' })
})

const updateSlug = () => {
  newArticle.slug = slugify(newArticle.title, { lower: true, strict: true, trim: true })
}

const handleUpload = (file: { url: string }) => {
  newArticle.imageUrl = file.url
}

const saveDraft = useDebounceFn(async () => {
  if (idle.value) return
  if (!newArticle.title && !newArticle.content && !newArticle.excerpt) return
  if (
    drafts.value?.some(
      (draft) =>
        draft.title === newArticle.title &&
        (draft.excerpt || '') === (newArticle.excerpt || '') &&
        draft.content === newArticle.content,
    )
  )
    return
  try {
    await $fetch('/api/articles/draft', {
      method: 'POST',
      body: {
        title: newArticle.title,
        excerpt: newArticle.excerpt || undefined,
        content: newArticle.content || undefined,
        userId: auth.value?.user.id,
        clientSiteId: auth.value?.user.clientSiteId,
      },
    })
    successMessage.value = 'Návrh uložen'
    setTimeout(() => (successMessage.value = ''), 8000)
  } catch {
    toast.error({ message: 'Uložení návrhu selhalo' })
  }
}, 8000)

watch([() => newArticle.title, () => newArticle.excerpt, () => newArticle.content], () => {
  saveDraft()
})

const createArticle = async () => {
  if (!newArticle.title) return toast.error({ message: 'Název článku je povinný' })
  if (!isReleaseDateValid.value) return toast.error({ message: `Datum vydání musí být mezi ${minDate} a ${maxDate}` })
  try {
    const { id } = await $fetch('/api/articles', {
      method: 'POST',
      body: {
        ...newArticle,
        excerpt: newArticle.excerpt || undefined,
        content: newArticle.content || undefined,
        releaseAt: newArticle.releaseAt || undefined,
      },
    })
    await Promise.all(
      articleTags.value.map((tagId) => $fetch(`/api/articles/${id}/tags`, { method: 'POST', body: { tagId } })),
    )
    toast.success({ message: 'Článek byl úspěšně přidán' })
    Object.assign(newArticle, init())
    emitArticleCreated()
    open.value = false
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se přidat článek' })
  }
}

const confirmClose = async () => {
  if (!newArticle.title.length && (!newArticle.content.length || newArticle.content === '<p></p>')) {
    open.value = false
    return
  }
  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Přidávání článku bude zrušeno. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}

const generateAIContent = async () => {
  aiGenerating.value = true
  try {
    const { perex, content } = await $fetch('/api/articles/ai-gen', {
      method: 'POST',
      body: { prompt: customPrompt.value || 'Prázdný...' },
    })
    newArticle.excerpt = perex
    newArticle.content = content
    toast.success({ message: 'AI obsah úspěšně vygenerován' })
  } catch (error: any) {
    toast.error({ message: error.data?.message || 'Nepodařilo se vygenerovat obsah' })
  } finally {
    aiGenerating.value = false
  }
}
</script>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}
</style>
