<template>
  <div class="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-12 pt-6">
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
          icon="mdi:arrow-left"
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
        </div>
      </div>

      <div class="flex w-full items-center gap-2 overflow-x-auto md:ml-auto md:w-auto md:overflow-visible">
        <ArticleEditorLanguageTabs
          v-if="isNew || tr.enabled"
          v-model="editorLanguageModel"
          class="shrink-0"
          :primaryLanguage="primaryLanguage"
          :targetLanguages="editorTargetLanguages"
          :byLanguage="tr.byLanguage"
          :sourceValue="isNew ? primaryLanguage : ''"
          :disabled="aiGenerating"
        />
        <div v-if="autosaveVisible" class="hidden md:flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
          <UIcon :name="saveStatusIcon" size="16" class="transition duration-300" :class="saveStatusClass" />
          <template v-if="saving">{{ $t('common.messages.savingNow') }}</template>
          <template v-else-if="lastSavedAt">
            {{ $t('common.messages.savedAgo') }}&nbsp;<AppTime :datetime="lastSavedAt" preset="relative" />
          </template>
          <template v-else>{{ $t('common.messages.unsaved') }}</template>
        </div>

        <UButton
          v-if="isNew && drafts?.length"
          icon="mdi:file-document-outline"
          color="neutral"
          variant="soft"
          class="shrink-0"
          @click="draftsOpen = true"
        >
          {{ $t('articles.editor.drafts.loadDrafts') }}
        </UButton>

        <UButton
          v-if="livePath"
          :to="livePath"
          target="_blank"
          icon="mdi:open-in-new"
          color="neutral"
          variant="ghost"
          :aria-label="$t('common.actions.view')"
        />
        <UButton
          icon="mdi:eye-outline"
          color="neutral"
          variant="ghost"
          :aria-label="$t('articles.editor.preview.title')"
          @click="previewing = true"
        />

        <UButton
          icon="mdi:cog"
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
          :disabled="submitting || aiGenerating"
          @click="submit('draft')"
        >
          {{ isNew ? $t('articles.saveAsDraft') : $t('articles.saveChanges') }}
        </UButton>

        <UButton
          v-if="tr.isSource"
          :disabled="submitting || aiGenerating"
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

    <UAlert
      v-if="successMessage"
      class="mb-4"
      color="success"
      variant="soft"
      icon="mdi:check-circle"
      :title="successMessage"
    />

    <UProgress v-if="!isNew && tr.status === 'pending'" class="mb-6" :aria-label="$t('common.loading')" />

    <UAlert
      v-if="recoverableGeneration"
      class="mb-6"
      color="warning"
      variant="soft"
      icon="mdi:history"
      :title="$t('articles.editor.ai.recoveryTitle')"
      :description="$t('articles.editor.ai.recoveryDescription')"
    >
      <template #actions>
        <UButton size="sm" color="warning" @click="restoreGeneration">{{
          $t('articles.editor.ai.restoreGeneration')
        }}</UButton>
        <UButton size="sm" color="neutral" variant="ghost" @click="dismissGeneration">{{
          $t('articles.editor.ai.dismissGeneration')
        }}</UButton>
      </template>
    </UAlert>

    <div
      v-if="!isNew && tr.enabled && !tr.isSource"
      class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"
    >
      <div v-if="!tr.isSource" class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="!tr.hasBody"
          icon="mdi:translate"
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
            icon="mdi:content-save-outline"
            :loading="tr.pending === 'save'"
            :disabled="Boolean(tr.pending) || !tr.isDirty"
            @click="tr.save()"
          >
            {{ $t('common.actions.saveChanges') }}
          </UButton>
          <UButton
            icon="mdi:check-circle-outline"
            :loading="tr.pending === 'publish'"
            :disabled="Boolean(tr.pending)"
            @click="tr.save('PUBLISHED')"
          >
            {{ $t('articles.translations.actions.approve') }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            icon="mdi:translate"
            :loading="tr.pending === 'translate'"
            :disabled="Boolean(tr.pending) || tr.isDirty"
            @click="tr.translateNow()"
          >
            {{ $t('articles.translations.actions.retranslate') }}
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            icon="mdi:delete-outline"
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
      icon="mdi:translate"
      :title="$t(`articles.translations.status.${tr.active?.status ?? 'MISSING'}`)"
      :description="$t(`articles.translations.empty.${tr.active?.status ?? 'MISSING'}`)"
    />

    <UAlert
      v-if="!isNew && tr.error"
      class="mb-6"
      color="error"
      icon="mdi:alert-circle-outline"
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
      :class="settingsExpanded ? 'lg:grid-cols-[minmax(0,1fr)_30rem]' : 'lg:grid-cols-[minmax(0,1fr)_3rem]'"
    >
      <div
        class="min-w-0 flex flex-col gap-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-10rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-2"
      >
        <ArticleEditorGenerationRun
          v-if="aiRun"
          ref="generationRun"
          :run="aiRun"
          :words="aiWordCount"
          :authorName="clientStatus?.aiUser?.username"
          @stop="requestStopGeneration"
          @retry="generateAIContent"
          @dismiss="aiRun = null"
        />
        <div ref="titleTarget" class="rounded-(--topiqu-surface-radius) transition-shadow">
          <UFormField :label="$t('common.labels.articleTitle')">
            <UInput v-model="titleModel" :placeholder="$t('common.labels.articleTitle')" class="w-full" />
          </UFormField>
        </div>
        <UFormField
          v-if="tr.isSource"
          :label="$t('articles.editor.slug.label')"
          :help="slugRedirected ? $t('articles.editor.slug.redirectNote') : undefined"
        >
          <UFieldGroup class="w-full">
            <UBadge color="neutral" variant="outline" size="lg" :label="slugPrefix" />
            <UInput
              v-model="slugModel"
              class="w-full"
              :placeholder="$t('articles.editor.slug.placeholder')"
              @blur="normalizeSlug"
            />
          </UFieldGroup>
        </UFormField>
        <div ref="excerptTarget" class="rounded-(--topiqu-surface-radius) transition-shadow">
          <UFormField :label="$t('common.labels.articleExcerpt')">
            <UTextarea
              :modelValue="excerptModel ?? undefined"
              :placeholder="$t('common.labels.articleExcerpt')"
              class="w-full"
              autoresize
              @update:modelValue="excerptModel = $event || null"
            />
          </UFormField>
        </div>

        <ArticleSummary :answer="editedArticle.answer" :takeaways="editedArticle.keyTakeaways ?? []" />

        <div ref="contentTarget" class="mt-4 min-w-0 max-w-full">
          <TiptapEditor
            ref="tiptapEditor"
            v-model="bodyModel"
            :edit="bodyEditable && !aiGenerating"
            class="min-h-[500px]"
          />

          <ArticleFaq :entries="readFaq(editedArticle.faq)" />
        </div>
      </div>
      <aside class="sticky top-20 hidden self-start lg:block">
        <div v-if="settingsExpanded" class="rounded-(--topiqu-surface-radius) border border-default bg-default p-5">
          <div class="mb-5 flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">{{ $t('articles.editor.settingsTitle') }}</h2>
            <UButton
              icon="mdi:chevron-right"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('common.actions.collapse')"
              @click="settingsExpanded = false"
            />
          </div>
          <ArticleEditorSettingsPanel
            ref="desktopSettingsPanel"
            v-model:selectedSeries="selectedSeries"
            v-model:customPrompt="customPrompt"
            v-model:aiOptions="aiOptions"
            v-model:releaseAt="releaseAtInput"
            v-model:sources="sourcesModel"
            v-model:aiOpen="aiOpen"
            :article="article"
            :imageUrl="editedArticle.imageUrl"
            :articleTags="articleTags"
            :aiGenerating="aiGenerating"
            :aiAuthorName="clientStatus?.aiUser?.username"
            :optimizationState="aiGenerating ? 'analyzing' : optimizationState"
            :optimizationResult="aiGenerating ? null : optimizationResult"
            :factCheckState="factCheckState"
            :factCheckResult="factCheckResult"
            :factCheckCanRun="factCheckCanRun"
            :factCheckErrorKind="factCheckErrorKind"
            :mediaRightsState="mediaRightsState"
            :mediaRightsResult="mediaRightsResult"
            @upload="handleUpload"
            @generate="generateAIContent"
            @stop="requestStopGeneration"
            @addTag="addTag"
            @removeTag="removeTag"
            @quickRelease="setReleaseQuick"
            @retryOptimization="retryOptimization"
            @navigateOptimization="navigateOptimization"
            @runFactCheck="runFactCheck"
            @navigateFactCheck="navigateFactCheck"
            @navigateFactCheckSources="navigateFactCheckSources"
            @navigateMedia="navigateMedia"
            @attachMedia="attachMedia"
            @refreshMediaRights="refreshMediaRights"
          />
        </div>
        <UButton
          v-else
          icon="mdi:cog-outline"
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
          <UButton color="error" icon="mdi:delete-outline" @click="discardTranslation">
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

    <UModal
      v-model:open="previewing"
      fullscreen
      :title="$t('articles.editor.preview.title')"
      :ui="{ body: 'p-0 sm:p-0 overflow-hidden' }"
    >
      <template #body>
        <LazyArticleEditorPreview
          :articleId="editedArticle.id"
          :title="titleModel"
          :excerpt="excerptModel"
          :answer="editedArticle.answer"
          :takeaways="editedArticle.keyTakeaways ?? []"
          :faq="editedArticle.faq"
          :content="bodyModel"
          :imageUrl="editedArticle.imageUrl"
          :imageCredit="previewImageCredit"
          :author="previewAuthor"
          :aiInvolvement="editedArticle.aiInvolvement"
          :tags="articleTags"
          :sources="editedArticle.sources"
          :series="previewSeries"
        />
      </template>
    </UModal>

    <USlideover v-model:open="sidebarOpen" :title="$t('articles.editor.settingsTitle')" class="lg:hidden">
      <template #body>
        <ArticleEditorSettingsPanel
          ref="mobileSettingsPanel"
          v-model:selectedSeries="selectedSeries"
          v-model:customPrompt="customPrompt"
          v-model:aiOptions="aiOptions"
          v-model:releaseAt="releaseAtInput"
          v-model:sources="sourcesModel"
          v-model:aiOpen="aiOpen"
          :article="article"
          :imageUrl="editedArticle.imageUrl"
          :articleTags="articleTags"
          :aiGenerating="aiGenerating"
          :aiAuthorName="clientStatus?.aiUser?.username"
          :optimizationState="aiGenerating ? 'analyzing' : optimizationState"
          :optimizationResult="aiGenerating ? null : optimizationResult"
          :factCheckState="factCheckState"
          :factCheckResult="factCheckResult"
          :factCheckCanRun="factCheckCanRun"
          :factCheckErrorKind="factCheckErrorKind"
          :mediaRightsState="mediaRightsState"
          :mediaRightsResult="mediaRightsResult"
          @upload="handleUpload"
          @generate="generateAIContent"
          @stop="requestStopGeneration"
          @addTag="addTag"
          @removeTag="removeTag"
          @quickRelease="setReleaseQuick"
          @retryOptimization="retryOptimization"
          @navigateOptimization="navigateOptimization"
          @runFactCheck="runFactCheck"
          @navigateFactCheck="navigateFactCheck"
          @navigateFactCheckSources="navigateFactCheckSources"
          @navigateMedia="navigateMedia"
          @attachMedia="attachMedia"
          @refreshMediaRights="refreshMediaRights"
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
          <UButton color="error" size="sm" icon="mdi:trash-can-outline" @click="confirmDiscard">
            {{ $t('common.messages.discardConfirm') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="mediaPublishReviewOpen"
      :title="$t('articles.editor.mediaRights.publishTitle')"
      :description="
        $t('articles.editor.mediaRights.publishDescription', {
          count: pendingMediaReport?.counts.needsAttention ?? 0,
        })
      "
    >
      <template #body>
        <ul class="space-y-2">
          <li
            v-for="item in pendingMediaReport?.items.filter((entry) => entry.state === 'needs-attention')"
            :key="item.key"
            class="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3"
          >
            <AppMedia :src="item.url" alt="" containerClass="size-14 shrink-0 rounded-md" aspectRatio="1 / 1" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ item.asset?.originalFilename || item.url }}
              </p>
              <p class="mt-1 text-xs leading-5 text-muted">
                {{ item.issues.map((issue) => $t(`articles.editor.mediaRights.issue.${issue.code}`)).join(' · ') }}
              </p>
            </div>
          </li>
        </ul>
        <p class="mt-4 text-xs leading-5 text-muted">{{ $t('articles.editor.mediaRights.publishDisclaimer') }}</p>
      </template>
      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" variant="ghost" @click="openMediaRightsPanel">{{
            $t('articles.editor.mediaRights.fixMedia')
          }}</UButton>
          <UButton color="warning" :loading="submitting" @click="confirmMediaRightsPublish">{{
            $t('articles.editor.mediaRights.publishAnyway')
          }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { ArticleWithDetails } from '~~/types/article'
import type { CoverCredit } from '~~/shared/utils/imageCredit'
import type { OptimizationTarget } from '~~/shared/types/articleOptimization'
import type { MediaRightsItem, MediaRightsReport, MediaRightsReview } from '~~/shared/types/mediaRights'

import { readFaq } from '~~/shared/utils/articleFaq'
import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { articleSlug } from '~~/shared/utils/articleSlug'
import { setImageMediaId } from '~~/shared/utils/mediaRights'
import { translationDraft } from '~~/shared/utils/articleTranslations'
import {
  type ArticleGenerationBilling,
  type GenerationRun,
  finishGenerationRun,
  reduceGenerationRun,
  startGenerationRun,
  defaultArticleGenerationOptions,
} from '~~/shared/utils/articleGeneration'

import { GenerationStreamError } from '~/composables/useArticleGeneration'

definePageMeta({ middleware: 'admin', shell: 'dashboard', keepalive: { max: 3 } })

const route = useRoute()
const editorPath = route.path
const router = useRouter()
const localePath = useLocalePath()
const toast = useToast()
const confirm = useConfirm()
const { t } = useI18n()
const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()

const { data: clientStatus } = await useClientSiteStatus()
const clientSite = clientStatus
const requestFetch = useRequestFetch()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)
const settingsExpanded = useLocalStorage('topiqu-editor-settings-expanded', true)
const discardConfirmOpen = shallowRef(false)
const submitting = shallowRef(false)
const mediaPublishReviewOpen = shallowRef(false)
const pendingMediaReport = shallowRef<MediaRightsReport | null>(null)
const pendingMediaTarget = shallowRef<'draft' | 'published'>('published')

