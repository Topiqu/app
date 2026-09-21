<template>
  <div class="flex flex-col gap-6" data-article-settings-panel>
    <ArticleEditorOptimization
      :state="optimizationState"
      :result="optimizationResult"
      @retry="$emit('retryOptimization')"
      @navigate="$emit('navigateOptimization', $event)"
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
    </section>

    <USeparator />

    <section ref="sourcesSection" class="flex flex-col gap-3">
      <ArticleSources v-model="sources" />
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
                {{ aiGenerating ? activeHeading : $t('articles.editor.ai.createTitle') }}
              </p>
              <p v-if="aiGenerating || aiAuthorName" class="mt-1 text-sm leading-5 text-muted">
                {{ aiGenerating ? activeDescription : aiAuthorName }}
              </p>
            </div>

            <div v-if="!aiGenerating" class="flex flex-col gap-5 p-4">
              <div
                v-if="aiLastResult"
                class="overflow-hidden rounded-lg border bg-elevated/40"
                :class="resultTone"
                aria-live="polite"
              >
                <div class="flex items-start gap-3 px-4 py-3.5">
                  <span class="mt-0.5 grid size-8 shrink-0 place-items-center text-current">
                    <UIcon :name="resultIcon" size="20" />
                  </span>
                  <div class="min-w-0">
                    <p class="font-semibold text-highlighted">
                      {{ $t(`articles.editor.ai.result.${aiLastResult.status}`) }}
                    </p>
                    <p class="mt-1 text-xs leading-5 text-muted">{{ resultDescription }}</p>
                  </div>
                </div>
                <dl class="grid grid-cols-2 border-t border-default/70">
                  <div
                    v-for="metric in resultMetrics"
                    :key="metric.label"
                    class="px-4 py-2.5 even:border-l even:border-default/70"
                  >
                    <dt class="text-[11px] uppercase tracking-wide text-muted">{{ metric.label }}</dt>
                    <dd class="mt-1 text-sm font-semibold text-highlighted">{{ metric.value }}</dd>
                  </div>
                </dl>
                <div
                  v-if="aiLastResult.missingModules.length"
                  class="border-t border-warning/20 px-4 py-3 text-xs text-warning"
                >
                  {{ $t('articles.editor.ai.result.missing') }}
                  {{ aiLastResult.missingModules.map(moduleLabel).join(', ') }}
                </div>
                <div
                  v-if="aiLastResult.reviewApproved === false"
                  class="border-t border-warning/20 px-4 py-3 text-xs text-warning"
                >
                  {{ $t('articles.editor.ai.result.reviewWarning') }}
                </div>
              </div>

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

            <div v-else class="p-4" aria-live="polite" aria-atomic="false">
              <div class="mb-4 overflow-hidden rounded-md border border-primary/20 bg-primary/5">
                <div class="h-1 bg-primary/10" aria-hidden="true">
                  <div
                    class="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                    :style="{ width: progressWidth }"
                  />
                </div>
                <div class="flex items-start gap-3 px-3 py-3">
                  <span
                    class="relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
                  >
                    <UIcon :name="phaseIcons[aiPhase]" size="18" aria-hidden="true" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-highlighted">{{ phaseDetail }}</p>
                    <template v-if="aiPhase === 'research'">
                      <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {{ $t('articles.editor.ai.researchTarget', { topic: customPrompt }) }}
                      </p>
                      <p class="mt-1 text-xs leading-5 text-muted">{{ $t('articles.editor.ai.researchMethod') }}</p>
                    </template>
                    <p v-else-if="aiPhase === 'writing' && aiWordCount" class="mt-1 text-xs text-muted">
                      {{ $t('articles.editor.ai.wordsWritten', { count: aiWordCount }) }}
                    </p>
                    <p v-if="aiReservedArticles" class="mt-2 text-[11px] tabular-nums text-muted">
                      {{ $t('articles.editor.ai.reservedDuringRun', { count: aiReservedArticles.toLocaleString() }) }}
                    </p>
                  </div>
                </div>
              </div>

              <ol class="flex flex-col gap-0.5">
                <li
                  v-for="(phase, index) in phases"
                  :key="phase"
                  class="grid grid-cols-[1.75rem_1fr_auto] items-start gap-2 rounded-md px-2 py-2.5"
                  :class="aiPhase === phase ? 'bg-elevated' : ''"
                >
                  <span
                    class="grid size-7 place-items-center rounded-full border"
                    :class="
                      phaseState(index) === 'done'
                        ? 'border-success/30 bg-success/10 text-success'
                        : phaseState(index) === 'active'
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-default text-muted'
                    "
                  >
                    <UIcon
                      :name="phaseState(index) === 'done' ? 'mdi:check' : phaseIcons[phase]"
                      size="15"
                      aria-hidden="true"
                    />
                  </span>
                  <span>
                    <span
                      class="block text-sm font-medium"
                      :class="phaseState(index) === 'pending' ? 'text-muted' : 'text-highlighted'"
                    >
                      {{ $t(`articles.editor.ai.step.${phase}`) }}
                    </span>
                    <span v-if="aiPhase === phase" class="mt-0.5 block text-xs leading-5 text-muted">{{
                      phaseDetail
                    }}</span>
                  </span>
                  <span v-if="phaseState(index) === 'done'" class="text-xs text-success">
                    {{ phaseDoneLabel(phase) }}
                  </span>
                </li>
              </ol>

              <div class="mt-3 flex items-center justify-between gap-3 border-t border-default pt-3 text-xs text-muted">
                <span class="inline-flex items-center gap-1.5 tabular-nums">
                  <span class="size-1.5 rounded-full bg-success" />
                  {{ $t('articles.editor.ai.elapsed', { seconds: aiElapsedSeconds }) }}
                </span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="mdi:stop-circle-outline"
                  @click="$emit('stop')"
                >
                  {{ $t('articles.editor.ai.stopButton') }}
                </UButton>
              </div>
              <p v-if="aiLastActivitySeconds >= 20" class="mt-2 text-xs leading-5 text-warning">
                {{ waitingMessage }}
              </p>
            </div>
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
        <UInput
          :modelValue="releaseAt ?? undefined"
          type="datetime-local"
          class="w-full"
          @update:modelValue="releaseAt = $event || null"
        />
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
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleOptimizationResult, OptimizationTargetKind } from '~~/shared/types/articleOptimization'

