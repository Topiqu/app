<template>
  <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-12 pt-6">
    <div
      role="region"
      data-editor-command-bar
      :data-editor-submitting="submitting"
      :data-editor-title-length="editedArticle.title?.length || 0"
      :aria-label="$t('articles.editor.title')"
      class="sticky top-0 z-20 -mx-4 mb-8 flex flex-col gap-2 border-b border-default bg-default px-4 py-2 md:h-16 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex items-center gap-3 min-w-0">
        <UButton
          icon="i-mdi-arrow-left"
          color="neutral"
          variant="soft"
          :aria-label="$t('common.actions.back') || 'Back'"
          @click="goBack"
        />
        <h1 class="min-w-0 text-lg font-bold">
          {{ isNew ? $t('articles.addArticle') : $t('articles.updateArticle') }}
        </h1>
        <div class="flex items-center gap-2 min-w-0">
          <ArticleStatusPill v-if="tr.isSource" :status="editedArticle.status" />
          <UBadge v-else :color="translationBadgeColor" variant="soft" size="sm">
            {{ $t(`articles.translations.status.${tr.active?.status ?? 'MISSING'}`) }}
          </UBadge>
          <span
            v-if="autosaveVisible"
            class="hidden items-center gap-1 text-[11px] text-gray-500 sm:flex md:hidden dark:text-gray-400"
            aria-live="polite"
          >
            <UIcon :name="saveStatusIcon" class="size-3.5 shrink-0 transition duration-300" :class="saveStatusClass" />
            <template v-if="saving">{{ $t('common.messages.savingNow') }}</template>
            <template v-else-if="lastSavedAt">
              {{ $t('common.messages.savedAgo') }}&nbsp;<AppTime :datetime="lastSavedAt" preset="relative" />
            </template>
          </span>
          <span
            v-if="aiGenerating"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-primary"
            aria-live="polite"
          >
            <Icon name="mdi:loading" class="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
            {{ $t('articles.editor.ai.generating') }}
          </span>
        </div>
      </div>

      <div class="flex w-full items-center gap-2 overflow-x-auto md:ml-auto md:w-auto md:overflow-visible">
        <div v-if="autosaveVisible" class="hidden md:flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
          <UIcon :name="saveStatusIcon" size="16" class="transition duration-300" :class="saveStatusClass" />
          <template v-if="saving">{{ $t('common.messages.savingNow') }}</template>
          <template v-else-if="lastSavedAt">
            {{ $t('common.messages.savedAgo') }}&nbsp;<AppTime :datetime="lastSavedAt" preset="relative" />
          </template>
          <template v-else>{{ $t('common.messages.unsaved') }}</template>
        </div>

        <UButton
          v-if="livePath"
          :to="livePath"
          target="_blank"
          icon="i-mdi-open-in-new"
          color="neutral"
          variant="ghost"
          :aria-label="$t('common.actions.view')"
        />
        <UButton
          icon="i-mdi-eye-outline"
          color="neutral"
          variant="ghost"
          :aria-label="$t('articles.editor.preview.title')"
          @click="previewing = true"
        />

        <UButton
          icon="i-mdi-cog"
          color="neutral"
          variant="soft"
          class="lg:hidden"
          square
          :aria-label="$t('articles.editor.settingsTitle')"
          :title="$t('articles.editor.settingsTitle')"
          @click="sidebarOpen = true"
        />

        <UButton
          v-if="tr.isSource && (isNew || editedArticle.status === 'draft')"
          color="neutral"
          variant="soft"
          class="shrink-0"
          :disabled="submitting"
          @click="submit('draft')"
        >
          {{ isNew ? $t('articles.saveAsDraft') : $t('articles.saveChanges') }}
        </UButton>

        <UButton
          v-if="tr.isSource"
          :disabled="submitting"
          :loading="submitting"
          color="primary"
          variant="solid"
          class="shrink-0"
          @click="submit('published')"
        >
          {{ publishLabel }}
        </UButton>
      </div>
    </div>

    <UProgress v-if="!isNew && tr.status === 'pending'" class="mb-6" :aria-label="$t('common.loading')" />

    <div v-if="!isNew && tr.enabled" class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ArticleEditorLanguageTabs
        v-model="activeLanguageModel"
        :primaryLanguage="primaryLanguage"
        :targetLanguages="tr.targetLanguages"
        :byLanguage="tr.byLanguage"
      />
      <div v-if="!tr.isSource" class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="!tr.hasBody"
          icon="i-mdi-translate"
          :loading="tr.pending === 'translate'"
          :disabled="Boolean(tr.pending)"
          @click="tr.translateNow()"
        >
          {{ $t('articles.translations.actions.translate') }}
        </UButton>
        <template v-else>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-mdi-content-save-outline"
            :loading="tr.pending === 'save'"
            :disabled="Boolean(tr.pending) || !tr.isDirty"
            @click="tr.save()"
          >
            {{ $t('common.actions.saveChanges') }}
          </UButton>
          <UButton
            icon="i-mdi-check-circle-outline"
            :loading="tr.pending === 'publish'"
            :disabled="Boolean(tr.pending) || tr.isDirty"
            @click="tr.save('PUBLISHED')"
          >
            {{ $t('articles.translations.actions.approve') }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-mdi-translate"
            :loading="tr.pending === 'translate'"
            :disabled="Boolean(tr.pending) || tr.isDirty"
            @click="tr.translateNow()"
          >
            {{ $t('articles.translations.actions.retranslate') }}
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            icon="i-mdi-delete-outline"
            :disabled="Boolean(tr.pending)"
            @click="discardTranslationOpen = true"
          >
            {{ $t('articles.translations.actions.discard') }}
          </UButton>
        </template>
      </div>
    </div>

    <UAlert
      v-if="!isNew && !tr.isSource && !tr.hasBody && !tr.error"
      class="mb-6"
      color="neutral"
      variant="soft"
      icon="i-mdi-translate"
      :title="$t(`articles.translations.status.${tr.active?.status ?? 'MISSING'}`)"
      :description="$t(`articles.translations.empty.${tr.active?.status ?? 'MISSING'}`)"
    />

    <UAlert
      v-if="!isNew && tr.error"
      class="mb-6"
      color="error"
      icon="i-mdi-alert-circle-outline"
      :title="$t('common.messages.loadFailedTitle')"
      :description="$t('common.messages.loadFailedText')"
    >
      <template #actions>
        <UButton color="error" variant="soft" size="sm" @click="tr.refresh()">
          {{ $t('common.messages.retry') }}
        </UButton>
      </template>
    </UAlert>

    <div
      class="grid flex-1 items-start gap-8"
      :class="settingsExpanded ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : 'lg:grid-cols-[minmax(0,1fr)_3rem]'"
    >
      <div class="min-w-0 flex flex-col gap-6">
        <UFormField :label="$t('common.labels.articleTitle')">
          <UInput
            v-model="titleModel"
            :placeholder="$t('common.labels.articleTitle')"
            class="w-full"
            @input="updateSlug"
          />
        </UFormField>
        <UFormField :label="$t('common.labels.articleExcerpt')">
          <UTextarea
            :modelValue="excerptModel ?? undefined"
            :placeholder="$t('common.labels.articleExcerpt')"
            class="w-full"
            autoresize
            @update:modelValue="excerptModel = $event || null"
          />
        </UFormField>

        <div class="mt-4 min-w-0 max-w-full">
          <TiptapEditor v-model="bodyModel" :edit="bodyEditable" class="min-h-[500px]" />

          <div v-if="!article && drafts?.length" class="flex items-center gap-2 mt-4">
            <UButton size="sm" icon="i-mdi-file-document-outline" @click="draftsOpen = true">
              {{ $t('articles.editor.drafts.loadDrafts') }}
            </UButton>
            <UAlert
              v-if="successMessage"
              color="success"
              variant="soft"
              icon="i-mdi-check-circle"
              :title="successMessage"
            />
          </div>
        </div>
      </div>
      <aside class="sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto lg:block">
        <div
          v-if="settingsExpanded"
          class="rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-5"
        >
          <div class="mb-5 flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">{{ $t('articles.editor.settingsTitle') }}</h2>
            <UButton
              icon="i-mdi-chevron-right"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('common.actions.collapse')"
              @click="settingsExpanded = false"
            />
          </div>
          <ArticleEditorSettingsPanel
            v-model:selectedSeries="selectedSeries"
            v-model:customPrompt="customPrompt"
            v-model:releaseAt="releaseAtInput"
            v-model:sources="sourcesModel"
            v-model:aiOpen="aiOpen"
            :article="article"
            :imageUrl="editedArticle.imageUrl"
            :articleTags="articleTags"
            :aiGenerating="aiGenerating"
            :aiPhase="aiPhase"
            @upload="handleUpload"
            @generate="generateAIContent"
            @stop="stopGeneration"
            @addTag="addTag"
            @removeTag="removeTag"
            @quickRelease="setReleaseQuick"
          />
        </div>
        <UButton
          v-else
          icon="i-mdi-cog-outline"
          color="neutral"
          variant="soft"
          square
          :aria-label="$t('common.actions.expand')"
          @click="settingsExpanded = true"
        />
      </aside>
    </div>

    <UModal
      v-model:open="discardTranslationOpen"
      :title="$t('articles.translations.discardTitle')"
      :description="$t('articles.translations.discardMessage')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="discardTranslationOpen = false">
            {{ $t('common.actions.cancel') }}
          </UButton>
          <UButton color="error" icon="i-mdi-delete-outline" @click="discardTranslation">
            {{ $t('articles.translations.actions.discard') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <LazyArticleDrafts
      v-model:open="draftsOpen"
      :drafts="drafts"
      :loading="loading"
      @select="loadDraft"
      @close="draftsOpen = false"
    />

    <UModal v-model:open="previewing" :title="$t('articles.editor.preview.title')">
      <template #body>
        <ArticleEditorPreview
          :articleId="editedArticle.id"
          :title="titleModel"
          :excerpt="excerptModel"
          :content="bodyModel"
          :imageUrl="editedArticle.imageUrl"
          :tags="articleTags"
          :sources="editedArticle.sources"
          :series="previewSeries"
        />
      </template>
    </UModal>

    <USlideover v-model:open="sidebarOpen" :title="$t('articles.editor.settingsTitle')" class="lg:hidden">
      <template #body>
        <ArticleEditorSettingsPanel
          v-model:selectedSeries="selectedSeries"
          v-model:customPrompt="customPrompt"
          v-model:releaseAt="releaseAtInput"
          v-model:sources="sourcesModel"
          v-model:aiOpen="aiOpen"
          :article="article"
          :imageUrl="editedArticle.imageUrl"
          :articleTags="articleTags"
          :aiGenerating="aiGenerating"
          :aiPhase="aiPhase"
          @upload="handleUpload"
          @generate="generateAIContent"
          @stop="stopGeneration"
          @addTag="addTag"
          @removeTag="removeTag"
          @quickRelease="setReleaseQuick"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="discardConfirmOpen"
      :title="$t('common.messages.discardChangesTitle')"
      :description="$t('common.messages.discardChangesText')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton color="error" size="sm" icon="i-mdi-trash-can-outline" @click="confirmDiscard">
            {{ $t('common.messages.discardConfirm') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

import slugify from 'slugify'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const toast = useAppToast()
const { t } = useI18n()
const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()

const clientSite = await useClientSite()
const requestFetch = useRequestFetch()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)
const settingsExpanded = useLocalStorage('topiqu-editor-settings-expanded', true)
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
    imageCredit: null,
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
const aiPhase = shallowRef<'writing' | 'images'>('writing')
const { streamGenerate, stop: stopGeneration } = useArticleGeneration()
const serializeSourceState = () =>
  JSON.stringify({
    article: editedArticle.value,
    tags: [...articleTags.value].sort(),
    seriesId: selectedSeries.value?.id ?? null,
  })
const sourceBaseline = shallowRef(serializeSourceState())

const { idle } = useIdle(5 * 60 * 1000)
const { drafts, loading, draftsOpen, successMessage, lastSavedAt, saving, loadDraft } = await useArticleDrafts(
  editedArticle,
  idle,
  {
    enabled: isNew,
    onDraftLoaded: () => {
      selectedSeries.value = null
      articleTags.value = []
    },
  },
)

if (!isNew) {
  try {
    const data = await requestFetch<any>(`/api/articles/${route.params.id}`, {
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
    sourceBaseline.value = serializeSourceState()
  } catch (e: any) {
    console.error(e)
    const status = Number(e?.statusCode || e?.status || e?.response?.status)
    const key =
      status === 401
        ? 'common.errors.unauthorized'
        : status === 403
          ? 'common.errors.forbidden'
          : 'common.errors.articleNotFound'
    toast.add({ color: 'error', title: t(key) })
    router.push(localePath({ name: 'admin' }))
  }
}

// Language is a dimension of the article, not a separate screen: `tr.activeLang === ''` edits
// the source, anything else edits that translation through the same fields.
// Product routes intentionally have no public-domain client-site payload. The detail contract
// carries the resolved source language, so editor tabs remain correct in the persistent shell.
const primaryLanguage = article.value?.language ?? clientSite?.language ?? 'en'

// `?lang=` lets the admin table deep-link straight to a language. The primary language is the
// source tab, which the composable represents as an empty string. Seeded at construction rather
// than assigned afterwards, so nothing can reconcile it away before the payload lands.
const requestedLang = route.query.lang as string | undefined
const initialLang = !isNew && requestedLang && requestedLang !== primaryLanguage ? requestedLang : ''

const tr = reactive(useArticleTranslations(article.value?.id, initialLang))
const discardTranslationOpen = shallowRef(false)
const activeLanguageModel = computed({
  get: () => tr.activeLang,
  set: (language: string) => {
    if (language === tr.activeLang) return
    if (tr.isDirty) {
      toast.add({ color: 'warning', title: t('articles.translations.unsaved') })
      return
    }
    tr.activeLang = language
  },
})

/** Public URL of whichever language is on screen — only once it has a slug to point at. */
const livePath = computed(() => {
  if (isNew || !activeSlug.value) return ''
  const language = (tr.isSource ? primaryLanguage : tr.activeLang) as Language
  return localePath({ name: 'clanky-slug', params: { slug: activeSlug.value } }, language)
})

const translationBadgeColor = computed(() => {
  const status = tr.active?.status
  if (status === 'PUBLISHED') return 'success' as const
  if (status === 'READY') return 'warning' as const
  if (status === 'FAILED') return 'error' as const
  return 'neutral' as const
})
const activeSlug = computed(() => (tr.isSource ? editedArticle.value.slug : (tr.active?.slug ?? '')))
const bodyEditable = computed(() => tr.isSource || tr.hasBody)

watch(
  () => tr.activeLang,
  (language) => {
    const query = { ...route.query }
    if (language) query.lang = language
    else delete query.lang
    router.replace({ query })
  },
)

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

const sourcesModel = computed<string[]>({
  get: () => editedArticle.value.sources ?? [],
  set: (value) => {
    editedArticle.value.sources = value
  },
})

const autosaveVisible = computed(() => isNew && (saving.value || lastSavedAt.value !== null))
const saveConfirmed = shallowRef(false)
const { start: clearSaveConfirmed } = useTimeoutFn(() => (saveConfirmed.value = false), 1400, { immediate: false })
const saveStatusIcon = computed(() =>
  saving.value ? 'i-mdi-cloud-sync' : saveConfirmed.value ? 'i-mdi-check-circle' : 'i-mdi-cloud-check',
)
const saveStatusClass = computed(() =>
  saving.value
    ? 'animate-spin motion-reduce:animate-none'
    : saveConfirmed.value
      ? 'scale-125 text-success'
      : 'scale-100',
)

watch(saving, (current, previous) => {
  if (!current && previous && lastSavedAt.value) {
    saveConfirmed.value = true
    clearSaveConfirmed()
  }
})

const isBlank = computed(() => isBlankArticle(editedArticle.value))

const previewing = shallowRef(false)

const releaseAtInput = computed<string | null>({
  get: () => {
    const value = editedArticle.value.releaseAt as unknown as string | Date | null
    if (!value) return null
    if (typeof value === 'string') return value.slice(0, 16)
    return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  },
  set: (value) => {
    editedArticle.value.releaseAt = value as any
  },
})

const updateSlug = () => {
  if (isNew) editedArticle.value.slug = slugify(editedArticle.value.title, { lower: true, strict: true, trim: true })
}
const addTag = (id: string) => {
  if (!articleTags.value.includes(id)) articleTags.value.push(id)
}
const removeTag = (id: string) => {
  articleTags.value = articleTags.value.filter((tag) => tag !== id)
}
const setReleaseQuick = (kind: 'now' | 'inHour' | 'tomorrow' | 'clear') => {
  if (kind === 'clear') {
    editedArticle.value.releaseAt = null
    return
  }
  const date = new Date()
  if (kind === 'inHour') date.setHours(date.getHours() + 1)
  if (kind === 'tomorrow') {
    date.setDate(date.getDate() + 1)
    date.setHours(8, 0, 0, 0)
  }
  date.setSeconds(0, 0)
  editedArticle.value.releaseAt = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16) as any
}

// `Hero.vue` wants the part number, which only the selected series knows. A new article lands
// after the ones already in the series, so its own position is one past the end.
const previewSeries = computed(() => {
  const series = selectedSeries.value
  if (!series?.name) return null
  const total = (series.articles?.length ?? 0) + 1

  return { name: series.name, current: total, total }
})

// Escape leaves the preview, the way Escape leaves any mode. No chord to enter it: Ctrl+Shift+P
// is Firefox's private window and Ctrl+Alt+P is AltGr on a Czech layout, so the header button
// is the only affordance that works everywhere.
onKeyStroke('Escape', () => {
  if (previewing.value) previewing.value = false
})

const aiGenerating = shallowRef(false)
// Expanded while there is nothing to lose, or on the `?ai=1` deep link. Generation rewrites the
// whole article, so a permanently open composer serves no mid-article iteration — it just pushed
// the title below the fold on every visit.
const aiOpen = shallowRef(isBlank.value || route.query.ai === '1')

const publishLabel = computed(() => t(`articles.${publishAction(editedArticle.value, isNew)}`))

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  editedArticle.value.imageUrl = file.url
  // The author's own picture inherits neither the previous cover's AI label nor its attribution.
  editedArticle.value.imageCredit = null
  optimizedImageUrl.value = file.optimizedUrl
}

const generateAIContent = async () => {
  aiGenerating.value = true
  aiPhase.value = 'writing'
  try {
    const outcome = await streamGenerate(customPrompt.value || 'Empty...', {
      onPartial: (partial) => {
        if (partial.title != null) editedArticle.value.title = partial.title
        if (partial.perex != null) editedArticle.value.excerpt = partial.perex
        if (partial.content != null) editedArticle.value.content = partial.content
      },
      onPhase: (phase) => (aiPhase.value = phase),
      onImage: ({ slot, html }) => {
        editedArticle.value.content = (editedArticle.value.content ?? '').replace(`[[IMAGE${slot}]]`, html)
      },
      onFinal: (article) => {
        Object.assign(editedArticle.value, {
          title: article.title,
          excerpt: article.perex,
          content: article.content,
          imageUrl: article.articleImageUrl,
        })
      },
    })
    if (outcome === 'aborted') toast.add({ color: 'info', title: 'AI Generation Stopped' })
    else toast.add({ color: 'success', title: 'AI Content Generated' })
  } catch {
    toast.add({ color: 'error', title: 'AI Generation Failed' })
  } finally {
    aiGenerating.value = false
  }
}

const submit = async (targetStatus: 'draft' | 'published') => {
  if (submitting.value) return
  if (!editedArticle.value.title) return toast.add({ color: 'error', title: 'Title is required' })

  const releaseAt = editedArticle.value.releaseAt ? new Date(editedArticle.value.releaseAt) : null
  const schedulesForLater = targetStatus === 'published' && !!releaseAt && releaseAt.getTime() > Date.now()
  const effectiveStatus = schedulesForLater ? 'draft' : targetStatus

  const payload = {
    ...editedArticle.value,
    status: targetStatus,
    imageUrl: editedArticle.value.imageUrl,
    articleSeriesId: selectedSeries.value?.id || null,
    tags: articleTags.value,
    releaseAt,
    sources: (editedArticle.value.sources ?? []).map((source) => source.trim()).filter(Boolean),
  }

  submitting.value = true
  try {
    if (isNew) {
      const created = await $fetch<{ slug: string }>('/api/articles', { method: 'POST', body: payload })
      toast.add({ color: 'success', title: targetStatus === 'published' ? 'Article published' : 'Draft created' })
      await invalidateArticlesAndStats()
      // The route param is the slug, and changing it remounts the page (Nuxt's default page key
      // interpolates params) — which is what we want exactly once: `useArticleTranslations` bakes
      // the article id into its fetch URL at construction, so it has to be rebuilt against the
      // saved article before the language tabs mean anything.
      allowNavigation.value = true
      await router.replace(localePath({ name: 'admin-editor-id', params: { id: created.slug } }))
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.add({ color: 'success', title: 'Article updated' })
      await invalidateArticles()
      // Stay in the document. Re-baseline the two fields `hasChanges` compares, or leaving would
      // prompt to discard work that is already saved.
      article.value = { ...article.value!, title: payload.title, content: payload.content }
      editedArticle.value.status = effectiveStatus
      editedArticle.value.sources = payload.sources
      sourceBaseline.value = serializeSourceState()
    }
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || 'Error saving article' })
  } finally {
    submitting.value = false
  }
}

const hasChanges = computed(() => {
  // A rewritten translation is unsaved work too — leaving would drop it just as silently.
  if (tr.isDirty) return true
  return serializeSourceState() !== sourceBaseline.value
})

const allowNavigation = shallowRef(false)

onBeforeRouteLeave(() => {
  if (allowNavigation.value || !hasChanges.value) return true
  discardConfirmOpen.value = true
  return false
})

if (import.meta.client) {
  useEventListener(window, 'beforeunload', (event) => {
    if (!hasChanges.value) return
    event.preventDefault()
  })
}

const goBack = () => {
  if (hasChanges.value) {
    discardConfirmOpen.value = true
    return
  }
  router.push(localePath({ name: 'admin' }))
}

const confirmDiscard = () => {
  discardConfirmOpen.value = false
  allowNavigation.value = true
  router.push(localePath({ name: 'admin' }))
}

const discardTranslation = async () => {
  await tr.discard()
  discardTranslationOpen.value = false
}

watch(
  () => editedArticle.value.title,
  (newTitle) => {
    if (isNew) editedArticle.value.slug = slugify(newTitle, { lower: true, strict: true, trim: true })
  },
)
</script>