const article = shallowRef<ArticleWithDetails | undefined>(undefined)
type RecoverableGeneration = {
  id: string
  recoverableSnapshot: {
    title?: string
    perex?: string
    content?: string
    sources?: string[]
    articleImageUrl?: string
    articleImageCredit?: unknown
    articleCoverMediaId?: string
    answer?: string | null
    keyTakeaways?: string[]
    faq?: unknown
    tags?: string[]
    format?: string
    metrics?: { totalWords?: number; savedAmount?: number; savedTimeMinutes?: number }
  }
}
const { data: recoverableGeneration, refresh: refreshRecoverableGeneration } =
  await useLazyFetch<RecoverableGeneration | null>('/api/articles/generations/recoverable', {
    key: `article-generation-recoverable-${String(route.params.id)}`,
    query: computed(() => ({ articleId: isNew ? 'new' : article.value?.id })),
    server: false,
    immediate: isNew,
    watch: false,
    default: () => null,
  })

const init = (): ArticleWithDetails =>
  ({
    title: '',
    excerpt: '',
    content: '',
    slug: '',
    imageUrl: '',
    imageCredit: null,
    coverMediaId: null,
    status: 'draft',
    releaseAt: null,
    sources: [],
    answer: null,
    keyTakeaways: [],
    faq: [],
    savedAmount: 0,
    savedTimeMinutes: 0,
    aiInvolvement: 'NONE',
  }) as unknown as ArticleWithDetails

