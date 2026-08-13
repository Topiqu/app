<template>
  <div
    class="custom-ui flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 pt-18 pb-24"
    style="--tiptap-toolbar-top: 8.5rem"
  >
    <header
      class="sticky top-18 z-20 -mx-4 px-4 mb-8 h-16 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 bg-gray-100/85 dark:bg-gray-800/85 backdrop-blur-xl"
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
          <span
            v-if="aiGenerating"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300"
            aria-live="polite"
          >
            <Icon name="mdi:loading" class="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
            {{ $t('articles.editor.ai.generating') }}
          </span>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <NuxtLink
          v-if="livePath"
          :to="livePath"
          target="_blank"
          class="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg no-underline text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          :title="$t('articles.translations.viewLive')"
          :aria-label="$t('articles.translations.viewLive')"
        >
          <Icon name="mdi:open-in-new" class="w-4 h-4" />
        </NuxtLink>

        <button
          type="button"
          class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-transparent! hover:bg-gray-200! dark:hover:bg-gray-700! text-gray-500 dark:text-gray-400"
          :class="{ 'bg-gray-200! dark:bg-gray-700! text-gray-900! dark:text-gray-100!': previewing }"
          :aria-pressed="previewing"
          :title="$t('articles.editor.preview.toggle')"
          :aria-label="$t('articles.editor.preview.toggle')"
          @click="previewing = !previewing"
        >
          <Icon :name="previewing ? 'mdi:pencil-outline' : 'mdi:eye-outline'" class="w-4 h-4" />
        </button>

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

    <ArticleEditorPreview
      v-if="previewing"
      :title="titleModel"
      :excerpt="excerptModel"
      :content="bodyModel"
      :imageUrl="editedArticle.imageUrl"
      :articleId="article?.id"
      :tags="articleTags"
      :sources="editedArticle.sources"
      :series="previewSeries"
    />

    <main v-else class="flex flex-col min-w-0 gap-5">
      <!-- Language-neutral surfaces belong to the article, so they only exist on the source tab.
           Starters come first because they all answer the same question — where does the first
           draft come from — and they retreat to a single chip once that question is answered. -->
      <template v-if="tr.isSource">
        <ArticleEditorAiComposer
          v-if="aiOpen"
          v-model:generating="aiGenerating"
          :autofocus="aiAutofocus"
          @partial="applyAiPartial"
          @image="applyAiImage"
          @final="applyAiFinal"
          @settle="settleAiSlots"
        />

        <div v-if="!aiOpen || isBlank" class="flex flex-wrap items-center gap-2">
          <ArticleEditorChip v-if="!aiOpen" icon="mdi:auto-fix" size="md" @click="openAi">
            {{ $t('common.labels.aiGeneration') }}
          </ArticleEditorChip>

          <template v-if="isBlank">
            <ArticleEditorChip
              v-if="!article && drafts?.length"
              icon="mdi:file-document-outline"
              size="md"
              @click="draftsOpen = true"
            >
              {{ $t('articles.editor.drafts.loadDrafts') }}
            </ArticleEditorChip>

            <ArticleEditorChip icon="mdi:import" size="md" @click="jsonInput?.click()">
              {{ $t('articles.editor.modes.import') }}
            </ArticleEditorChip>
            <input ref="jsonInput" type="file" accept=".json" class="hidden" @change="importJson" />
          </template>
        </div>
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

      <div
        v-if="!tr.isSource && tr.pending === 'translate'"
        class="relative overflow-hidden flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-200"
        role="status"
        aria-live="polite"
      >
        <div class="absolute inset-x-0 top-0 h-0.5 bg-indigo-500/15">
          <div class="h-full w-1/3 bg-indigo-500 animate-progress-slide motion-reduce:animate-none" />
        </div>
        <Icon name="mdi:translate" class="w-4 h-4" />
        {{ $t('articles.translations.status.TRANSLATING') }}
      </div>

      <div
        v-if="!tr.isSource && tr.pending === 'translate'"
        class="flex flex-col gap-6 py-2 animate-pulse"
        aria-hidden="true"
      >
        <div class="space-y-3">
          <div class="h-10 sm:h-12 w-4/5 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div class="h-6 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-6 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div class="h-px bg-gray-200 dark:bg-gray-800" />
        <div class="space-y-3">
          <div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-4 w-11/12 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-32 w-full rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div class="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      <template v-else>
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

        <!-- Cover sits below the excerpt because that is where it appears in `Hero.vue`: the editor
           now reads in the same order as the published article. -->
        <template v-if="tr.isSource">
          <FileUploader
            compact
            type="article-image"
            :imageUrl="editedArticle.imageUrl"
            :maxWidth="3840"
            :maxHeight="2160"
            @upload="handleUpload"
          />

          <ArticleEditorMetaBar
            v-model:series="selectedSeries"
            v-model:tags="articleTags"
            v-model:releaseAt="editedArticle.releaseAt"
            v-model:sources="editedArticle.sources"
          />
        </template>

        <hr class="border-gray-200 dark:border-gray-800" />

        <!-- Lazy so the title, excerpt and strip are interactive before the editor bundle lands —
           and so a translation tab with no body never pays for it at all. -->
        <LazyTiptapEditor v-if="bodyEditable" v-model="bodyModel" edit contentClass="min-h-[60vh]" />

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ $t(`articles.translations.empty.${tr.active?.status ?? 'MISSING'}`) }}
        </p>
      </template>
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

