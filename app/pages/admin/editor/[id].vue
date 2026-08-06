<template>
  <div
    class="custom-ui flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 pt-16 pb-24"
    style="--tiptap-toolbar-top: 8rem"
  >
    <header
      class="sticky top-16 z-20 -mx-4 px-4 mb-8 h-16 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-gray-100/85 dark:bg-gray-800/85 backdrop-blur-xl"
    >
      <Button
        icon="mdi:arrow-left"
        variant="neutral"
        size="sm"
        :aria="$t('common.actions.back')"
        :title="$t('common.actions.back')"
        @click="goBack"
      />

      <div class="flex flex-col min-w-0 gap-0.5">
        <h1 class="truncate text-sm font-semibold leading-tight">
          {{ isNew ? $t('articles.addArticle') : $t('articles.updateArticle') }}
        </h1>
        <div class="flex items-center gap-2 min-w-0">
          <ArticleStatusPill :status="editedArticle.status" />
          <span
            v-if="autosaveVisible"
            class="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400"
            aria-live="polite"
          >
            <Icon :name="saving ? 'mdi:cloud-sync' : 'mdi:cloud-check'" class="w-3.5 h-3.5 shrink-0" />
            <template v-if="saving">{{ $t('common.messages.savingNow') }}</template>
            <template v-else-if="lastSavedAt">
              {{ $t('common.messages.savedAgo') }}&nbsp;<AppTime :datetime="lastSavedAt" preset="relative" />
            </template>
          </span>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <Button
          v-if="translationsEnabled"
          variant="secondary"
          size="sm"
          icon="mdi:translate"
          class="max-sm:px-2!"
          :aria="$t('articles.translations.jump')"
          :title="$t('articles.translations.jump')"
          @click="scrollToTranslations"
        >
          <span class="max-sm:hidden">{{ $t('articles.translations.title') }}</span>
          <span
            v-if="translationReviewCount"
            class="min-w-4 px-1 rounded-full text-[10px] font-semibold leading-4 bg-amber-500 text-white"
          >
            {{ translationReviewCount }}
          </span>
        </Button>

        <Button
          v-if="isNew || editedArticle.status === 'draft'"
          variant="secondary"
          icon="mdi:content-save-outline"
          class="max-sm:px-2!"
          :disabled="!editedArticle.title || submitting"
          @click="submit('draft')"
        >
          <span class="max-sm:hidden">{{ isNew ? $t('articles.saveAsDraft') : $t('articles.saveChanges') }}</span>
        </Button>

        <Button
          :disabled="!editedArticle.title || submitting"
          :loading="submitting"
          class="bg-indigo-600! hover:bg-indigo-700! text-white! border-transparent!"
          @click="submit('published')"
        >
          {{ publishLabel }}
        </Button>
      </div>
    </header>

    <main class="flex flex-col min-w-0 gap-5">
      <ArticleEditorAiComposer
        :autofocus="route.query.ai === '1'"
        @partial="applyAiPartial"
        @image="applyAiImage"
        @final="applyAiFinal"
      />

      <FileUploader
        compact
        type="article-image"
        :imageUrl="editedArticle.imageUrl"
        :maxWidth="3840"
        :maxHeight="2160"
        @upload="handleUpload"
      />

      <div class="flex flex-col gap-4">
        <textarea
          ref="titleRef"
          v-model="titleText"
          rows="1"
          :placeholder="$t('common.labels.articleTitle')"
          :aria-label="$t('common.labels.articleTitle')"
          class="w-full resize-none overflow-hidden break-words bg-transparent! border-none! rounded-none! px-0! py-0! text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-0"
          @keydown.enter.prevent
        />

        <textarea
          ref="excerptRef"
          v-model="excerptText"
          rows="2"
          :placeholder="$t('common.labels.articleExcerpt')"
          :aria-label="$t('common.labels.articleExcerpt')"
          class="w-full resize-none bg-transparent! border-none! rounded-none! px-0! py-0! text-lg leading-relaxed text-gray-600! dark:text-gray-300! placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-0"
        />

        <div
          v-if="editedArticle.slug || editedArticle.excerpt"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500"
        >
          <span v-if="editedArticle.slug" class="inline-flex items-center gap-1 min-w-0">
            <Icon name="mdi:link-variant" class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">/{{ editedArticle.slug }}</span>
          </span>
          <span v-if="editedArticle.excerpt" class="tabular-nums">
            {{ editedArticle.excerpt.length }} {{ $t('articles.editor.toolbar.characters') }}
          </span>
        </div>
      </div>

      <ArticleEditorMetaBar
        v-model:series="selectedSeries"
        v-model:tags="articleTags"
        v-model:releaseAt="editedArticle.releaseAt"
      />

      <div v-if="!article && drafts?.length" class="flex items-center">
        <ArticleEditorChip icon="mdi:file-document-outline" @click="draftsOpen = true">
          {{ $t('articles.editor.drafts.loadDrafts') }}
        </ArticleEditorChip>
      </div>

      <hr class="border-gray-200 dark:border-gray-800" />

      <TiptapEditor v-model="editedArticle.content" edit contentClass="min-h-[60vh]" />

      <!-- scroll-mt clears both sticky bars (global header 4rem + page header 4rem) -->
      <div v-if="!isNew && article?.id" ref="translationsSection" class="flex flex-col gap-5 scroll-mt-36">
        <hr class="border-gray-200 dark:border-gray-800" />
        <LazyArticleTranslations :articleId="article.id" />
      </div>
    </main>

    <LazyArticleDrafts
      v-model:open="draftsOpen"
      :drafts="drafts"
      :loading="loading"
      @select="loadDraft"
      @close="draftsOpen = false"
    />

    <ModalMini
      v-model:open="discardConfirmOpen"
      icon="mdi:alert-circle-outline"
      :title="$t('common.messages.discardChangesTitle')"
      :message="$t('common.messages.discardChangesText')"
    >
      <template #actions>
        <Button variant="danger" size="sm" icon="mdi:trash-can-outline" @click="confirmDiscard">
          {{ $t('common.messages.discardConfirm') }}
        </Button>
      </template>
    </ModalMini>
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const toast = useToast()
const { t } = useI18n()
const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()

