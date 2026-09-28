<template>
  <div class="flex flex-col gap-6" data-article-settings-panel>
    <ArticleEditorFactCheck
      :state="factCheckState"
      :result="factCheckResult"
      :canRun="factCheckCanRun"
      :errorKind="factCheckErrorKind"
      @run="$emit('runFactCheck')"
      @navigate="$emit('navigateFactCheck', $event)"
      @navigateSources="$emit('navigateFactCheckSources')"
    />

    <USeparator />

    <ArticleEditorMediaRights
      :state="mediaRightsState"
      :result="mediaRightsResult"
      @navigate="$emit('navigateMedia', $event)"
      @attach="(item, mediaId) => $emit('attachMedia', item, mediaId)"
      @updated="$emit('refreshMediaRights')"
    />

    <USeparator />

    <section ref="imageSection" class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
        <UIcon size="16" name="mdi:image-outline" />
        {{ $t('common.labels.image') }}
      </h3>
      <FileUploader
        :imageUrl="imageUrl"
        type="article-image"
        aspectRatio="16 / 9"
        :maxWidth="3840"
        :maxHeight="2160"
        @upload="$emit('upload', $event)"
      />
      <UButton color="neutral" variant="soft" icon="mdi:image-multiple-outline" @click="mediaPickerOpen = true">
        {{ $t('media.choose') }}
      </UButton>
      <MediaPicker v-model:open="mediaPickerOpen" mode="cover" @select="selectCoverMedia" />
    </section>

    <USeparator />

    <section ref="sourcesSection" class="flex flex-col gap-3">
      <ArticleSources ref="sourcesEditor" v-model="sources" />
    </section>

    <USeparator />

    <section class="flex flex-col gap-3">
      <UCollapsible v-model:open="aiOpen">
        <UButton
          color="primary"
          variant="soft"
          size="lg"
          type="button"
          class="w-full"
          :ui="{ trailingIcon: 'ms-auto' }"
          icon="mdi:file-edit-outline"
          :trailingIcon="aiOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          :label="$t('common.labels.aiGeneration')"
        />
        <template #content>
          <div class="mt-3 overflow-hidden rounded-lg border border-primary/30 bg-default shadow-sm">
            <div class="border-b border-primary/20 border-t-4 border-t-primary bg-primary/5 px-4 py-4">
              <p class="text-lg font-semibold text-highlighted">
                {{ $t('articles.editor.ai.createTitle') }}
              </p>
              <p v-if="aiAuthorName" class="mt-1 text-sm leading-5 text-muted">{{ aiAuthorName }}</p>
            </div>

            <div v-if="!aiGenerating" class="flex flex-col gap-5 p-4">
              <UFormField :label="$t('articles.editor.ai.topicLabel')">
                <UTextarea
                  v-model="customPrompt"
                  :placeholder="$t('articles.editor.ai.topicPlaceholder')"
                  :rows="4"
                  class="w-full"
                  autoresize
                />
              </UFormField>

              <UFormField
                :label="$t('articles.editor.ai.outputLabel')"
                :description="$t(`articles.editor.ai.outputDescription.${aiOptions.format}`)"
              >
                <USelect
                  :modelValue="aiOptions.format"
                  :items="formatItems"
                  class="w-full"
                  @update:modelValue="selectFormat"
                />
              </UFormField>

              <div class="border-t border-default pt-5">
                <USwitch
                  v-model="aiOptions.research.enabled"
                  :aria-label="$t('articles.editor.ai.researchLabel')"
                  :label="$t('articles.editor.ai.researchLabel')"
                  :description="$t('articles.editor.ai.researchDescription')"
                  :ui="{ root: 'flex-row-reverse justify-between', wrapper: 'ms-0 me-3' }"
                />
                <div v-if="aiOptions.research.enabled" class="mt-4 flex flex-col gap-4">
                  <fieldset>
                    <legend class="mb-2 text-sm font-medium text-highlighted">
                      {{ $t('articles.editor.ai.depthLabel') }}
                    </legend>
                    <div class="flex rounded-md bg-elevated p-1">
                      <label v-for="depth in depthItems" :key="depth.value" class="relative flex-1 cursor-pointer">
                        <input
                          v-model="aiOptions.research.depth"
                          type="radio"
                          :name="researchDepthName"
                          :value="depth.value"
                          class="peer sr-only"
                        />
                        <span
                          class="flex min-h-10 items-center justify-center rounded text-sm text-muted peer-checked:bg-default peer-checked:font-semibold peer-checked:text-primary peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                          >{{ depth.label }}</span
                        >
                      </label>
                    </div>
                  </fieldset>
                  <UFormField :label="$t('articles.editor.ai.noSourcesLabel')">
                    <USelect v-model="researchFallback" :items="fallbackItems" class="w-full" />
                  </UFormField>
                </div>
              </div>

              <div class="border-t border-default pt-5">
                <!-- Options saved before this switch existed lack the field; they meant "use it". -->
                <USwitch
                  :modelValue="aiOptions.useKnowledge !== false"
                  :aria-label="$t('articles.editor.ai.useKnowledge')"
                  :label="$t('articles.editor.ai.useKnowledge')"
                  :description="$t('articles.editor.ai.useKnowledgeDescription')"
                  :ui="{ root: 'flex-row-reverse justify-between', wrapper: 'ms-0 me-3' }"
                  @update:modelValue="aiOptions.useKnowledge = $event"
                />
              </div>

              <div class="flex flex-col gap-4 border-t border-default pt-5">
                <fieldset>
                  <legend class="mb-3 text-sm font-medium text-highlighted">
                    {{ $t('articles.editor.ai.modulesLabel') }}
                    <span class="ms-2 font-normal text-muted">{{
                      $t('articles.editor.ai.selectedCount', { count: aiOptions.modules.length })
                    }}</span>
                  </legend>
                  <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                    <label
                      v-for="item in contentModuleItems"
                      :key="item.value"
                      class="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      :class="
                        item.disabled
                          ? 'cursor-not-allowed border-default bg-elevated text-muted'
                          : aiOptions.modules.includes(item.value)
                            ? 'cursor-pointer border-primary/60 bg-primary/10 font-medium text-highlighted'
                            : 'cursor-pointer border-default text-highlighted hover:border-primary/50 hover:bg-elevated'
                      "
                    >
                      <input
                        v-model="aiOptions.modules"
                        type="checkbox"
                        :value="item.value"
                        :disabled="item.disabled"
                        class="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span
                        >{{ item.label
                        }}<span v-if="item.disabled" class="mt-0.5 block text-xs font-normal">{{
                          $t('articles.editor.ai.moduleUnavailable')
                        }}</span></span
                      >
                    </label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend class="mb-1 text-sm font-medium text-highlighted">
                    {{ $t('articles.editor.ai.mediaLabel') }}
                  </legend>
                  <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                    <label
                      v-for="item in mediaModuleItems"
                      :key="item.value"
                      class="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      :class="
                        item.disabled
                          ? 'cursor-not-allowed border-default bg-elevated text-muted'
                          : aiOptions.modules.includes(item.value)
                            ? 'cursor-pointer border-primary/60 bg-primary/10 font-medium text-highlighted'
                            : 'cursor-pointer border-default text-highlighted hover:border-primary/50 hover:bg-elevated'
                      "
                    >
                      <input
                        v-model="aiOptions.modules"
                        type="checkbox"
                        :value="item.value"
                        :disabled="item.disabled"
                        class="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      />
                      <span
                        >{{ item.label
                        }}<span v-if="item.disabled" class="mt-0.5 block text-xs font-normal">{{
                          $t('articles.editor.ai.moduleUnavailable')
                        }}</span></span
                      >
                    </label>
                  </div>
                  <UCheckbox
                    v-if="aiOptions.modules.includes('images')"
                    v-model="aiOptions.allowGeneratedImages"
                    :aria-label="$t('articles.editor.ai.allowGeneratedImages')"
                    :label="$t('articles.editor.ai.allowGeneratedImages')"
                    :description="$t('articles.editor.ai.generatedImagesFallback')"
                    class="mt-3"
                  />
                  <p v-if="aiOptions.modules.includes('youtube')" class="mt-1 text-sm leading-5 text-muted">
                    {{ $t('articles.editor.ai.youtubeHint') }}
                  </p>
                </fieldset>
              </div>

              <div class="-mx-4 -mb-4 flex flex-col gap-3 border-t border-primary/20 bg-elevated/60 p-4">
                <div class="text-sm leading-5" aria-live="polite">
                  <p class="font-medium text-highlighted">{{ planSummary }}</p>
                  <p class="mt-1 text-muted">{{ selectedModuleSummary }}</p>
                </div>
                <UButton block size="lg" :disabled="!customPrompt.trim()" @click="$emit('generate')">
                  {{ $t('articles.editor.ai.generateButton') }}
                </UButton>
                <div class="text-xs leading-5 text-muted">
                  <details>
                    <summary
                      class="w-fit cursor-pointer rounded underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {{ $t('articles.editor.ai.reservationLabel') }}
                    </summary>
                    <p class="mt-1">{{ $t('articles.editor.ai.reservationSummary') }}</p>
                    <p class="mt-1">{{ $t('articles.editor.ai.billingExplanation') }}</p>
                  </details>
                </div>
              </div>
            </div>

            <p v-else class="flex items-start gap-2 p-4 text-sm leading-5 text-muted">
              <UIcon name="mdi:arrow-left-top" size="18" class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              {{ $t('articles.editor.ai.run.sidebarNote') }}
            </p>
          </div>
        </template>
      </UCollapsible>
    </section>

    <USeparator />

    <section class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
        <UIcon size="16" name="mdi:bookmark-multiple-outline" />
        {{ $t('common.labels.series') }}
      </h3>
      <ArticleSeriesSelector v-model="selectedSeries" />
    </section>

    <USeparator />

    <section class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
        <UIcon size="16" name="mdi:tag-multiple-outline" />
        {{ $t('common.labels.tags') }}
      </h3>
      <TagsManager
        :article="article"
        :initialTags="articleTags"
        @add:tag="$emit('addTag', $event)"
        @create:tag="$emit('addTag', $event)"
        @delete:tag="$emit('removeTag', $event)"
      />
    </section>

    <USeparator />

    <section class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
        <UIcon size="16" name="mdi:calendar-clock" />
        {{ $t('common.labels.releaseDate') }}
      </h3>
      <UFormField :label="$t('common.labels.releaseDate')" :ui="{ label: 'sr-only' }">
        <AppDateInput :modelValue="releaseAt" time @update:modelValue="releaseAt = $event || null" />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="kind in quickReleaseKinds"
          :key="kind"
          size="sm"
          color="neutral"
          variant="soft"
          @click="$emit('quickRelease', kind)"
        >
          {{ $t(`articles.releaseQuick.${kind}`) }}
        </UButton>
        <UButton
          v-if="releaseAt"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="mdi:close"
          @click="$emit('quickRelease', 'clear')"
        >
          {{ $t('articles.releaseQuick.clear') }}
        </UButton>
      </div>
    </section>

    <USeparator />

    <ArticleEditorOptimization
      :state="optimizationState"
      :result="optimizationResult"
      @retry="$emit('retryOptimization')"
      @navigate="$emit('navigateOptimization', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleFactCheckResult } from '~~/shared/types/articleFactCheck'