import {
  ARTICLE_GENERATION_FORMATS,
  ARTICLE_GENERATION_MODULES,
  ARTICLE_GENERATION_ALLOWED_MODULES,
  RESEARCH_DEPTHS,
  type ArticleMediaProgress,
  type ArticleGenerationFormat,
  type ArticleGenerationOptions,
  type ArticleGenerationModule,
  type ArticleGenerationResult,
} from '~~/shared/utils/articleGeneration'

import type { ArticleOptimizationState } from '~/composables/useArticleOptimization'
import type {
  GenerationPhase,
  GenerationResearchResult,
  GenerationWritingStage,
} from '~/composables/useArticleGeneration'

const props = defineProps<{
  article?: ArticleWithDetails
  imageUrl?: string | null
  articleTags: string[]
  aiGenerating: boolean
  aiPhase: GenerationPhase
  aiAuthorName?: string | null
  aiElapsedSeconds: number
  aiLastActivitySeconds: number
  aiWordCount: number
  aiResearch?: GenerationResearchResult | null
  aiMedia?: ArticleMediaProgress | null
  aiReservedArticles?: number | null
  aiLastResult?: ArticleGenerationResult | null
  aiWritingStage: GenerationWritingStage
  optimizationState: ArticleOptimizationState
  optimizationResult: ArticleOptimizationResult | null
}>()

