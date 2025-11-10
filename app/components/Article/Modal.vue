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
            @input="updateSlug"
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
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.content')
          }}</span>
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
        </label>

        <LazyArticleDrafts v-model:open="draftsOpen" :drafts :loading @select="loadDraft" @close="draftsOpen = false" />
        <label class="flex flex-col gap-3">
          <span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">{{
            $t('common.labels.image')
          }}</span>
          <FileUploader type="article-image" :maxWidth="3840" :maxHeight="2160" @upload="handleUpload" />
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
          v-if="article"
          :article="editedArticle"
          @add:tag="addTagToArticle"
          @delete:tag="deleteTagFromArticle"
          @create:tag="addTagToArticle"
        />
        <TagsManager v-else @add:tag="(id) => articleTags.push(id)" @create:tag="(id) => articleTags.push(id)" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-2">
        <Button variant="danger" size="lg" @click="close">{{ $t('common.close') }}</Button>
        <Button :disabled="!editedArticle.title" size="lg" @click="onSubmit">{{ $t('articles.addArticle') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleDraft } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import Swal from 'sweetalert2'
import equal from 'fast-deep-equal'

import Modal from '~/components/Modal/index.vue'

const toast = useToast()
const { t } = useI18n()
const { data: auth } = useAuth()
const open = defineModel<boolean>()
const { idle } = useIdle(5 * 60 * 1000)
const { emitArticleCreated, emitArticleUpdated } = useArticleEvent()
const { data: client } = await useFetch(`/api/clients/${auth.value?.user.clientSiteId}` as `/api/clients/:id`)

const emit = defineEmits(['saved'])
const props = defineProps<{ article?: ArticleWithDetails }>()

const init = () =>
  ({
    title: '',
    excerpt: '',
    content: '',
    slug: '',
    imageUrl: '',
    status: 'draft',
    releaseAt: null,
    sources: [],
  }) as unknown as ArticleWithDetails

const editedArticle = ref(
  props.article
    ? {
        ...props.article,
        sources: props.article.sources || [],
        releaseAt: props.article.releaseAt ? new Date(props.article.releaseAt) : null,
      }
    : init(),
)

const articleTags = ref<string[]>([])
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
  if (!editedArticle.value.releaseAt) return true
  const releaseDate = new Date(editedArticle.value.releaseAt)
  return releaseDate >= new Date(minDate) && releaseDate <= new Date(maxDate)
})

const {
  data: drafts,
  refresh,
  pending: loading,
} = await useLazyFetch<ArticleDraft[]>('/api/articles/draft', { default: () => [], server: false })

const saveDraft = useDebounceFn(async () => {
  if (idle.value) return
  if (
    !editedArticle.value.title &&
    !editedArticle.value.excerpt &&
    (!editedArticle.value.content || editedArticle.value.content === '<p></p>')
  )
    return
  if (
    drafts.value?.some((draft) =>
      equal(
        { title: draft.title, excerpt: draft.excerpt || '', content: draft.content },
        {
          title: editedArticle.value.title,
          excerpt: editedArticle.value.excerpt || '',
          content: editedArticle.value.content,
        },
      ),
    )
  )
    return

  try {
    await $fetch('/api/articles/draft', { method: 'POST', body: { ...editedArticle.value } })
    successMessage.value = t('common.messages.draftSaved')
    await refresh()
    setTimeout(() => (successMessage.value = ''), 8000)
  } catch {
    toast.error({ message: t('common.messages.draftSaveFailed') })
  }
}, 8000)

watch(
  [
    () => editedArticle.value.title,
    () => editedArticle.value.excerpt,
    () => editedArticle.value.content,
    () => editedArticle.value.imageUrl,
  ],
  saveDraft,
)
watch(
  [() => editedArticle.value.title],
  () => (editedArticle.value.slug = slugify(editedArticle.value.title, { lower: true, strict: true, trim: true })),
)

const loadDraft = (draft: ArticleDraft) =>
  Object.assign(editedArticle.value, {
    title: draft.title,
    excerpt: draft.excerpt || '',
    content: draft.content,
    imageUrl: draft.imageUrl || '',
    slug: slugify(draft.title ?? '', { lower: true, strict: true, trim: true }),
    sources: [],
  })

const handleUpload = (file: { url: string }) => (editedArticle.value.imageUrl = file.url)