import type { MediaRightsItem, MediaRightsReport } from '~~/shared/types/mediaRights'
import type { ArticleOptimizationResult, OptimizationTarget } from '~~/shared/types/articleOptimization'

import {
  ARTICLE_GENERATION_FORMATS,
  ARTICLE_GENERATION_MODULES,
  ARTICLE_GENERATION_ALLOWED_MODULES,
  RESEARCH_DEPTHS,
  type ArticleGenerationFormat,
  type ArticleGenerationOptions,
  type ArticleGenerationModule,
} from '~~/shared/utils/articleGeneration'

import type { MediaRightsState } from '~/composables/useMediaRights'
import type { ArticleOptimizationState } from '~/composables/useArticleOptimization'
import type { ArticleFactCheckErrorKind, ArticleFactCheckState } from '~/composables/useArticleFactCheck'
defineProps<{
  article?: ArticleWithDetails
  imageUrl?: string | null
  articleTags: string[]
  aiGenerating: boolean
  aiAuthorName?: string | null
  optimizationState: ArticleOptimizationState
  optimizationResult: ArticleOptimizationResult | null
  factCheckState: ArticleFactCheckState
  factCheckResult: ArticleFactCheckResult | null
  factCheckCanRun: boolean
  factCheckErrorKind: ArticleFactCheckErrorKind
  mediaRightsState: MediaRightsState
  mediaRightsResult: MediaRightsReport | null
}>()