const clientSite = await useClientSite()

const isNew = route.params.id === 'new'
const discardConfirmOpen = shallowRef(false)
const submitting = shallowRef(false)

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

const { idle } = useIdle(5 * 60 * 1000)
const { drafts, loading, draftsOpen, lastSavedAt, saving, loadDraft } = await useArticleDrafts(editedArticle, idle, {
  onDraftLoaded: () => {
    selectedSeries.value = null
    articleTags.value = []
  },
})

if (!isNew) {
  try {
    const data = await $fetch<any>(`/api/articles/${route.params.id}`, {
      query: { clientSiteId: clientSite?.id },
    })
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
    toast.error({ message: t('articles.editor.loadFailed') })
    router.push(localePath({ name: 'admin' }))
  }
}

// The panel itself lives at the very bottom of an unbounded page, so the header carries
// the only always-visible hint that it exists (plus its review badge). Same fetch key as
// the panel — one request, and saving down there updates the badge up here.
const { reviewCount: translationReviewCount, enabled: translationsEnabled } = useArticleTranslations(article.value?.id)

const translationsSection = useTemplateRef<HTMLElement>('translationsSection')
const scrollToTranslations = () => translationsSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const { textarea: titleRef, input: titleText } = useTextareaAutosize({ styleProp: 'minHeight' })
const { textarea: excerptRef, input: excerptText } = useTextareaAutosize({ styleProp: 'minHeight' })

watch(titleText, (value) => {
  const single = value.replace(/\s*\n+\s*/g, ' ')
  if (single !== value) titleText.value = single
  editedArticle.value.title = single
})
watch(
  () => editedArticle.value.title,
  (value) => {
    if ((value ?? '') !== titleText.value) titleText.value = value ?? ''
  },
  { immediate: true },
)

watch(excerptText, (value) => (editedArticle.value.excerpt = value))
watch(
  () => editedArticle.value.excerpt,
  (value) => {
    if ((value ?? '') !== excerptText.value) excerptText.value = value ?? ''
  },
  { immediate: true },
)

const autosaveVisible = computed(() => isNew && (saving.value || lastSavedAt.value !== null))

const publishLabel = computed(() => {
  if (isNew) return t('articles.createAndPublish')
  if (editedArticle.value.status === 'published') return t('articles.saveChanges')
  return t('articles.publishNow')
})

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  editedArticle.value.imageUrl = file.url
  optimizedImageUrl.value = file.optimizedUrl
}

const applyAiPartial = (partial: { title?: string; perex?: string; content?: string }) => {
  if (partial.title != null) editedArticle.value.title = partial.title
  if (partial.perex != null) editedArticle.value.excerpt = partial.perex
  if (partial.content != null) editedArticle.value.content = partial.content
}

const applyAiImage = ({ slot, html }: { slot: number; html: string }) => {
  editedArticle.value.content = replaceSlot(editedArticle.value.content ?? '', 'IMAGE', slot, html)
}

const applyAiFinal = (generated: Record<string, any>) => {
  optimizedImageUrl.value = ''
  Object.assign(editedArticle.value, {
    title: generated.title,
    excerpt: generated.perex,
    content: generated.content,
    imageUrl: generated.articleImageUrl,
  })
}

const submit = async (targetStatus: 'draft' | 'published') => {
  if (submitting.value) return
  if (!editedArticle.value.title)
    return toast.error({ message: t('common.messages.requiredField', [t('common.labels.title')]) })

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

  submitting.value = true
  try {
    if (isNew) {
      await $fetch('/api/articles', { method: 'POST', body: payload })
      toast.success({ message: t('articles.editor.createSuccess') })
      await invalidateArticlesAndStats()
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.success({ message: t('common.messages.saveSuccess') })
      await invalidateArticles()
    }
    router.push(localePath({ name: 'admin' }))
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('common.messages.saveFailed') })
  } finally {
    submitting.value = false
  }
}

const hasChanges = computed(() => {
  if (isNew) {
    return (
      editedArticle.value.title.length > 0 ||
      (editedArticle.value.content !== '' && editedArticle.value.content !== '<p></p>')
    )
  }
  return editedArticle.value.title !== article.value?.title || editedArticle.value.content !== article.value?.content
})

const goBack = () => {
  if (hasChanges.value) {
    discardConfirmOpen.value = true
    return
  }
  router.push(localePath({ name: 'admin' }))
}

const confirmDiscard = () => {
  discardConfirmOpen.value = false
  router.push(localePath({ name: 'admin' }))
}

watch(
  () => editedArticle.value.title,
  (newTitle) => {
    if (isNew) editedArticle.value.slug = slugify(newTitle, { lower: true, strict: true, trim: true })
  },
)
</script>
