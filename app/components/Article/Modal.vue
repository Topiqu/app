<template>
  <Modal v-model="open" :title="$t('articles.addArticle')" class="max-w-2xl" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.articleTitle')
          }}</span>
          <input
            v-model="editedArticle.title"
            :placeholder="$t('common.labels.articleTitle')"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">URL: {{ editedArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.excerpt') }}
          </span>
          <textarea
            v-model="editedArticle.excerpt"
            :placeholder="$t('common.labels.articleExcerpt')"
            class="p-4 rounded-xl dark:text-gray-200 text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md resize-y min-h-[100px]"
          ></textarea>
        </label>

        <ArticleSeriesSelector v-model="selectedSeries" />

        <div
          v-if="!article"
          class="flex gap-2 rounded-2xl bg-gray-100 dark:bg-gray-700 p-2 border border-gray-300 dark:border-gray-600 w-fit"
        >
          <Button
            v-for="option in options"
            :key="option.value"
            :class="[
              mode === option.value
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                : 'light:text-black bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            ]"
            :icon="option.icon"
            :disabled="option.value === 'import' && client?.plan === 'BASIC'"
            @click="option.value === 'import' ? jsonInput?.click() : (mode = option.value)"
          >
            {{ $t(`articles.editor.modes.${option.value}`) }}
          </Button>
          <input ref="jsonInput" type="file" accept=".json" class="hidden" @change="handleJsonImport" />
        </div>

        <div
          v-if="mode === 'ai'"
          class="flex flex-col gap-4 p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50"
        >
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {{ $t('articles.editor.ai.customPromptPlaceholder') }}
            </span>
            <div class="relative">
              <Icon name="mdi:chat-processing" class="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <textarea
                v-model="customPrompt"
                :placeholder="$t('articles.editor.ai.customPromptPlaceholder')"
                class="pl-10 p-3 rounded-xl text-sm dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all duration-200 shadow-sm w-full resize-y min-h-[100px]"
              />
            </div>
          </label>
          <div v-if="aiGenerating" class="flex justify-center">
            <NuxtImg src="/topik_premysli_rm.png" :alt="$t('articles.noResults.imageAlt')" class="w-16 animate-pulse" />
          </div>
          <div
            v-else-if="auth?.user.plan === 'BASIC' || client?.tokenRemaining === 0"
            class="relative p-4 rounded-xl bg-white dark:bg-gray-800 border-t-4 border-gradient-to-r from-blue-500 to-indigo-600 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div class="flex items-center gap-3 pl-10">
              <Icon name="mdi:lightning-bolt" class="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
              <div class="flex flex-col gap-1">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ $t('articles.editor.ai.notAvailable') }}
                </p>
                <NuxtLink
                  to="/"
                  class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline hover:underline-offset-4 transition-all duration-200 inline-flex items-center gap-1"
                >
                  {{ $t('articles.editor.ai.learnMore') }}
                  <Icon name="mdi:arrow-right" class="w-4 h-4" />
                </NuxtLink>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col items-center gap-3">
            <NuxtImg
              src="/topik_normal_rm.png"
              :alt="$t('articles.noResults.imageAlt')"
              class="w-20 select-none drop-shadow-md"
            />
            <Button
              icon="mdi:creation"
              size="lg"
              borderless
              class="group relative w-full overflow-hidden text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-fuchsia-500 hover:from-blue-600 hover:via-indigo-600 hover:to-fuchsia-600 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 dark:shadow-indigo-900/40"
              @click="generateAIContent"
            >
              <span
                class="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
              {{ $t('articles.editor.ai.generateButton') }}
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.content') }}
          </span>
          <TiptapEditor v-model="editedArticle.content" edit />
          <div v-if="!article && drafts?.length" class="flex items-center gap-2">
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

        <LazyArticleDrafts v-model:open="draftsOpen" :drafts :loading @select="loadDraft" @close="draftsOpen = false" />
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.image')
          }}</span>
          <FileUploader
            type="article-image"
            :imageUrl="editedArticle.imageUrl"
            :maxWidth="3840"
            :maxHeight="2160"
            @upload="handleUpload"
          />
          <span v-if="editedArticle.imageUrl" class="text-sm text-gray-500 dark:text-gray-400"
            >{{ $t('common.labels.image') }}: {{ editedArticle.imageUrl }}</span
          >
        </label>

        <ArticleSources v-model="editedArticle.sources" />

        <label v-if="showReleaseAt" class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.releaseDate')
          }}</span>
          <input
            v-model="editedArticle.releaseAt"
            type="datetime-local"
            :min="minDate"
            :max="maxDate"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('articles.editor.releaseDateNote') }}</span>
        </label>
        <TagsManager
          :article="props.article"
          :initialTags="articleTags"
          @add:tag="addTagToArticle"
          @create:tag="addTagToArticle"
          @delete:tag="deleteTagFromArticle"
        />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-2">
        <Button variant="danger" size="lg" @click="close">{{ $t('common.close') }}</Button>
        <Button :disabled="!editedArticle.title" size="lg" @click="onSubmit">{{
          props.article ? $t('articles.updateArticle') : $t('articles.addArticle')
        }}</Button>
      </div>
    </template>
  </Modal>
  <ModalMini ref="discardDialog" />
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