const editedArticle = ref(init())
const newArticleLanguage = shallowRef<Language>((clientSite.value?.language as Language) ?? 'en')
const newLanguageDrafts = reactive<Record<Language, ReturnType<typeof translationDraft>>>({
  cs: translationDraft(),
  en: translationDraft(),
  de: translationDraft(),
  fr: translationDraft(),
})
const selectedSeries = shallowRef<any>(null)
const articleTags = shallowRef<string[]>([])
const optimizedImageUrl = shallowRef('')
const customPrompt = shallowRef(typeof route.query.prompt === 'string' ? route.query.prompt.slice(0, 5000) : '')
const aiOptions = ref(defaultArticleGenerationOptions())
const aiRun = shallowRef<GenerationRun | null>(null)
const aiGenerating = computed(() => aiRun.value?.status === 'running')
const activeGenerationSessionId = shallowRef<string | null>(null)
const restoredGenerationSessionId = shallowRef<string | null>(null)
const leftDuringGeneration = shallowRef(false)
const backgroundGeneration = useBackgroundArticleGeneration()
onActivated(() => {
  if (aiRun.value && backgroundGeneration.value?.editorPath === editorPath) {
    leftDuringGeneration.value = false
    backgroundGeneration.value = null
  }
})
const syncBackgroundGeneration = () => {
  if (aiRun.value && leftDuringGeneration.value)
    backgroundGeneration.value = {
      editorPath,
      title: editedArticle.value.title || customPrompt.value,
      run: aiRun.value,
    }
}
const setAiRun = (run: GenerationRun) => {
  aiRun.value = run
  syncBackgroundGeneration()
}
watch(
  [() => backgroundGeneration.value?.run.status, () => article.value?.id],
  ([status]) => {
    if (
      status &&
      status !== 'running' &&
      backgroundGeneration.value?.editorPath === editorPath &&
      !aiRun.value &&
      (isNew || article.value?.id)
    )
      void refreshRecoverableGeneration()
  },
  { immediate: true },
)
const aiWordCount = computed(() => {
  const text = (editedArticle.value.content ?? '').replace(/<[^>]*>/g, ' ').trim()
  return text ? text.split(/\s+/).length : 0
})
const { streamGenerate, stop: stopGeneration } = useArticleGeneration()
const stopRequested = shallowRef(false)
let stoppingSessionId: string | null = null
const stopActiveGeneration = async () => {
  const id = activeGenerationSessionId.value
  if (!id || stoppingSessionId === id) return
  stoppingSessionId = id
  try {
    await $fetch(`/api/articles/generations/${id}/stop`, { method: 'POST' })
    stopGeneration()
  } catch {
    stopRequested.value = false
    toast.add({ color: 'error', title: t('articles.editor.ai.stopFailed') })
  } finally {
    stoppingSessionId = null
  }
}
const requestStopGeneration = () => {
  if (!aiGenerating.value || stopRequested.value) return
  stopRequested.value = true
  void stopActiveGeneration()
}
const serializeSourceState = () =>
  articleEditorSnapshot(editedArticle.value, articleTags.value, selectedSeries.value?.id ?? null)
