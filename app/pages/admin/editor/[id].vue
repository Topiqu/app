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

      <div class="flex w-full items-center gap-2 overflow-x-auto md:ml-auto md:w-auto md:overflow-visible">
        <div v-if="autosaveVisible" class="hidden md:flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
          <UIcon :name="saving ? 'i-mdi-cloud-sync' : 'i-mdi-cloud-check'" size="16" />
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
          square
          :aria-label="$t('common.settings')"
          :title="$t('common.settings')"
          @click="sidebarOpen = true"
        />

        <UButton
          v-if="isNew || editedArticle.status === 'draft'"
          color="neutral"
          variant="soft"
          class="shrink-0"
          :disabled="submitting"
          @click="submit('draft')"
        >
          {{ isNew ? $t('articles.saveAsDraft') : $t('articles.saveChanges') }}
        </UButton>

        <UButton
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

    <div class="flex-1 w-full">
      <div class="flex flex-col gap-6">
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

        <div class="mt-4 max-w-none">
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
    </div>

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

    <USlideover v-model:open="sidebarOpen" :title="$t('common.settings')">
      <template #body>
        <div class="flex flex-col gap-6">
          <section class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
              <UIcon size="16" name="i-mdi-image-outline" />
              {{ $t('common.labels.image') }}
            </h3>
            <FileUploader
              :imageUrl="editedArticle.imageUrl"
              type="article-image"
              aspectRatio="16 / 9"
              :maxWidth="3840"
              :maxHeight="2160"
              @upload="handleUpload"
            />
          </section>

          <USeparator />

          <section class="flex flex-col gap-3">
            <UCollapsible v-model:open="aiOpen">
              <UButton
                color="neutral"
                variant="ghost"
                type="button"
                class="w-full"
                icon="i-mdi-sparkles"
                :trailingIcon="aiOpen ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
                :label="$t('common.labels.aiGeneration')"
              />
              <template #content>
                <UCard>
                  <div class="flex flex-col gap-3">
                    <UFormField :label="$t('articles.editor.ai.customPromptPlaceholder')">
                      <UTextarea
                        v-model="customPrompt"
                        :placeholder="$t('articles.editor.ai.customPromptPlaceholder')"
                        class="w-full"
                        autoresize
                      />
                    </UFormField>
                    <UButton v-if="!aiGenerating" icon="i-mdi-lightning-bolt" class="w-full" @click="generateAIContent">
                      {{ $t('articles.editor.ai.generateButton') }}
                    </UButton>
                    <div v-else class="flex items-center gap-2">
                      <span class="flex-1 text-sm text-muted">
                        {{
                          aiPhase === 'images'
                            ? $t('articles.editor.ai.phaseImages')
                            : $t('articles.editor.ai.phaseWriting')
                        }}
                      </span>
                      <UProgress class="w-24" />
                      <UButton icon="i-mdi-stop" color="error" variant="solid" @click="stopGeneration">
                        {{ $t('articles.editor.ai.stopButton') }}
                      </UButton>
                    </div>
                  </div>
                </UCard>
              </template>
            </UCollapsible>
          </section>

          <USeparator />

          <section class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
              <UIcon size="16" name="i-mdi-bookmark-multiple-outline" />
              {{ $t('common.labels.series') }}
            </h3>
            <ArticleSeriesSelector v-model="selectedSeries" />
          </section>

          <USeparator />

          <section class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
              <UIcon size="16" name="i-mdi-tag-multiple-outline" />
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

          <USeparator />

          <section class="flex flex-col gap-3">
            <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
              <UIcon size="16" name="i-mdi-calendar-clock" />
              {{ $t('common.labels.releaseDate') }}
            </h3>
            <UFormField :label="$t('common.labels.releaseDate')" :ui="{ label: 'sr-only' }">
              <UInput
                :modelValue="releaseAtInput ?? undefined"
                type="datetime-local"
                @update:modelValue="releaseAtInput = $event || null"
              />
            </UFormField>
            <div class="flex flex-wrap gap-2">
              <UButton size="sm" color="neutral" variant="soft" @click="setReleaseQuick('now')">
                {{ $t('articles.releaseQuick.now') }}
              </UButton>
              <UButton size="sm" color="neutral" variant="soft" @click="setReleaseQuick('inHour')">
                {{ $t('articles.releaseQuick.inHour') }}
              </UButton>
              <UButton size="sm" color="neutral" variant="soft" @click="setReleaseQuick('tomorrow')">
                {{ $t('articles.releaseQuick.tomorrow') }}
              </UButton>
              <UButton
                v-if="editedArticle.releaseAt"
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-mdi-close"
                @click="setReleaseQuick('clear')"
              >
                {{ $t('articles.releaseQuick.clear') }}
              </UButton>
            </div>
          </section>
        </div>
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
import { translationStatusBadge } from '~~/shared/utils/articleTranslations'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const toast = useAppToast()
const { t } = useI18n()
const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()

const clientSite = await useClientSite()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)
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

const autosaveVisible = computed(() => isNew && (saving.value || lastSavedAt.value !== null))

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
      await router.replace(localePath({ name: 'admin-editor-id', params: { id: created.slug } }))
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.add({ color: 'success', title: 'Article updated' })
      await invalidateArticles()
      // Stay in the document. Re-baseline the two fields `hasChanges` compares, or leaving would
      // prompt to discard work that is already saved.
      article.value = { ...article.value!, title: payload.title, content: payload.content }
      editedArticle.value.status = effectiveStatus
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