import Modal from '~/components/Modal/index.vue'

const toast = useToast()
const { data: auth } = useAuth()
const open = defineModel<boolean>()
const discardDialog = useTemplateRef<ModalMiniRef>('discardDialog')
const { idle } = useIdle(5 * 60 * 1000)
const { emitArticleCreated, emitArticleUpdated } = useArticleEvent()
const client = await useClientSite()
const emit = defineEmits(['saved'])
const props = defineProps<{ article?: ArticleWithDetails }>()

const selectedSeries = shallowRef<any>(
  props.article?.articleSeries
    ? {
        id: props.article.articleSeries.id,
        name: props.article.articleSeries.name,
        articles: props.article.articleSeries.articles || [],
      }
    : null,
)
const articleTags = ref<string[]>([])

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

const editedArticle = ref(
  props.article
    ? {
        ...props.article,
        sources: props.article.sources || [],
        savedAmount: props.article.savedAmount || 0,
        optimizedImageUrl: '',
        savedTimeMinutes: props.article.savedTimeMinutes || 0,
        aiInvolvement: props.article.aiInvolvement || 'NONE',
        releaseAt: props.article.releaseAt ? new Date(props.article.releaseAt) : null,
      }
    : init(),
)

const { drafts, loading, draftsOpen, successMessage, loadDraft } = await useArticleDrafts(editedArticle, idle, {
  onDraftLoaded: () => {
    selectedSeries.value = null
    articleTags.value = []
  },
})

const jsonInput = ref<HTMLInputElement>()
const customPrompt = shallowRef('')
const mode = shallowRef<'manual' | 'ai' | 'import'>('manual')
const aiGenerating = shallowRef(false)
const optimizedImageUrl = shallowRef('')
const options = [
  { value: 'manual', icon: 'mdi:pencil' },
  { value: 'ai', icon: 'mdi:robot' },
  { value: 'import', icon: 'mdi:import' },
] as const

const currentDate = new Date()
const minDate = currentDate.toISOString().slice(0, 16)
const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59).toISOString().slice(0, 16)

const handleJsonImport = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)[0]
    Object.assign(editedArticle.value, {
      title: data.title ?? '',
      excerpt: data.excerpt ?? '',
      content: data.content ?? '',
      slug: data.slug ?? slugify(data.title ?? '', { lower: true, strict: true, trim: true }),
      imageUrl: data.imageUrl ?? '',
      sources: Array.isArray(data.sources) ? data.sources : [],
      releaseAt: data.releaseAt ? new Date(data.releaseAt) : null,
      savedAmount: 0,
      savedTimeMinutes: 0,
      aiInvolvement: 'NONE',
    })
    toast.success({ message: $t('common.messages.successGeneral') })
  } catch {
    toast.error({ message: $t('common.error') })
  } finally {
    if (jsonInput.value) jsonInput.value.value = ''
  }
}

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  editedArticle.value.imageUrl = file.url
  optimizedImageUrl.value = file.optimizedUrl
}

const addTagToArticle = async (tagId: string) => {
  if (props.article?.id) {
    await $fetch(`/api/articles/${props.article.id}/tags`, { method: 'POST', body: { tagId } })
    toast.success({ message: $t('articles.tags.addTagSuccess') })
    emitArticleUpdated()
  } else {
    if (!articleTags.value.includes(tagId)) articleTags.value.push(tagId)
  }
}

