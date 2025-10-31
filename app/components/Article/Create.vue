<template>
  <Modal v-model="open" :title="$t('articles.addArticle')" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.title') }}
          </span>
          <input
            v-model="newArticle.title"
            :placeholder="$t('common.labels.articleTitle')"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">URL: {{ newArticle.slug }}</span>
        </label>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.excerpt') }}
          </span>
          <textarea
            v-model="newArticle.excerpt"
            :placeholder="$t('common.labels.articleExcerpt')"
            class="p-4 rounded-xl dark:text-gray-200 text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md resize-y min-h-[100px]"
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
                : 'light:text-black bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
            ]"
            :icon="option.icon"
            @click="mode = option.value"
          >
            {{ $t(`articles.editor.modes.${option.value}`) }}
          </Button>
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
          <div v-else class="flex justify-center">
            <NuxtImg src="/topik_normal_rm.png" :alt="$t('articles.noResults.imageAlt')" class="w-16" />
            <Button
              icon="mdi:lightning-bolt"
              class="text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              @click="generateAIContent"
            >
              {{ $t('articles.editor.ai.generateButton') }}
            </Button>
          </div>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.content') }}
          </span>
          <TiptapEditor v-model="newArticle.content" edit />
          <div v-if="drafts?.length" class="flex items-center gap-2">
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
        </label>

        <LazyArticleDrafts v-model:open="draftsOpen" :drafts :loading @select="loadDraft" @close="draftsOpen = false" />
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.image') }}
          </span>
          <FileUploader
            type="article-image"
            :maxWidth="3840"
            :maxHeight="2160"
            :imageUrl="newArticle.imageUrl"
            @upload="handleUpload"
          />
          <span v-if="newArticle.imageUrl" class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('common.labels.image') }}: {{ newArticle.imageUrl }}
          </span>
        </label>

        <ArticleSources v-model="newArticle.sources" />

        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            {{ $t('common.labels.releaseDate') }}
          </span>
          <input
            v-model="newArticle.releaseAt"
            type="datetime-local"
            :min="minDate"
            :max="maxDate"
            class="p-4 rounded-xl text-base bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ $t('articles.editor.releaseDateNote') }}</span>
        </label>

        <TagsManager v-model:tags="articleTags" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-2">
        <Button variant="danger" size="lg" @click="close">{{ $t('common.close') }}</Button>
        <Button :disabled="!newArticle.title" size="lg" @click="createArticle">{{ $t('articles.addArticle') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { ArticleStatus, ArticleDraft } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import Swal from 'sweetalert2'
import equal from 'fast-deep-equal'

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
  imageUrl: '',
  status: 'draft' as ArticleStatus,
  releaseAt: null as string | null,
  sources: [] as string[],
})

const newArticle = reactive(init())
const articleTags = shallowRef<string[]>([])
const customPrompt = shallowRef('')
const mode = shallowRef<'manual' | 'ai'>('manual')
const aiGenerating = shallowRef(false)
const successMessage = shallowRef('')
const draftsOpen = shallowRef(false)

const options = [
  { value: 'manual', label: 'manual', icon: 'mdi:pencil' },
  { value: 'ai', label: 'ai', icon: 'mdi:robot' },
] as const

const currentDate = new Date()
const minDate = currentDate.toISOString().slice(0, 16)
const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59).toISOString().slice(0, 16)

const isReleaseDateValid = computed(() => {
  if (!newArticle.releaseAt) return true
  const releaseDate = new Date(newArticle.releaseAt)
  return releaseDate >= new Date(minDate) && releaseDate <= new Date(maxDate)
})

const {
  data: drafts,
  refresh,
  pending: loading,
} = await useLazyFetch<ArticleDraft[]>('/api/articles/draft', { default: () => [], server: false })

const saveDraft = useDebounceFn(async () => {
  if (idle.value) return
  if (!newArticle.title && !newArticle.excerpt && (!newArticle.content || newArticle.content === '<p></p>')) return
  if (
    drafts.value?.some((draft) =>
      equal(
        { title: draft.title, excerpt: draft.excerpt || '', content: draft.content, imageUrl: draft.imageUrl },
        {
          title: newArticle.title,
          excerpt: newArticle.excerpt || '',
          content: newArticle.content,
          imageUrl: newArticle.imageUrl,
        },
      ),
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
        imageUrl: newArticle.imageUrl || undefined,
      },
    })
    successMessage.value = $t('common.messages.draftSaved')
    await refresh()
    setTimeout(() => (successMessage.value = ''), 8000)
  } catch {
    toast.error({ message: $t('common.messages.draftSaveFailed') })
  }
}, 8000)

watch(
  [() => newArticle.title, () => newArticle.excerpt, () => newArticle.content, () => newArticle.imageUrl],
  saveDraft,
)
watch(
  () => newArticle.title,
  () => (newArticle.slug = slugify(newArticle.title, { lower: true, strict: true, trim: true })),
)

const loadDraft = (draft: ArticleDraft) => {
  Object.assign(newArticle, {
    title: draft.title,
    excerpt: draft.excerpt || '',
    content: draft.content,
    imageUrl: draft.imageUrl || '',
    slug: slugify(draft.title ?? '', { lower: true, strict: true, trim: true }),
    sources: [],
  })
}

const handleUpload = (file: { url: string }) => (newArticle.imageUrl = file.url)

const createArticle = async () => {
  if (!newArticle.title)
    return toast.error({ message: $t('common.messages.requiredField', [$t('common.labels.title')]) })
  if (!isReleaseDateValid.value)
    return toast.error({ message: $t('common.messages.invalidDateRange', [minDate, maxDate]) })
  try {
    const { id } = await $fetch('/api/articles', {
      method: 'POST',
      body: {
        ...newArticle,
        excerpt: newArticle.excerpt || undefined,
        content: newArticle.content || undefined,
        releaseAt: newArticle.releaseAt || undefined,
        sources: newArticle.sources.filter((s) => s.trim() !== ''),
      },
    })
    await Promise.all(
      articleTags.value.map((tagId) => $fetch(`/api/articles/${id}/tags`, { method: 'POST', body: { tagId } })),
    )
    toast.success({ message: $t('articles.editor.createSuccess') })
    Object.assign(newArticle, init())
    emitArticleCreated()
    open.value = false
  } catch (error: any) {
    toast.error({ message: $t('articles.editor.createFailed') + error.data?.message })
  }
}

const confirmClose = async () => {
  if (
    !newArticle.title.length &&
    (!newArticle.content.length || newArticle.content === '<p></p>') &&
    !newArticle.sources.length
  )
    return (open.value = false)
  const r = await Swal.fire({
    title: $t('common.messages.closeConfirmTitle'),
    text: $t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.messages.closeConfirmButton'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}

const generateAIContent = async () => {
  aiGenerating.value = true
  try {
    const { title, perex, content, articleImageUrl, tags, sources } = await $fetch('/api/articles/ai-gen', {
      method: 'POST',
      body: { prompt: customPrompt.value || 'Empty...' },
    })
    newArticle.title = title
    newArticle.excerpt = perex
    newArticle.content = content
    newArticle.imageUrl = articleImageUrl
    newArticle.sources = sources || []
    articleTags.value = tags
    toast.success({ message: $t('articles.editor.aiContentGenerated') })
  } catch (error: any) {
    toast.error({ message: $t('articles.editor.aiContentFailed') + error.data?.message })
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
