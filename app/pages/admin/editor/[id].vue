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
          <ArticleStatusPill v-if="tr.isSource" :status="editedArticle.status" />
          <span v-else class="px-2 py-0.5 rounded-full text-[11px] font-medium" :class="translationBadge">
            {{ $t(`articles.translations.status.${tr.active?.status ?? 'MISSING'}`) }}
          </span>
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
        <ArticleEditorLanguageTabs
          v-if="tr.enabled"
          v-model="tr.activeLang"
          class="max-sm:hidden"
          :primaryLanguage="primaryLanguage"
          :targetLanguages="tr.targetLanguages"
          :byLanguage="tr.byLanguage"
        />

        <template v-if="tr.isSource">
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
        </template>

        <template v-else>
          <Button
            v-if="tr.hasBody"
            variant="secondary"
            icon="mdi:content-save-outline"
            class="max-sm:px-2!"
            :disabled="!tr.isDirty"
            :loading="tr.pending === 'save'"
            @click="tr.save()"
          >
            <span class="max-sm:hidden">{{ $t('common.actions.save') }}</span>
          </Button>

          <Button
            v-if="tr.hasBody && tr.active?.status !== 'PUBLISHED'"
            :loading="tr.pending === 'publish'"
            class="bg-indigo-600! hover:bg-indigo-700! text-white! border-transparent!"
            @click="tr.save('PUBLISHED')"
          >
            {{ $t('articles.translations.actions.approve') }}
          </Button>
        </template>
      </div>
    </header>

    <ArticleEditorLanguageTabs
      v-if="tr.enabled"
      v-model="tr.activeLang"
      class="sm:hidden self-start mb-4"
      :primaryLanguage="primaryLanguage"
      :targetLanguages="tr.targetLanguages"
      :byLanguage="tr.byLanguage"
    />

    <main class="flex flex-col min-w-0 gap-5">
      <!-- Language-neutral surfaces belong to the article, so they only exist on the source tab. -->
      <template v-if="tr.isSource">
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
      </template>

      <div
        v-else
        class="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
      >
        <span v-if="tr.active?.source" class="text-gray-500 dark:text-gray-400">
          {{ $t(`articles.translations.source.${tr.active.source}`) }}
        </span>
        <AppTime
          v-if="tr.active?.translatedAt"
          :datetime="tr.active.translatedAt"
          preset="shortDatetime"
          class="text-gray-500 dark:text-gray-400"
        />
        <span v-if="tr.isDirty" class="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {{ $t('articles.translations.unsaved') }}
        </span>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="neutral"
            icon="mdi:auto-fix"
            :loading="tr.pending === 'translate'"
            @click="tr.translateNow()"
          >
            {{
              tr.active
                ? $t('articles.translations.actions.retranslate')
                : $t('articles.translations.actions.translate')
            }}
          </Button>
          <Button
            v-if="tr.active"
            size="sm"
            variant="danger"
            icon="mdi:trash-can-outline"
            :loading="tr.pending === 'discard'"
            @click="discardTranslationOpen = true"
          >
            {{ $t('articles.translations.actions.discard') }}
          </Button>
        </div>
      </div>

      <p v-if="!tr.isSource && tr.active?.error" class="text-xs text-red-600 dark:text-red-400">
        {{ tr.active.error }}
      </p>

      <div class="flex flex-col gap-4">
        <textarea
          ref="titleRef"
          v-model="titleText"
          rows="1"
          :placeholder="$t('common.labels.articleTitle')"
          :aria-label="$t('common.labels.articleTitle')"
          class="w-full resize-none overflow-hidden break-words bg-transparent! rounded-none! px-0! pt-0! pb-1! text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-0 transition-colors border-x-0! border-t-0! border-b-2! border-solid! border-transparent! hover:border-gray-300! dark:hover:border-gray-700! focus:border-indigo-500!"
          @keydown.enter.prevent
        />

        <textarea
          ref="excerptRef"
          v-model="excerptText"
          rows="2"
          :placeholder="$t('common.labels.articleExcerpt')"
          :aria-label="$t('common.labels.articleExcerpt')"
          class="w-full resize-none bg-transparent! rounded-none! px-0! pt-0! pb-1! text-lg leading-relaxed text-gray-600! dark:text-gray-300! placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-0 transition-colors border-x-0! border-t-0! border-b! border-solid! border-transparent! hover:border-gray-300! dark:hover:border-gray-700! focus:border-indigo-500!"
        />

        <div
          v-if="activeSlug || excerptText"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500"
        >
          <span v-if="activeSlug" class="inline-flex items-center gap-1 min-w-0">
            <Icon name="mdi:link-variant" class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">/{{ activeSlug }}</span>
          </span>
          <span v-if="excerptText" class="tabular-nums">
            {{ excerptText.length }} {{ $t('articles.editor.toolbar.characters') }}
          </span>
        </div>
      </div>

      <template v-if="tr.isSource">
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
      </template>

      <hr class="border-gray-200 dark:border-gray-800" />

      <TiptapEditor v-if="bodyEditable" v-model="bodyModel" edit contentClass="min-h-[60vh]" />

      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t(`articles.translations.empty.${tr.active?.status ?? 'MISSING'}`) }}
      </p>
    </main>

    <ModalMini
      v-model:open="discardTranslationOpen"
      icon="mdi:alert-circle-outline"
      variant="danger"
      :title="$t('articles.translations.discardTitle')"
      :message="$t('articles.translations.discardMessage')"
      :confirmText="$t('articles.translations.actions.discard')"
      :cancelText="$t('common.actions.cancel')"
      @confirm="tr.discard()"
    />

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
import { translationStatusBadge } from '~~/shared/utils/articleTranslations'

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