const deleteTagFromArticle = async (tagId: string) => {
  if (props.article?.id) {
    await $fetch(`/api/articles/${props.article.id}/tags/${tagId}`, { method: 'DELETE' })
    toast.success({ message: $t('articles.tags.removeTagSuccess') })
    emitArticleUpdated()
  } else {
    articleTags.value = articleTags.value.filter((id) => id !== tagId)
  }
}

const createArticle = async () => {
  if (!editedArticle.value.title)
    return toast.error({ message: $t('common.messages.requiredField', [$t('common.labels.title')]) })
  try {
    await $fetch('/api/articles', {
      method: 'POST',
      body: {
        ...editedArticle.value,
        excerpt: editedArticle.value.excerpt || undefined,
        content: editedArticle.value.content || undefined,
        releaseAt: editedArticle.value.releaseAt || undefined,
        imageUrl: optimizedImageUrl.value || editedArticle.value.imageUrl,
        sources: editedArticle.value.sources?.filter((s: string) => s.trim()),
        savedAmount: editedArticle.value.savedAmount,
        savedTimeMinutes: editedArticle.value.savedTimeMinutes,
        aiInvolvement: editedArticle.value.aiInvolvement,
        articleSeriesId: selectedSeries.value?.id || null,
        tags: articleTags.value,
      },
    })
    toast.success({ message: $t('articles.editor.createSuccess') })
    Object.assign(editedArticle.value, init())
    articleTags.value = []
    selectedSeries.value = null
    emitArticleCreated()
    open.value = false
  } catch (error: any) {
    toast.error({ message: $t('articles.editor.createFailed') + error.data?.message })
  }
}

const saveEdit = async () => {
  try {
    await $fetch(`/api/articles/${props.article!.id}`, {
      method: 'PATCH',
      body: {
        title: editedArticle.value.title,
        excerpt: editedArticle.value.excerpt || '',
        content: editedArticle.value.content,
        slug: editedArticle.value.slug,
        imageUrl: optimizedImageUrl.value || editedArticle.value.imageUrl,
        releaseAt: editedArticle.value.releaseAt || undefined,
        savedAmount: editedArticle.value.savedAmount,
        savedTimeMinutes: editedArticle.value.savedTimeMinutes,
        aiInvolvement: editedArticle.value.aiInvolvement,
        articleSeriesId: selectedSeries.value?.id || null,
      },
    })
    emitArticleUpdated()
    toast.success({ message: $t('common.messages.saveSuccess') })
    open.value = false
    emit('saved')
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.messages.saveFailed') })
  }
}

const onSubmit = async () => (props.article ? await saveEdit() : await createArticle())

const playSuccessSound = () => {
  const audio = new Audio('/success.wav')
  audio.volume = 0.5
  audio.play().catch(() => {})
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
      sources: response.sources || [],
      savedAmount: response.metrics.savedAmount,
      savedTimeMinutes: response.metrics.savedTimeMinutes,
      aiInvolvement: response.aiInvolvement || 'FULL',
    })
    articleTags.value = response.tags ?? []
    playSuccessSound()
    toast.success({ message: $t('articles.editor.aiContentGenerated') })
  } catch {
    toast.error({ message: $t('articles.editor.aiContentFailed') })
  } finally {
    aiGenerating.value = false
  }
}

const confirmClose = async () => {
  if (
    !editedArticle.value.title.length &&
    (!editedArticle.value.content?.length || editedArticle.value.content === '<p></p>') &&
    !editedArticle.value.sources?.length
  ) {
    open.value = false
    return
  }
  const r = await discardDialog.value?.ask({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('common.messages.closeConfirmText'),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (r === 'ok') open.value = false
}

const showReleaseAt = computed(
  () => !editedArticle.value.releaseAt || new Date(editedArticle.value.releaseAt) >= currentDate,
)

watch(
  () => editedArticle.value.title,
  () => (editedArticle.value.slug = slugify(editedArticle.value.title, { lower: true, strict: true, trim: true })),
)

watch(
  () => editedArticle.value.content,
  (newContent, oldContent) => {
    if (aiGenerating.value) return
    const isInitialLoad = oldContent === '' || oldContent === '<p></p>'
    if (!isInitialLoad) {
      editedArticle.value.savedAmount = 0
      editedArticle.value.savedTimeMinutes = 0
      editedArticle.value.aiInvolvement =
        editedArticle.value.aiInvolvement === 'FULL' ? 'ASSIST' : editedArticle.value.aiInvolvement
    }
  },
)
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
