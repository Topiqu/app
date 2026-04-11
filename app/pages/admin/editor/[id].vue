<template>
  <div class="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 pt-20 pb-12 transition-all duration-300">
    <header class="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-800 mb-8">
      <div class="flex items-center gap-4">
        <Button icon="mdi:arrow-left" variant="neutral" @click="goBack" />
        <h1 class="text-xl font-bold">{{ isNew ? $t('articles.addArticle') : $t('articles.updateArticle') }}</h1>
      </div>
      <div class="flex items-center gap-3">
        <Button variant="neutral" icon="mdi:cog" @click="sidebarOpen = true" />
        <Button
          :disabled="!editedArticle.title"
          class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
          @click="onSubmit"
        >
          {{ isNew ? $t('articles.addArticle') : $t('articles.updateArticle') }}
        </Button>
      </div>
    </header>

    <main class="flex-1 w-full">
      <div class="flex flex-col gap-6">
        <FormField
          v-model="editedArticle.title"
          :placeholder="$t('common.labels.articleTitle')"
          inputClass="text-4xl font-black !bg-transparent !border-none !outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 w-full !px-0 !focus:ring-0"
          @input="updateSlug"
        />
        <FormField
          v-model="editedArticle.excerpt"
          type="textarea"
          :placeholder="$t('common.labels.articleExcerpt')"
          inputClass="text-xl !bg-transparent !border-none !outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 w-full resize-none !min-h-[80px] !px-0 !focus:ring-0"
        />

        <div class="mt-4 prose dark:prose-invert max-w-none">
          <TiptapEditor v-model="editedArticle.content" edit class="min-h-[500px]" />

          <div v-if="!article && drafts?.length" class="flex items-center gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              icon="mdi:file-document-outline"
              class="px-4 py-2 rounded-lg font-medium shadow-sm transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:shadow-md dark:from-indigo-500 dark:to-purple-600 dark:hover:from-indigo-600 dark:hover:to-purple-700"
              @click="draftsOpen = true"
            >
              {{ $t('articles.editor.drafts.loadDrafts') }}
            </Button>
            <span v-if="successMessage" class="text-sm text-green-600 dark:text-green-400 flex items-center">
              <Icon name="mdi:check-circle" class="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />{{
                successMessage
              }}
            </span>
          </div>
        </div>
      </div>
    </main>

    <LazyArticleDrafts
      v-model:open="draftsOpen"
      :drafts="drafts"
      :loading="loading"
      @select="loadDraft"
      @close="draftsOpen = false"
    />

    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm transition-opacity"
      @click="sidebarOpen = false"
    ></div>

    <div
      class="w-full max-w-md sm:w-96 lg:w-[450px] border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto transition-transform duration-300 flex flex-col fixed right-0 top-0 h-full shadow-2xl z-[1010]"
      :class="sidebarOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="p-6 flex flex-col gap-8">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ $t('common.settings') }}</h2>
          <Button icon="mdi:close" variant="neutral" @click="sidebarOpen = false" />
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.image')
          }}</label>
          <FileUploader type="article-image" :maxWidth="3840" :maxHeight="2160" @upload="handleUpload" />
          <span v-if="editedArticle.imageUrl" class="text-xs text-gray-500 break-all">{{
            editedArticle.imageUrl
          }}</span>
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.aiGeneration')
          }}</label>
          <div
            class="flex flex-col gap-3 p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30"
          >
            <FormField
              v-model="customPrompt"
              type="textarea"
              :placeholder="$t('articles.editor.ai.customPromptPlaceholder')"
              inputClass="!min-h-[100px] !bg-white dark:!bg-gray-800"
            />
            <Button
              icon="mdi:lightning-bolt"
              class="w-full text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md"
              :disabled="aiGenerating"
              @click="generateAIContent"
            >
              {{ $t('articles.editor.ai.generateButton') }}
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.series')
          }}</label>
          <ArticleSeriesSelector v-model="selectedSeries" />
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.tags')
          }}</label>
          <TagsManager
            :article="article"
            :initialTags="articleTags"
            @add:tag="addTag"
            @create:tag="addTag"
            @delete:tag="removeTag"
          />
        </div>

        <div class="flex flex-col gap-3">
          <FormField v-model="editedArticle.releaseAt" type="datetime-local" :label="$t('common.labels.releaseDate')" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'
