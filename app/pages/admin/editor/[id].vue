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
        <ArticleStatusPill class="hidden sm:inline-flex" :status="editedArticle.status" />
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
            v-model="editedArticle.title"
            :placeholder="$t('common.labels.articleTitle')"
            class="w-full"
            @input="updateSlug"
          />
        </UFormField>
        <UFormField :label="$t('common.labels.articleExcerpt')">
          <UTextarea
            :modelValue="editedArticle.excerpt ?? undefined"
            :placeholder="$t('common.labels.articleExcerpt')"
            class="w-full"
            autoresize
            @update:modelValue="editedArticle.excerpt = $event || null"
          />
        </UFormField>

        <div class="mt-4 max-w-none">
          <TiptapEditor v-model="editedArticle.content" edit class="min-h-[500px]" />

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

    <LazyArticleDrafts
      v-model:open="draftsOpen"
      :drafts="drafts"
      :loading="loading"
      @select="loadDraft"
      @close="draftsOpen = false"
    />

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

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const toast = useToast()
const { t } = useI18n()
const { invalidateArticles, invalidateArticlesAndStats } = useCacheInvalidation()

const isNew = route.params.id === 'new'
const sidebarOpen = shallowRef(false)
const aiOpen = shallowRef(route.query.ai === '1')
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
  editedArticle.value.releaseAt = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16) as any
}

const { streamGenerate, stop: stopGeneration } = useArticleGeneration()
const aiPhase = shallowRef<'writing' | 'images'>('writing')

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

  const willPublishNow = targetStatus === 'published' && !editedArticle.value.releaseAt
  const releaseAt = editedArticle.value.releaseAt
    ? new Date(editedArticle.value.releaseAt)
    : willPublishNow
      ? new Date()
      : null

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
      await $fetch('/api/articles', { method: 'POST', body: payload })
      toast.add({ color: 'success', title: targetStatus === 'published' ? 'Article published' : 'Draft created' })
      await invalidateArticlesAndStats()
    } else {
      await $fetch(`/api/articles/${article.value!.id}`, { method: 'PATCH', body: payload })
      toast.add({ color: 'success', title: 'Article updated' })
      await invalidateArticles()
    }
    router.push(localePath({ name: 'admin' }))
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || 'Error saving article' })
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
