<template>
  <div class="flex-1 flex flex-col w-full max-w-5xl mx-auto px-4 pt-20 pb-12 transition-all duration-300">
    <header
      class="sticky top-0 z-20 -mx-4 px-4 py-3 mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/70 dark:border-gray-800/70 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl"
    >
      <div class="flex items-center gap-3 min-w-0">
        <Button icon="mdi:arrow-left" variant="neutral" :aria="$t('common.actions.back') || 'Back'" @click="goBack" />
        <h1 class="text-lg font-bold truncate">
          {{ isNew ? $t('articles.addArticle') : $t('articles.updateArticle') }}
        </h1>
        <span
          class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          :class="statusPillClass"
        >
          <Icon :name="statusIcon" class="w-3.5 h-3.5" />
          {{ statusLabel }}
        </span>
      </div>

      <div class="flex items-center gap-3 ml-auto">
        <div
          v-if="autosaveVisible"
          class="hidden md:flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
          aria-live="polite"
        >
          <Icon
            :name="saving ? 'mdi:cloud-sync' : 'mdi:cloud-check'"
            class="w-4 h-4"
            :class="{ 'animate-spin': saving }"
          />
          <template v-if="saving">{{ $t('common.messages.savingNow') }}</template>
          <template v-else-if="lastSavedAt">
            {{ $t('common.messages.savedAgo') }}&nbsp;<NuxtTime :datetime="lastSavedAt" relative />
          </template>
          <template v-else>{{ $t('common.messages.unsaved') }}</template>
        </div>

        <Button
          icon="mdi:cog"
          variant="neutral"
          :aria="$t('common.settings')"
          :title="$t('common.settings')"
          @click="sidebarOpen = true"
        />

        <Button
          v-if="isNew || editedArticle.status === 'draft'"
          variant="secondary"
          :disabled="!editedArticle.title"
          @click="submit('draft')"
        >
          {{ isNew ? $t('articles.saveAsDraft') : $t('articles.saveChanges') }}
        </Button>

        <Button
          :disabled="!editedArticle.title"
          class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent! hover:from-blue-600 hover:to-indigo-700"
          @click="submit('published')"
        >
          {{ publishLabel }}
        </Button>
      </div>
    </header>

    <main class="flex-1 w-full">
      <div class="flex flex-col gap-6">
        <FormField
          v-model="editedArticle.title"
          :placeholder="$t('common.labels.articleTitle')"
          inputClass="text-4xl font-black !bg-transparent !border-none !outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 w-full !px-0 !focus:ring-0 border-l-4! border-transparent! focus:border-indigo-500! pl-4!"
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

    <button
      v-if="sidebarOpen"
      type="button"
      class="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm cursor-default"
      :aria-label="$t('common.actions.close') || 'Close'"
      @click="sidebarOpen = false"
    />

    <aside
      role="dialog"
      aria-modal="true"
      :aria-label="$t('common.settings')"
      class="w-full max-w-md sm:w-96 lg:w-[450px] border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto transition-transform duration-300 flex flex-col fixed right-0 top-0 h-full shadow-2xl z-[1010]"
      :class="sidebarOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="sticky top-0 z-10 px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur">
        <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{{ $t('common.settings') }}</h2>
        <Button icon="mdi:close" variant="neutral" :aria="$t('common.actions.close') || 'Close'" @click="sidebarOpen = false" />
      </div>

      <div class="p-6 flex flex-col gap-6">
        <section class="flex flex-col gap-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            <Icon name="mdi:image-outline" class="w-4 h-4 text-indigo-500" />
            {{ $t('common.labels.image') }}
          </h3>
          <FileUploader type="article-image" :maxWidth="3840" :maxHeight="2160" @upload="handleUpload" />
          <NuxtImg
            v-if="editedArticle.imageUrl"
            :src="editedArticle.imageUrl"
            class="w-full h-32 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
            loading="lazy"
          />
        </section>

        <hr class="border-gray-200 dark:border-gray-800" />

        <section class="flex flex-col gap-3">
          <button
            type="button"
            class="flex items-center justify-between w-full text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200"
            :aria-expanded="aiOpen"
            @click="aiOpen = !aiOpen"
          >
            <span class="flex items-center gap-2">
              <Icon name="mdi:sparkles" class="w-4 h-4 text-purple-500" />
              {{ $t('common.labels.aiGeneration') }}
            </span>
            <Icon :name="aiOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="w-5 h-5" />
          </button>
          <div
            v-if="aiOpen"
            class="flex flex-col gap-3 p-4 rounded-2xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20"
          >
            <FormField
              v-model="customPrompt"
              type="textarea"
              :placeholder="$t('articles.editor.ai.customPromptPlaceholder')"
              inputClass="!min-h-[100px] !bg-white dark:!bg-gray-800"
            />
            <Button
              icon="mdi:lightning-bolt"
              :loading="aiGenerating"
              class="w-full text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-md border-transparent!"
              :disabled="aiGenerating"
              @click="generateAIContent"
            >
              {{ $t('articles.editor.ai.generateButton') }}
            </Button>
          </div>
        </section>

        <hr class="border-gray-200 dark:border-gray-800" />

        <section class="flex flex-col gap-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            <Icon name="mdi:bookmark-multiple-outline" class="w-4 h-4 text-teal-500" />
            {{ $t('common.labels.series') }}
          </h3>
          <ArticleSeriesSelector v-model="selectedSeries" />
        </section>

        <hr class="border-gray-200 dark:border-gray-800" />

        <section class="flex flex-col gap-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            <Icon name="mdi:tag-multiple-outline" class="w-4 h-4 text-amber-500" />
            {{ $t('common.labels.tags') }}
          </h3>
          <TagsManager
            :article="article"
            :initialTags="articleTags"
            @add:tag="addTag"
            @create:tag="addTag"
            @delete:tag="removeTag"
          />
        </section>

        <hr class="border-gray-200 dark:border-gray-800" />

        <section class="flex flex-col gap-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
            <Icon name="mdi:calendar-clock" class="w-4 h-4 text-blue-500" />
            {{ $t('common.labels.releaseDate') }}
          </h3>
          <FormField v-model="releaseAtInput" type="datetime-local" />
          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="neutral" @click="setReleaseQuick('now')">
              {{ $t('articles.releaseQuick.now') }}
            </Button>
            <Button size="sm" variant="neutral" @click="setReleaseQuick('inHour')">
              {{ $t('articles.releaseQuick.inHour') }}
            </Button>
            <Button size="sm" variant="neutral" @click="setReleaseQuick('tomorrow')">
              {{ $t('articles.releaseQuick.tomorrow') }}
            </Button>
            <Button v-if="editedArticle.releaseAt" size="sm" variant="neutral" icon="mdi:close" @click="setReleaseQuick('clear')">
              {{ $t('articles.releaseQuick.clear') }}
            </Button>
          </div>
        </section>
      </div>
    </aside>

    <Modal
      v-model="discardConfirmOpen"
      :title="$t('common.messages.discardChangesTitle')"
      :description="$t('common.messages.discardChangesText')"
    >
      <template #footer="{ close }">
        <div class="flex gap-3">
          <Button variant="neutral" @click="close">{{ $t('common.actions.cancel') }}</Button>
          <Button variant="danger" icon="mdi:trash-can-outline" @click="confirmDiscard">
            {{ $t('common.messages.discardConfirm') }}
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { emitArticleCreated, emitArticleUpdated } = useArticleEvent()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)
const aiOpen = shallowRef(false)
const discardConfirmOpen = shallowRef(false)

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
const { drafts, loading, draftsOpen, successMessage, lastSavedAt, saving, loadDraft } = await useArticleDrafts(
  editedArticle,
  idle,
  {
    onDraftLoaded: () => {
      selectedSeries.value = null
      articleTags.value = []
    },
  },
)

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