const { idle } = useIdle(5 * 60 * 1000)
const { drafts, loading, draftsOpen, lastSavedAt, saving, loadDraft } = await useArticleDrafts(editedArticle, idle, {
  enabled: isNew,
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
const primaryLanguage = clientSite?.language ?? 'en'

// `?lang=` lets the admin table deep-link straight to a language. The primary language is the
// source tab, which the composable represents as an empty string. Seeded at construction rather
// than assigned afterwards, so nothing can reconcile it away before the payload lands.
const requestedLang = route.query.lang as string | undefined
const initialLang = !isNew && requestedLang && requestedLang !== primaryLanguage ? requestedLang : ''

const tr = reactive(useArticleTranslations(article.value?.id, initialLang))
const discardTranslationOpen = shallowRef(false)

/** Public URL of whichever language is on screen — only once it has a slug to point at. */
const livePath = computed(() => {
  if (isNew || !activeSlug.value) return ''
  const language = (tr.isSource ? primaryLanguage : tr.activeLang) as Language
  return localePath({ name: 'clanky-slug', params: { slug: activeSlug.value } }, language)
})

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

const isBlank = computed(() => isBlankArticle(editedArticle.value))

const previewing = shallowRef(false)

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

const jsonInput = useTemplateRef<HTMLInputElement>('jsonInput')
const aiAutofocus = shallowRef(route.query.ai === '1')
const aiGenerating = shallowRef(false)
// Expanded while there is nothing to lose, or on the `?ai=1` deep link. Generation rewrites the
// whole article, so a permanently open composer serves no mid-article iteration — it just pushed
// the title below the fold on every visit.
const aiOpen = shallowRef(isBlank.value || route.query.ai === '1')

const openAi = () => {
  aiAutofocus.value = true
  aiOpen.value = true
}

const importJson = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const [data] = JSON.parse(await file.text())
    if (!data) throw new Error('empty')

    Object.assign(editedArticle.value, {
      title: data.title ?? '',
      excerpt: data.excerpt ?? '',
      content: data.content ?? '',
      slug: data.slug ?? slugify(data.title ?? '', { lower: true, strict: true, trim: true }),
      imageUrl: data.imageUrl ?? '',
      imageCredit: data.imageCredit ?? null,
      sources: Array.isArray(data.sources) ? data.sources : [],
      releaseAt: data.releaseAt ? toDateTimeLocal(new Date(data.releaseAt)) : null,
      savedAmount: 0,
      savedTimeMinutes: 0,
      aiInvolvement: 'NONE',
    })
    toast.success({ message: t('common.messages.successGeneral') })
  } catch {
    toast.error({ message: t('common.error') })
  } finally {
    input.value = ''
  }
}