const onSubmit = async () => {
  if (props.article) {
    await saveEdit()
  } else {
    await createArticle()
  }
}

const createArticle = async () => {
  if (!editedArticle.value.title)
    return toast.error({ message: t('common.messages.requiredField', [t('common.labels.title')]) })
  if (!isReleaseDateValid.value)
    return toast.error({ message: t('common.messages.invalidDateRange', [minDate, maxDate]) })

  try {
    const { id } = await $fetch('/api/articles', {
      method: 'POST',
      body: {
        ...editedArticle.value,
        excerpt: editedArticle.value.excerpt || undefined,
        content: editedArticle.value.content || undefined,
        releaseAt: editedArticle.value.releaseAt || undefined,
        sources: editedArticle.value.sources?.filter((s) => s.trim() !== ''),
      },
    })

    await Promise.all(
      articleTags.value.map((tagId) => $fetch(`/api/articles/${id}/tags`, { method: 'POST', body: { tagId } })),
    )
    toast.success({ message: t('articles.editor.createSuccess') })
    Object.assign(editedArticle.value, init())
    articleTags.value = []
    emitArticleCreated()
    open.value = false
  } catch (error: any) {
    toast.error({ message: t('articles.editor.createFailed') + error.data?.message })
  }
}

const addTagToArticle = (tagId: string) => {
  $fetch(`/api/articles/${editedArticle.value.id}/tags`, { method: 'POST', body: { tagId } })
  toast.success({ message: t('articles.tags.addTagSuccess') })
  emitArticleUpdated()
}

const deleteTagFromArticle = (tagId: string) => {
  $fetch(`/api/articles/${editedArticle.value.id}/tags/${tagId}`, { method: 'DELETE' })
  toast.success({ message: t('articles.tags.removeTagSuccess') })
  emitArticleUpdated()
}

const saveEdit = async () => {
  if (editedArticle.value.releaseAt) {
    const releaseDate = new Date(editedArticle.value.releaseAt)
    const minDateObj = new Date(minDate)
    const maxDateObj = new Date(maxDate)
    if (releaseDate < minDateObj || releaseDate > maxDateObj) {
      return toast.error({ message: t('common.messages.invalidDateRange', [minDate, maxDate]) })
    }
  }

  try {
    await $fetch(`/api/articles/${editedArticle.value.id}`, {
      method: 'PATCH',
      body: {
        title: editedArticle.value.title,
        excerpt: editedArticle.value.excerpt || '',
        content: editedArticle.value.content,
        slug: editedArticle.value.slug,
        userId: editedArticle.value.userId || editedArticle.value.user?.id,
        imageUrl: editedArticle.value.imageUrl,
        releaseAt: editedArticle.value.releaseAt || undefined,
      },
    })
    emitArticleUpdated()
    toast.success({ message: t('common.messages.saveSuccess') })
    open.value = false
    emit('saved')
  } catch (error: any) {
    toast.error({ message: error.data?.message || t('common.messages.saveFailed') })
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
  const r = await Swal.fire({
    title: t('common.messages.closeConfirmTitle'),
    text: t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('common.messages.closeConfirmButton'),
    cancelButtonText: t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}

const generateAIContent = async () => {
  aiGenerating.value = true
  try {
    const { title, perex, content, articleImageUrl, tags, sources } = await $fetch('/api/articles/generate', {
      method: 'POST',
      body: { prompt: customPrompt.value || 'Empty...' },
    })
    editedArticle.value.title = title
    editedArticle.value.excerpt = perex
    editedArticle.value.content = content
    editedArticle.value.imageUrl = articleImageUrl
    editedArticle.value.sources = sources || []
    articleTags.value = tags
    toast.success({ message: t('articles.editor.aiContentGenerated') })
  } catch (error: any) {
    toast.error({ message: t('articles.editor.aiContentFailed') + error.data?.message })
  } finally {
    aiGenerating.value = false
  }
}
const showReleaseAt = computed(() => {
  if (editedArticle.value.status === 'published') return false
  if (editedArticle.value.releaseAt) {
    const releaseDate = new Date(editedArticle.value.releaseAt)
    return releaseDate >= currentDate
  }
  return true
})
const updateSlug = () =>
  (editedArticle.value.slug = slugify(editedArticle.value.title, {
    lower: true,
    strict: true,
    trim: true,
  }))
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