const statusPillClass = computed(() => {
  switch (editedArticle.value.status) {
    case 'published':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    case 'archived':
      return 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  }
})

const statusIcon = computed(() => {
  switch (editedArticle.value.status) {
    case 'published':
      return 'mdi:check-circle-outline'
    case 'archived':
      return 'mdi:archive-outline'
    default:
      return 'mdi:circle-edit-outline'
  }
})

const statusLabel = computed(() => t(`articles.status.${editedArticle.value.status}`))

const autosaveVisible = computed(() => isNew && (saving.value || lastSavedAt.value !== null))

const publishLabel = computed(() => {
  if (isNew) return t('articles.createAndPublish')
  if (editedArticle.value.status === 'published') return t('articles.saveChanges')
  return t('articles.publishNow')
})

const releaseAtInput = computed<string | null>({
  get: () => {
    const v = editedArticle.value.releaseAt as unknown as string | Date | null
    if (!v) return null
    if (typeof v === 'string') return v.slice(0, 16)
    const d = v as Date
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  },
  set: (v) => {
    ;(editedArticle.value as any).releaseAt = v
  },
})

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

const setReleaseQuick = (kind: 'now' | 'inHour' | 'tomorrow' | 'clear') => {
  if (kind === 'clear') {
    editedArticle.value.releaseAt = null
    return
  }
  const d = new Date()
  if (kind === 'inHour') d.setHours(d.getHours() + 1)
  if (kind === 'tomorrow') {
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
  }
  d.setSeconds(0, 0)
  editedArticle.value.releaseAt = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) as any
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

const submit = async (targetStatus: 'draft' | 'published') => {
  if (!editedArticle.value.title) return toast.error({ message: 'Title is required' })

  const willPublishNow = targetStatus === 'published' && !editedArticle.value.releaseAt
  const releaseAt = editedArticle.value.releaseAt
    ? new Date(editedArticle.value.releaseAt)
    : willPublishNow
      ? new Date()
      : null

  const payload = {
    ...editedArticle.value,
    status: targetStatus,
    imageUrl: optimizedImageUrl.value || editedArticle.value.imageUrl,
    articleSeriesId: selectedSeries.value?.id || null,
    tags: articleTags.value,
    releaseAt,
  }

  try {
    if (isNew) {
      await $fetch('/api/articles', { method: 'POST', body: payload })
      toast.success({ message: targetStatus === 'published' ? 'Article published' : 'Draft created' })
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

const hasChanges = computed(() => {
  if (isNew) {
    return (
      editedArticle.value.title.length > 0 ||
      (editedArticle.value.content !== '' && editedArticle.value.content !== '<p></p>')
    )
  }
  return (
    editedArticle.value.title !== article.value?.title || editedArticle.value.content !== article.value?.content
  )
})

const goBack = () => {
  if (hasChanges.value) {
    discardConfirmOpen.value = true
    return
  }
  router.push('/admin')
}

const confirmDiscard = () => {
  discardConfirmOpen.value = false
  router.push('/admin')
}

onKeyStroke('Escape', () => {
  if (sidebarOpen.value) sidebarOpen.value = false
})

watch(
  () => editedArticle.value.title,
  (newTitle) => {
    if (isNew) editedArticle.value.slug = slugify(newTitle, { lower: true, strict: true, trim: true })
  },
)
</script>