const imageSection = useTemplateRef<HTMLElement>('imageSection')
const mediaPickerOpen = shallowRef(false)
const selectCoverMedia = (asset: import('~~/shared/types/mediaLibrary').MediaPickerSelection) => {
  emit('upload', { url: asset.url, optimizedUrl: asset.deliveryUrl || asset.url, mediaAsset: { id: asset.id } })
}
const sourcesSection = useTemplateRef<HTMLElement>('sourcesSection')
const sourcesEditor = useTemplateRef<{ focusSource: (index?: number) => HTMLElement | null }>('sourcesEditor')
const focusOptimizationTarget = (target: OptimizationTarget) => {
  const element =
    target.kind === 'featured-image'
      ? imageSection.value
      : target.kind === 'sources'
        ? (sourcesEditor.value?.focusSource(target.blockIndex) ?? sourcesSection.value)
        : null
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return element
}
defineExpose({ focusOptimizationTarget })

const selectedSeries = defineModel<unknown>('selectedSeries')
const customPrompt = defineModel<string>('customPrompt', { required: true })
const aiOptions = defineModel<ArticleGenerationOptions>('aiOptions', { required: true })
const releaseAt = defineModel<string | null>('releaseAt', { required: true })
const sources = defineModel<string[]>('sources', { required: true })
const aiOpen = defineModel<boolean>('aiOpen', { required: true })
const quickReleaseKinds = ['now', 'inHour', 'tomorrow'] as const
const formats = ARTICLE_GENERATION_FORMATS
const modules = ARTICLE_GENERATION_MODULES
const depths = RESEARCH_DEPTHS
const { t } = useI18n()
const researchDepthName = useId()