const sourceBaseline = shallowRef(serializeSourceState())

const { idle } = useIdle(5 * 60 * 1000)
const { drafts, loading, draftsOpen, successMessage, lastSavedAt, saving, loadDraft, saveDraftNow } =
  await useArticleDrafts(editedArticle, idle, {
    enabled: isNew,
    paused: aiGenerating,
    language: newArticleLanguage,
    onDraftLoaded: (draft) => {
      if (draft.language) newArticleLanguage.value = draft.language
      selectedSeries.value = null
      articleTags.value = []
    },
  })

if (!isNew) {
  try {
    const data = await requestFetch<any>(`/api/articles/${route.params.id}`, {
      query: { clientSiteId: clientSite.value?.id },
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
    await refreshRecoverableGeneration()
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
const primaryLanguage = computed<Language>(() =>
  isNew ? newArticleLanguage.value : ((article.value?.language ?? clientSite.value?.language ?? 'en') as Language),
)

// `?lang=` lets the admin table deep-link straight to a language. The primary language is the
// source tab, which the composable represents as an empty string. Seeded at construction rather
// than assigned afterwards, so nothing can reconcile it away before the payload lands.
const requestedLang = route.query.lang as string | undefined
const initialLang = !isNew && requestedLang && requestedLang !== primaryLanguage.value ? requestedLang : ''

const tr = reactive(useArticleTranslations(article.value?.id, initialLang))
const discardTranslationOpen = shallowRef(false)
const requestLanguageSwitch = async (language: string) => {
  if (language === tr.activeLang) return
  if (tr.isDirty) {
    const discard = await confirm({
      title: t('articles.translations.unsaved'),
      message: t('common.messages.discardChangesText'),
      confirmText: t('common.messages.discardConfirm'),
      cancelText: t('common.actions.cancel'),
      variant: 'danger',
    })
    if (!discard) return
    tr.draft = translationDraft(tr.active)
  }
  tr.activeLang = language
}
const activeLanguageModel = computed({
  get: () => tr.activeLang,
  set: (language: string) => {
    void requestLanguageSwitch(language)
  },
})
const editorTargetLanguages = computed(() =>
  isNew ? LANGUAGE_OPTIONS.filter((language) => language !== primaryLanguage.value) : tr.targetLanguages,
)
const editorLanguageModel = computed({
  get: () => (isNew ? newArticleLanguage.value : activeLanguageModel.value),
  set: (language: string) => {
    if (aiGenerating.value) return
    if (isNew) {
      newLanguageDrafts[newArticleLanguage.value] = {
        title: editedArticle.value.title ?? '',
        excerpt: editedArticle.value.excerpt ?? '',
        content: editedArticle.value.content ?? '',
      }
      const next = newLanguageDrafts[language as Language]
      editedArticle.value.title = next.title
      editedArticle.value.excerpt = next.excerpt
      editedArticle.value.content = next.content
      newArticleLanguage.value = language as Language
    } else activeLanguageModel.value = language
  },
})

/** Public URL of whichever language is on screen — only once it has a slug to point at. */
const livePath = computed(() => {
  if (isNew || !activeSlug.value) return ''
  const language = (tr.isSource ? primaryLanguage.value : tr.activeLang) as Language
  return publicationUrl(
    clientStatus.value,
    localePath({ name: 'clanky-slug', params: { slug: activeSlug.value } }, language),
  )
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
    if (!import.meta.client) return
    const url = new URL(window.location.href)
    if (language) url.searchParams.set('lang', language)
    else url.searchParams.delete('lang')
    window.history.replaceState(window.history.state, '', url)
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

const optimizationInput = computed(() => ({
  title: titleModel.value ?? '',
  excerpt: excerptModel.value ?? null,
  content: bodyModel.value ?? '',
  imageUrl: editedArticle.value.imageUrl ?? null,
  sources: sourcesModel.value,
  tenantDomain: clientStatus.value?.domain ?? null,
}))
const {
  state: optimizationState,
  result: optimizationResult,
  retry: retryOptimization,
} = useArticleOptimization(optimizationInput)
const factCheckInput = computed(() => ({
  title: titleModel.value ?? '',
  excerpt: excerptModel.value ?? null,
  content: bodyModel.value ?? '',
  sources: sourcesModel.value,
  language: (isNew ? newArticleLanguage.value : tr.isSource ? primaryLanguage.value : tr.activeLang) as Language,
}))
const {
  state: factCheckState,
  result: factCheckResult,
  errorKind: factCheckErrorKind,
  canRun: factCheckCanRun,
  run: runFactCheck,
} = useArticleFactCheck(factCheckInput)
const mediaRightsInput = computed(() => ({
  imageUrl: editedArticle.value.imageUrl ?? null,
  coverMediaId: editedArticle.value.coverMediaId ?? null,
  content: bodyModel.value ?? '',
}))
const {
  state: mediaRightsState,
  result: mediaRightsResult,
  refresh: refreshMediaRights,
} = useMediaRights(mediaRightsInput)
const titleTarget = useTemplateRef<HTMLElement>('titleTarget')
const excerptTarget = useTemplateRef<HTMLElement>('excerptTarget')
const contentTarget = useTemplateRef<HTMLElement>('contentTarget')
const tiptapEditor = useTemplateRef<{ focusBlock: (index?: number) => boolean }>('tiptapEditor')
const desktopSettingsPanel = useTemplateRef<{
  focusOptimizationTarget: (target: OptimizationTarget) => HTMLElement | null
}>('desktopSettingsPanel')
const mobileSettingsPanel = useTemplateRef<{
  focusOptimizationTarget: (target: OptimizationTarget) => HTMLElement | null
}>('mobileSettingsPanel')
let highlightTimer: ReturnType<typeof setTimeout> | undefined
const highlight = (element: HTMLElement | null) => {
  if (!element) return
  element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-default')
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(
    () => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-default'),
    1500,
  )
}
const navigateOptimization = async (target: OptimizationTarget) => {
  const wasMobile = sidebarOpen.value
  if (wasMobile) {
    sidebarOpen.value = false
    await nextTick()
  }
  let element: HTMLElement | null = null
  if (target.kind === 'title') element = titleTarget.value
  else if (target.kind === 'excerpt') element = excerptTarget.value
  else if (target.kind === 'content') {
    element = contentTarget.value
    tiptapEditor.value?.focusBlock(target.blockIndex)
  } else {
    const panel = wasMobile ? mobileSettingsPanel.value : desktopSettingsPanel.value
    element = panel?.focusOptimizationTarget(target) ?? null
  }
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlight(element)
}
const navigateFactCheck = (blockIndex: number) => navigateOptimization({ kind: 'content', blockIndex })
const navigateFactCheckSources = () => navigateOptimization({ kind: 'sources' })
const navigateMedia = (item: MediaRightsItem) =>
  navigateOptimization(
    item.placement === 'cover' ? { kind: 'featured-image' } : { kind: 'content', blockIndex: item.blockIndex },
  )
const attachMedia = (item: MediaRightsItem, mediaId: string) => {
  if (item.placement === 'cover') editedArticle.value.coverMediaId = mediaId
  else bodyModel.value = setImageMediaId(bodyModel.value ?? '', item.url, mediaId)
  void refreshMediaRights()
}

const autosaveVisible = computed(() => isNew && (saving.value || lastSavedAt.value !== null))
const saveConfirmed = shallowRef(false)
const { start: clearSaveConfirmed } = useTimeoutFn(() => (saveConfirmed.value = false), 1400, { immediate: false })
const saveStatusIcon = computed(() =>
  saving.value ? 'mdi:cloud-sync' : saveConfirmed.value ? 'mdi:check-circle' : 'mdi:cloud-check',
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

// A new article's slug follows its title until the author edits it; a saved one never moves by itself.
const slugTouched = shallowRef(false)
const slugModel = computed({
  get: () => editedArticle.value.slug ?? '',
  set: (value: string) => {
    slugTouched.value = true
    editedArticle.value.slug = value
  },
})
const normalizeSlug = () => {
  editedArticle.value.slug = articleSlug(editedArticle.value.slug ?? '') || articleSlug(editedArticle.value.title ?? '')
}
// The public address lives in the article's own language, not the admin UI's.
const slugPrefix = computed(() =>
  localePath({ name: 'clanky-slug', params: { slug: 'x' } }, primaryLanguage.value).replace(/x$/, ''),
)
const slugRedirected = computed(
  () => !isNew && Boolean(article.value?.publishedAt) && editedArticle.value.slug !== article.value?.slug,
)
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

// `Hero.vue` wants the part number, which only the selected series knows. An article not yet in
// the series lands one past the end.
const previewSeries = computed(() => {
  const series = selectedSeries.value
  if (!series?.name) return null
  const ids: string[] = (series.articles ?? []).map((article: { id: string }) => article.id)
  const index = ids.indexOf(editedArticle.value.id)
  if (index >= 0) return { name: series.name, current: index + 1, total: ids.length }

  return { name: series.name, current: ids.length + 1, total: ids.length + 1 }
})

const previewAuthor = computed(() => editedArticle.value.user ?? null)
const previewImageCredit = computed(() => (editedArticle.value.imageCredit as CoverCredit | null) ?? null)

// Expanded while there is nothing to lose, or on the `?ai=1` deep link. Generation rewrites the
// whole article, so a permanently open composer serves no mid-article iteration — it just pushed
// the title below the fold on every visit.
const aiOpen = shallowRef(isBlank.value || route.query.ai === '1' || !!customPrompt.value)

const publishLabel = computed(() => t(`articles.${publishAction(editedArticle.value, isNew)}`))

const handleUpload = (file: { url: string; optimizedUrl: string; mediaAsset?: { id: string } }) => {
  editedArticle.value.imageUrl = file.url
  // The author's own picture inherits neither the previous cover's AI label nor its attribution.
  editedArticle.value.imageCredit = null
  editedArticle.value.coverMediaId = file.mediaAsset?.id ?? null
  optimizedImageUrl.value = file.optimizedUrl
}

const resolveGenerationSession = async (id: string, action: 'restore' | 'dismiss') => {
  await $fetch(`/api/articles/generations/${id}`, { method: 'PATCH', body: { action } })
  recoverableGeneration.value = null
}
const markGenerationSessionsSaved = async () => {
  const ids = new Set([activeGenerationSessionId.value, restoredGenerationSessionId.value].filter((id) => !!id))
  await Promise.allSettled(Array.from(ids, (id) => resolveGenerationSession(id!, 'restore')))
  activeGenerationSessionId.value = null
  restoredGenerationSessionId.value = null
}
const restoreGeneration = async () => {
  const recovery = recoverableGeneration.value
  if (!recovery) return
  const snapshot = recovery.recoverableSnapshot
  Object.assign(editedArticle.value, {
    title: snapshot.title ?? editedArticle.value.title,
    excerpt: snapshot.perex ?? editedArticle.value.excerpt,
    content: snapshot.content ?? editedArticle.value.content,
    sources: snapshot.sources ?? editedArticle.value.sources,
    imageUrl: snapshot.articleImageUrl === undefined ? editedArticle.value.imageUrl : snapshot.articleImageUrl,
    imageCredit:
      snapshot.articleImageCredit === undefined ? editedArticle.value.imageCredit : snapshot.articleImageCredit,
    coverMediaId:
      snapshot.articleCoverMediaId === undefined ? editedArticle.value.coverMediaId : snapshot.articleCoverMediaId,
    answer: snapshot.answer === undefined ? editedArticle.value.answer : snapshot.answer,
    keyTakeaways: snapshot.keyTakeaways ?? editedArticle.value.keyTakeaways,
    faq: snapshot.faq === undefined ? editedArticle.value.faq : snapshot.faq,
    format: snapshot.format ?? editedArticle.value.format,
    aiInvolvement: 'FULL',
    totalWords: snapshot.metrics?.totalWords ?? editedArticle.value.totalWords,
    savedAmount: snapshot.metrics?.savedAmount ?? editedArticle.value.savedAmount,
    savedTimeMinutes: snapshot.metrics?.savedTimeMinutes ?? editedArticle.value.savedTimeMinutes,
  })
  if (snapshot.tags) articleTags.value = snapshot.tags
  restoredGenerationSessionId.value = recovery.id
  recoverableGeneration.value = null
  if (isNew) await saveDraftNow()
}
const dismissGeneration = async () => {
  if (recoverableGeneration.value) await resolveGenerationSession(recoverableGeneration.value.id, 'dismiss')
}

const generationRun = useTemplateRef<ComponentPublicInstance>('generationRun')
const RUN_TOAST_COLOR = { completed: 'success', partial: 'warning', stopped: 'info', failed: 'error' } as const

const generateAIContent = async () => {
  if (aiGenerating.value || backgroundGeneration.value?.run.status === 'running') return
  leftDuringGeneration.value = false
  activeGenerationSessionId.value = null
  stopRequested.value = false
  if (backgroundGeneration.value?.editorPath === editorPath) backgroundGeneration.value = null
  const reservedBefore = clientStatus.value?.articleWallet.reserved ?? 0
  let billing: ArticleGenerationBilling | null = null
  let finalReceived = false
  let streamedContent = ''
  const streamedImages = new Map<number, string>()
  const applyStreamedImages = (content: string) => {
    let resolved = content
    for (const [slot, html] of streamedImages) resolved = replaceSlot(resolved, 'IMAGE', slot, html)
    return resolved
  }
  const presentStreamedContent = () => {
    editedArticle.value.content = stripContentSlots(applyStreamedImages(streamedContent))
  }
  setAiRun(startGenerationRun(aiOptions.value, Date.now()))
  // The run card above the article is the progress view; the preset form only gets in the way.
  aiOpen.value = false
  sidebarOpen.value = false
  void nextTick(() => generationRun.value?.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }))
  try {
    const outcome = await streamGenerate(
      customPrompt.value,
      { ...aiOptions.value, language: primaryLanguage.value },
      {
        onEvent: (event) => {
          if (aiRun.value) setAiRun(reduceGenerationRun(aiRun.value, event, Date.now()))
        },
        onSession: (id) => {
          activeGenerationSessionId.value = id
          if (stopRequested.value) void stopActiveGeneration()
        },
        onPartial: (partial) => {
          if (partial.title != null) editedArticle.value.title = partial.title
          if (partial.perex != null) editedArticle.value.excerpt = partial.perex
          if (partial.sources != null) editedArticle.value.sources = partial.sources
          if (partial.content != null) {
            streamedContent = partial.content
            presentStreamedContent()
          }
          syncBackgroundGeneration()
        },
        onResearch: (research) => (editedArticle.value.sources = research.sources),
        onBilling: (result) => {
          billing = result
          const reserved = Math.max(
            reservedBefore,
            (clientStatus.value?.articleWallet.reserved ?? 0) - (aiRun.value?.reserved ?? 0),
          )
          patchClientSiteArticleWallet({
            available: result.articlesRemaining,
            reserved,
            balance: result.articlesRemaining + reserved,
          })
        },
        onReservation: (articles) => {
          const wallet = clientStatus.value?.articleWallet
          if (wallet)
            patchClientSiteArticleWallet({
              available: Math.max(0, wallet.available - articles),
              reserved: wallet.reserved + articles,
              balance: wallet.balance,
            })
        },
        onImage: ({ slot, html }) => {
          streamedImages.set(slot, html)
          presentStreamedContent()
        },
        onFinal: (article) => {
          finalReceived = true
          Object.assign(editedArticle.value, {
            title: article.title,
            excerpt: article.perex,
            content: article.content,
            imageUrl: article.articleImageUrl,
            imageCredit: article.articleImageCredit ?? null,
            coverMediaId: article.articleCoverMediaId ?? null,
            sources: article.sources ?? [],
            answer: article.answer || null,
            keyTakeaways: article.keyTakeaways ?? [],
            faq: article.faq ?? [],
            format: aiOptions.value.format,
            aiInvolvement: 'FULL',
            totalWords: article.metrics?.totalWords ?? 0,
            savedAmount: article.metrics?.savedAmount ?? 0,
            savedTimeMinutes: article.metrics?.savedTimeMinutes ?? 0,
          })
          articleTags.value = Array.isArray(article.tags) ? article.tags : []
        },
      },
      isNew ? undefined : article.value?.id,
    )
    if (aiRun.value) setAiRun(finishGenerationRun(aiRun.value, outcome, Date.now()))
  } catch (error: any) {
    const failure =
      error instanceof GenerationStreamError
        ? { message: error.message, stage: error.stage, creditReturned: error.creditReturned }
        : { message: error?.message || t('articles.editor.aiContentFailed') }
    if (aiRun.value) setAiRun(finishGenerationRun(aiRun.value, failure, Date.now()))
  } finally {
    if (!finalReceived && streamedContent)
      editedArticle.value.content = stripContentSlots(applyStreamedImages(streamedContent))
    const status = aiRun.value?.status
    if (status && status !== 'running')
      toast.add({ color: RUN_TOAST_COLOR[status], title: t(`articles.editor.ai.run.title.${status}`) })
    if (!leftDuringGeneration.value) retryOptimization()
    if (isNew) await saveDraftNow()
    if (billing) await refreshClientSiteStatus().catch(() => undefined)
    else await refreshClientSiteStatusAfterStop(reservedBefore).catch(() => undefined)
  }
}

const submit = async (targetStatus: 'draft' | 'published', mediaRightsReview?: MediaRightsReview) => {
  if (submitting.value) return
  if (isNew) {
    newLanguageDrafts[newArticleLanguage.value] = {
      title: editedArticle.value.title ?? '',
      excerpt: editedArticle.value.excerpt ?? '',
      content: editedArticle.value.content ?? '',
    }
  }
  const sourceDraft = isNew ? newLanguageDrafts[primaryLanguage.value] : null
  if (!(sourceDraft?.title ?? editedArticle.value.title))
    return toast.add({ color: 'error', title: 'Title is required' })

  const releaseAt = editedArticle.value.releaseAt ? new Date(editedArticle.value.releaseAt) : null
  const schedulesForLater = targetStatus === 'published' && !!releaseAt && releaseAt.getTime() > Date.now()
  const effectiveStatus = schedulesForLater ? 'draft' : targetStatus

  const payload = {
    title: sourceDraft?.title ?? editedArticle.value.title,
    ...(isNew ? { language: primaryLanguage.value } : {}),
    excerpt: sourceDraft?.excerpt ?? editedArticle.value.excerpt,
    content: sourceDraft?.content ?? editedArticle.value.content,
    slug: articleSlug(
      sourceDraft && !slugTouched.value ? sourceDraft.title : editedArticle.value.slug || editedArticle.value.title,
    ),
    status: targetStatus,
    imageUrl: editedArticle.value.imageUrl,
    imageCredit: editedArticle.value.imageCredit,
    coverMediaId: editedArticle.value.coverMediaId,
    aiInvolvement: editedArticle.value.aiInvolvement,
    readingTime: editedArticle.value.readingTime,
    totalWords: editedArticle.value.totalWords,
    savedAmount: editedArticle.value.savedAmount,
    savedTimeMinutes: editedArticle.value.savedTimeMinutes,
    allowedComments: editedArticle.value.allowedComments,
    answer: editedArticle.value.answer,
    keyTakeaways: editedArticle.value.keyTakeaways,
    faq: editedArticle.value.faq,
    format: editedArticle.value.format,
    structureVariant: editedArticle.value.structureVariant,
    prompt: editedArticle.value.prompt,
    articleSeriesId: selectedSeries.value?.id || null,
    ...(isNew ? { tags: articleTags.value } : {}),
    releaseAt,
    sources: (editedArticle.value.sources ?? []).map((source) => source.trim()).filter(Boolean),
    ...(mediaRightsReview ? { mediaRightsReview } : {}),
  }

  submitting.value = true
  try {
    if (isNew) {
      const created = await $fetch<{ id: string; slug: string }>('/api/articles', {
        method: 'POST',
        body: payload,
      })
      const translationResults = await Promise.allSettled(
        (Object.entries(newLanguageDrafts) as [Language, ReturnType<typeof translationDraft>][])
          .filter(([language, draft]) => language !== primaryLanguage.value && draft.title && draft.content)
          .map(([language, draft]) =>
            $fetch(`/api/articles/${created.id}/translations`, {
              method: 'POST',
              body: { language, ...draft },
            }),
          ),
      )
      toast.add({
        color: translationResults.some((result) => result.status === 'rejected') ? 'warning' : 'success',
        title: t(
          translationResults.some((result) => result.status === 'rejected')
            ? 'articles.editor.translationSaveFailedAfterCreate'
            : targetStatus === 'published'
              ? 'articles.editor.articlePublished'
              : 'articles.editor.draftCreated',
        ),
      })
      await invalidateArticlesAndStats()
      await markGenerationSessionsSaved()
      // The route param is the slug, and changing it remounts the page (Nuxt's default page key
      // interpolates params) — which is what we want exactly once: `useArticleTranslations` bakes
      // the article id into its fetch URL at construction, so it has to be rebuilt against the
      // saved article before the language tabs mean anything.
      allowNavigation.value = true
      await router.replace(localePath({ name: 'admin-editor-id', params: { id: created.slug } }))
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, {
        method: 'PATCH',
        body: payload,
      })
      await $fetch(`/api/articles/${article.value!.id}/tags`, {
        method: 'PUT',
        body: { tagIds: articleTags.value },
      })
      toast.add({ color: 'success', title: 'Article updated' })
      await invalidateArticles()
      // Stay in the document. Re-baseline the two fields `hasChanges` compares, or leaving would
      // prompt to discard work that is already saved.
      const slugChanged = payload.slug !== article.value!.slug
      article.value = {
        ...article.value!,
        title: payload.title,
        content: payload.content,
        slug: payload.slug,
      }
      editedArticle.value.slug = payload.slug
      editedArticle.value.status = effectiveStatus
      editedArticle.value.sources = payload.sources
      sourceBaseline.value = serializeSourceState()
      await markGenerationSessionsSaved()
      // The route param is the slug, and the old one now only redirects on the public page.
      if (slugChanged) {
        allowNavigation.value = true
        await router.replace(localePath({ name: 'admin-editor-id', params: { id: payload.slug } }))
      }
    }
  } catch (e: any) {
    const responseData = e?.data?.data ?? e?.data ?? e?.response?._data?.data ?? e?.response?._data
    if (responseData?.code === 'MEDIA_RIGHTS_REVIEW_REQUIRED' && responseData.report) {
      pendingMediaReport.value = responseData.report
      pendingMediaTarget.value = targetStatus
      mediaPublishReviewOpen.value = true
      return
    }
    toast.add({
      color: 'error',
      title: fetchErrorMessage(e, t('common.messages.saveFailed')),
    })
  } finally {
    submitting.value = false
  }
}

const openMediaRightsPanel = () => {
  mediaPublishReviewOpen.value = false
  settingsExpanded.value = true
  if (window.matchMedia('(max-width: 1023px)').matches) sidebarOpen.value = true
}
const confirmMediaRightsPublish = async () => {
  const fingerprint = pendingMediaReport.value?.fingerprint
  if (!fingerprint) return
  mediaPublishReviewOpen.value = false
  await submit(pendingMediaTarget.value, { fingerprint, acknowledged: true })
}

const hasChanges = computed(() => {
  // A rewritten translation is unsaved work too — leaving would drop it just as silently.
  if (tr.isDirty) return true
  return serializeSourceState() !== sourceBaseline.value
})

const allowNavigation = shallowRef(false)
const pendingDestination = shallowRef<string | null>(null)

onBeforeRouteLeave((to) => {
  if (aiGenerating.value) {
    leftDuringGeneration.value = true
    syncBackgroundGeneration()
    return true
  }
  if (allowNavigation.value || !hasChanges.value) return true
  pendingDestination.value = to.fullPath
  discardConfirmOpen.value = true
  return false
})

if (import.meta.client) {
  useEventListener(window, 'beforeunload', (event) => {
    if (aiGenerating.value || !hasChanges.value) return
    event.preventDefault()
  })
}

const goBack = () => {
  if (aiGenerating.value) {
    void router.push(localePath({ name: 'admin' }))
    return
  }
  if (hasChanges.value) {
    pendingDestination.value = localePath({ name: 'admin' })
    discardConfirmOpen.value = true
    return
  }
  router.push(localePath({ name: 'admin' }))
}

const confirmDiscard = async () => {
  const destination = pendingDestination.value ?? localePath({ name: 'admin' })
  allowNavigation.value = true
  discardConfirmOpen.value = false
  await router.push(destination)
}

const discardTranslation = async () => {
  await tr.discard()
  discardTranslationOpen.value = false
}

watch(
  () => editedArticle.value.title,
  (newTitle) => {
    if (isNew && !slugTouched.value) editedArticle.value.slug = articleSlug(newTitle ?? '')
  },
)
</script>