// Language is a dimension of the article, not a separate screen: `tr.activeLang === ''` edits
// the source, anything else edits that translation through the same fields.
const tr = reactive(useArticleTranslations(article.value?.id))
const primaryLanguage = clientSite?.language ?? 'en'
const discardTranslationOpen = shallowRef(false)

const translationBadge = computed(() => translationStatusBadge(tr.active?.status))
const activeSlug = computed(() => (tr.isSource ? editedArticle.value.slug : (tr.active?.slug ?? '')))
const bodyEditable = computed(() => tr.isSource || tr.hasBody)

const bodyModel = computed({
  get: () => (tr.isSource ? editedArticle.value.content : tr.draft.content),
  set: (value: string) => {
    if (tr.isSource) editedArticle.value.content = value
    else tr.draft.content = value
  },
})

const titleModel = computed({
  get: () => (tr.isSource ? editedArticle.value.title : tr.draft.title),
  set: (value: string) => {
    if (tr.isSource) editedArticle.value.title = value
    else tr.draft.title = value
  },
})

const excerptModel = computed({
  get: () => (tr.isSource ? editedArticle.value.excerpt : tr.draft.excerpt),
  set: (value: string) => {
    if (tr.isSource) editedArticle.value.excerpt = value
    else tr.draft.excerpt = value
  },
})

const { textarea: titleRef, input: titleText } = useTextareaAutosize({ styleProp: 'minHeight' })
const { textarea: excerptRef, input: excerptText } = useTextareaAutosize({ styleProp: 'minHeight' })

watch(titleText, (value) => {
  const single = value.replace(/\s*\n+\s*/g, ' ')
  if (single !== value) titleText.value = single
  titleModel.value = single
})
watch(
  titleModel,
  (value) => {
    if ((value ?? '') !== titleText.value) titleText.value = value ?? ''
  },
  { immediate: true },
)

watch(excerptText, (value) => (excerptModel.value = value))
watch(
  excerptModel,
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
  // A rewritten translation is unsaved work too — leaving would drop it just as silently.
  if (tr.isDirty) return true
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