import Swal from 'sweetalert2'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { emitArticleCreated, emitArticleUpdated } = useArticleEvent()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)

const article = shallowRef<ArticleWithDetails | undefined>(undefined)

const init = (): ArticleWithDetails =>
  ({
    title: '',
    excerpt: '',
    content: '',
    slug: '',
    imageUrl: '',
    status: 'draft',
    releaseAt: null,
    sources: [],
    savedAmount: 0,
    savedTimeMinutes: 0,
    aiInvolvement: 'NONE',
  }) as unknown as ArticleWithDetails

const editedArticle = ref(init())
const selectedSeries = shallowRef<any>(null)
const articleTags = shallowRef<string[]>([])
const optimizedImageUrl = shallowRef('')
const customPrompt = shallowRef('')
const aiGenerating = shallowRef(false)

const { idle } = useIdle(5 * 60 * 1000)
const { drafts, loading, draftsOpen, successMessage, loadDraft } = await useArticleDrafts(editedArticle, idle, {
  onDraftLoaded: () => {
    selectedSeries.value = null
    articleTags.value = []
  },
})

if (!isNew) {
  try {
    const data = await $fetch(`/api/articles/${route.params.id}`)
    article.value = data as any
    editedArticle.value = {
      ...article.value,
      releaseAt: article.value?.releaseAt ? new Date(article.value?.releaseAt).toISOString().slice(0, 16) : null,
    } as any
    const articleData = article.value as any
    selectedSeries.value = articleData?.articleSeries
    articleTags.value = articleData?.tags?.map((t: any) => t.tag?.id || t.id) || []
  } catch (e: any) {
    console.error(e)
    toast.error({ message: 'Failed to load article' })
    router.push('/admin')
  }
}

const updateSlug = () => {
  if (isNew) {
    editedArticle.value.slug = slugify(editedArticle.value.title, { lower: true, strict: true, trim: true })
  }
}

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  editedArticle.value.imageUrl = file.url
  optimizedImageUrl.value = file.optimizedUrl
}

const addTag = (id: string) => {
  if (!articleTags.value.includes(id)) articleTags.value.push(id)
}
const removeTag = (id: string) => {
  articleTags.value = articleTags.value.filter((t) => t !== id)
}

const generateAIContent = async () => {
  aiGenerating.value = true
  try {
    const response = await $fetch('/api/articles/generate', {
      method: 'POST',
      body: { prompt: customPrompt.value || 'Empty...' },
    })
    Object.assign(editedArticle.value, {
      title: response.title,
      excerpt: response.perex,
      content: response.content,
      imageUrl: response.articleImageUrl,
    })
    toast.success({ message: 'AI Content Generated' })
  } catch {
    toast.error({ message: 'AI Generation Failed' })
  } finally {
    aiGenerating.value = false
  }
}

const onSubmit = async () => {
  if (!editedArticle.value.title) return toast.error({ message: 'Title is required' })

  const payload = {
    ...editedArticle.value,
    imageUrl: optimizedImageUrl.value || editedArticle.value.imageUrl,
    articleSeriesId: selectedSeries.value?.id || null,
    tags: articleTags.value,
    releaseAt: editedArticle.value.releaseAt ? new Date(editedArticle.value.releaseAt) : null,
  }

  try {
    if (isNew) {
      await $fetch('/api/articles', { method: 'POST', body: payload })
      toast.success({ message: 'Article created' })
      emitArticleCreated()
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.success({ message: 'Article updated' })
      emitArticleUpdated()
    }
    router.push('/admin')
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Error saving article' })
  }
}

const goBack = async () => {
  const hasChanges = isNew
    ? editedArticle.value.title.length > 0 ||
      (editedArticle.value.content !== '' && editedArticle.value.content !== '<p></p>')
    : editedArticle.value.title !== article.value?.title || editedArticle.value.content !== article.value?.content

  if (hasChanges) {
    const r = await Swal.fire({
      title: 'Discard changes?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
    })
    if (!r.isConfirmed) return
  }
  router.push('/admin')
}

watch(
  () => editedArticle.value.title,
  (newTitle) => {
    if (isNew) editedArticle.value.slug = slugify(newTitle, { lower: true, strict: true, trim: true })
  },
)
</script>