const allowedModules = computed(() => ARTICLE_GENERATION_ALLOWED_MODULES[aiOptions.value.format])
const formatItems = computed(() =>
  formats.map((value) => ({
    value,
    label: t(`articles.editor.ai.output.${value}`),
    description: t(`articles.editor.ai.outputDescription.${value}`),
  })),
)
const depthItems = computed(() => depths.map((value) => ({ value, label: t(`articles.editor.ai.depth.${value}`) })))
const moduleItems = computed(() =>
  modules
    .filter((value) => allowedModules.value.includes(value))
    .map((value) => ({
      value,
      label: t(`articles.editor.ai.module.${value}`),
      disabled: false,
    })),
)
const contentModuleItems = computed(() =>
  moduleItems.value.filter((item) => !['images', 'youtube'].includes(item.value)),
)
const mediaModuleItems = computed(() => moduleItems.value.filter((item) => ['images', 'youtube'].includes(item.value)))
const selectedModuleSummary = computed(() =>
  aiOptions.value.modules.length
    ? aiOptions.value.modules.map(moduleLabel).join(' · ')
    : t('articles.editor.ai.noModules'),
)
const researchFallback = computed({
  get: () => (aiOptions.value.research.fallbackWithoutResearch ? 'continue' : 'stop'),
  set: (value: string) => {
    aiOptions.value.research.fallbackWithoutResearch = value === 'continue'
  },
})
const fallbackItems = computed(() => [
  { value: 'stop', label: t('articles.editor.ai.noSourcesStop') },
  { value: 'continue', label: t('articles.editor.ai.researchFallback') },
])
const planSummary = computed(() =>
  t('articles.editor.ai.outputSummary', {
    format: t(`articles.editor.ai.output.${aiOptions.value.format}`),
    research: aiOptions.value.research.enabled
      ? t(`articles.editor.ai.depth.${aiOptions.value.research.depth}`)
      : t('articles.editor.ai.researchOff'),
    modules: aiOptions.value.modules.length,
  }),
)
const moduleLabel = (module: ArticleGenerationModule) => t(`articles.editor.ai.module.${module}`)
const selectFormat = (format: ArticleGenerationFormat) => {
  aiOptions.value.format = format
  aiOptions.value.modules = aiOptions.value.modules.filter((module) =>
    ARTICLE_GENERATION_ALLOWED_MODULES[format].includes(module),
  )
}

const emit = defineEmits<{
  upload: [file: { url: string; optimizedUrl: string; mediaAsset?: { id: string } }]
  generate: []
  stop: []
  addTag: [id: string]
  removeTag: [id: string]
  quickRelease: [kind: 'now' | 'inHour' | 'tomorrow' | 'clear']
  retryOptimization: []
  navigateOptimization: [target: import('~~/shared/types/articleOptimization').OptimizationTarget]
  runFactCheck: []
  navigateFactCheck: [blockIndex: number]
  navigateFactCheckSources: []
  navigateMedia: [item: MediaRightsItem]
  attachMedia: [item: MediaRightsItem, mediaId: string]
  refreshMediaRights: []
}>()
</script>