const imageSection = useTemplateRef<HTMLElement>('imageSection')
const sourcesSection = useTemplateRef<HTMLElement>('sourcesSection')
const focusOptimizationTarget = (kind: OptimizationTargetKind) => {
  const element = kind === 'featured-image' ? imageSection.value : kind === 'sources' ? sourcesSection.value : null
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
const phases: GenerationPhase[] = ['research', 'writing', 'images']
const phaseIcons: Record<GenerationPhase, string> = {
  research: 'mdi:magnify-scan',
  writing: 'mdi:text-box-edit-outline',
  images: 'mdi:image-multiple-outline',
}
const { t } = useI18n()
const researchDepthName = useId()

const activeHeading = computed(() => props.aiAuthorName || t('articles.editor.ai.neutralWorking'))
const activeDescription = computed(() =>
  props.aiPhase === 'writing'
    ? t(`articles.editor.ai.writingStage.${props.aiWritingStage}`)
    : t(`articles.editor.ai.phase${props.aiPhase[0]!.toUpperCase()}${props.aiPhase.slice(1)}`),
)
const currentPhaseIndex = computed(() => phases.indexOf(props.aiPhase))
const progressWidth = computed(() => `${((currentPhaseIndex.value + 0.45) / phases.length) * 100}%`)
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
const phaseState = (index: number) =>
  index < currentPhaseIndex.value ? 'done' : index === currentPhaseIndex.value ? 'active' : 'pending'
const phaseDetail = computed(() => {
  if (props.aiPhase === 'research' && props.aiResearch?.status === 'completed')
    return t('articles.editor.ai.researchSources', { count: props.aiResearch.sourceCount })
  if (props.aiPhase === 'writing' && props.aiWritingStage === 'review')
    return t('articles.editor.ai.writingStage.review')
  if (props.aiPhase === 'writing')
    return props.aiWordCount > 0
      ? t('articles.editor.ai.wordsWritten', { count: props.aiWordCount })
      : t(`articles.editor.ai.writingStage.${props.aiWritingStage}`)
  if (props.aiPhase === 'images' && props.aiMedia) {
    if (props.aiMedia.stage === 'cover') return t('articles.editor.ai.mediaCover')
    if (props.aiMedia.stage === 'complete') return t('articles.editor.ai.mediaComplete', { count: props.aiMedia.found })
    return t('articles.editor.ai.mediaProgress', {
      completed: props.aiMedia.completed,
      total: props.aiMedia.total,
      found: props.aiMedia.found,
    })
  }
  return t(`articles.editor.ai.phase${props.aiPhase[0]!.toUpperCase()}${props.aiPhase.slice(1)}`)
})
const waitingMessage = computed(() => {
  if (props.aiPhase === 'writing' && props.aiWritingStage === 'review')
    return t('articles.editor.ai.writingStage.review')
  if (props.aiPhase === 'writing')
    return t('articles.editor.ai.waitingWriting', { seconds: props.aiLastActivitySeconds })
  if (props.aiPhase === 'images') return t('articles.editor.ai.waitingImages')
  return t('articles.editor.ai.waitingResearch')
})
const phaseDoneLabel = (phase: GenerationPhase) => {
  if (phase !== 'research' || !props.aiResearch) return t('articles.editor.ai.done')
  if (props.aiResearch.status === 'completed')
    return t('articles.editor.ai.researchSourceBadge', { count: props.aiResearch.sourceCount })
  return t(`articles.editor.ai.researchStatus.${props.aiResearch.status}`)
}
const planSummary = computed(() =>
  t('articles.editor.ai.outputSummary', {
    format: t(`articles.editor.ai.output.${aiOptions.value.format}`),
    research: aiOptions.value.research.enabled
      ? t(`articles.editor.ai.depth.${aiOptions.value.research.depth}`)
      : t('articles.editor.ai.researchOff'),
    modules: aiOptions.value.modules.length,
  }),
)
const resultIcon = computed(() =>
  props.aiLastResult?.status === 'completed'
    ? 'mdi:check-decagram'
    : props.aiLastResult?.status === 'failed'
      ? 'mdi:alert-circle-outline'
      : 'mdi:progress-alert',
)
const resultTone = computed(() =>
  props.aiLastResult?.status === 'completed'
    ? 'border-success/30 text-success'
    : props.aiLastResult?.status === 'failed'
      ? 'border-error/30 text-error'
      : 'border-warning/30 text-warning',
)
const resultDescription = computed(() => {
  const result = props.aiLastResult
  if (!result) return ''
  return result.missingModules.length
    ? t('articles.editor.ai.result.descriptionPartial', { count: result.missingModules.length })
    : result.reviewApproved === false
      ? t('articles.editor.ai.result.descriptionReview')
      : t('articles.editor.ai.result.descriptionComplete')
})
const resultMetrics = computed(() => {
  const result = props.aiLastResult
  if (!result) return []
  return [
    { label: t('articles.editor.ai.result.words'), value: result.wordCount.toLocaleString() },
    { label: t('articles.editor.ai.result.sources'), value: result.sourceCount.toLocaleString() },
    { label: t('articles.editor.ai.result.media'), value: `${result.mediaFound}/${result.mediaTotal}` },
    { label: t('articles.editor.ai.result.time'), value: `${result.durationSeconds} s` },
  ]
})
const moduleLabel = (module: ArticleGenerationModule) => t(`articles.editor.ai.module.${module}`)
const selectFormat = (format: ArticleGenerationFormat) => {
  aiOptions.value.format = format
  aiOptions.value.modules = aiOptions.value.modules.filter((module) =>
    ARTICLE_GENERATION_ALLOWED_MODULES[format].includes(module),
  )
}

defineEmits<{
  upload: [file: { url: string; optimizedUrl: string }]
  generate: []
  stop: []
  addTag: [id: string]
  removeTag: [id: string]
  quickRelease: [kind: 'now' | 'inHour' | 'tomorrow' | 'clear']
  retryOptimization: []
  navigateOptimization: [target: import('~~/shared/types/articleOptimization').OptimizationTarget]
}>()
</script>