const publishLabel = computed(() => t(`articles.${publishAction(editedArticle.value, isNew)}`))

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  editedArticle.value.imageUrl = file.url
  // The author's own picture inherits neither the previous cover's AI label nor its attribution.
  editedArticle.value.imageCredit = null
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

// Only `applyAiFinal` fills the remaining slots, so whenever the stream ends without one the body
// keeps whatever the model wrote — including a literal `[[POLL1]]` the author then has to delete by
// hand, or ships. Same rule as the server's: a marker with nothing to fill it is dropped.
const settleAiSlots = () => {
  editedArticle.value.content = stripContentSlots(editedArticle.value.content ?? '')
}

// The payload carries citations and effort metrics the editor has no other way to obtain —
// dropping them here shipped AI articles with no sources and a zeroed AI disclosure.
const applyAiFinal = (generated: Record<string, any>) => {
  optimizedImageUrl.value = ''
  Object.assign(editedArticle.value, {
    title: generated.title,
    excerpt: generated.perex,
    content: generated.content,
    imageUrl: generated.articleImageUrl,
    imageCredit: generated.articleImageCredit ?? null,
    sources: generated.sources ?? [],
    answer: generated.answer ?? null,
    keyTakeaways: generated.keyTakeaways ?? [],
    faq: generated.faq ?? [],
    savedAmount: generated.metrics?.savedAmount ?? 0,
    savedTimeMinutes: generated.metrics?.savedTimeMinutes ?? 0,
    aiInvolvement: generated.aiInvolvement || 'ASSIST',
  })
  // The model picks from the tag list it was given, so these are ids the POST can connect.
  if (generated.tags?.length) articleTags.value = generated.tags
  // There is an article now, so the composer has done its job and stops occupying the top of
  // the page. The chip reopens it if the author wants another pass.
  aiOpen.value = false
}

const submit = async (targetStatus: 'draft' | 'published') => {
  if (submitting.value) return
  if (!editedArticle.value.title)
    return toast.error({ message: t('common.messages.requiredField', [t('common.labels.title')]) })

  const releaseAt = editedArticle.value.releaseAt
    ? new Date(editedArticle.value.releaseAt)
    : null
  const schedulesForLater = targetStatus === 'published' && !!releaseAt && releaseAt.getTime() > Date.now()
  const effectiveStatus = schedulesForLater ? 'draft' : targetStatus

  const payload = {
    ...editedArticle.value,
    status: effectiveStatus,
    imageUrl: optimizedImageUrl.value || editedArticle.value.imageUrl,
    articleSeriesId: selectedSeries.value?.id || null,
    tags: articleTags.value,
    releaseAt,
  }

  submitting.value = true
  try {
    if (isNew) {
      const created = await $fetch<{ slug: string }>('/api/articles', { method: 'POST', body: payload })
      toast.success({ message: t('articles.editor.createSuccess') })
      await invalidateArticlesAndStats()
      // The route param is the slug, and changing it remounts the page (Nuxt's default page key
      // interpolates params) — which is what we want exactly once: `useArticleTranslations` bakes
      // the article id into its fetch URL at construction, so it has to be rebuilt against the
      // saved article before the language tabs mean anything.
      await router.replace(localePath({ name: 'admin-editor-id', params: { id: created.slug } }))
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.success({ message: t('common.messages.saveSuccess') })
      await invalidateArticles()
      // Stay in the document. Re-baseline the two fields `hasChanges` compares, or leaving would
      // prompt to discard work that is already saved.
      article.value = { ...article.value!, title: payload.title, content: payload.content }
      editedArticle.value.status = effectiveStatus
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || t('common.messages.saveFailed') })
  } finally {
    submitting.value = false
  }
}

const hasChanges = computed(() => {
  // A rewritten translation is unsaved work too — leaving would drop it just as silently.
  if (tr.isDirty) return true
  if (isNew) return !isBlank.value
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
