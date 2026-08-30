<template>
  <div class="flex flex-col gap-6" data-article-settings-panel>
    <section class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-highlighted">
        <UIcon size="16" name="i-mdi-image-outline" />
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

    <section class="flex flex-col gap-3">
      <ArticleSources v-model="sources" />
    </section>

    <USeparator />

    <section class="flex flex-col gap-3">
      <UCollapsible v-model:open="aiOpen">
        <UButton
          color="neutral"
          variant="ghost"
          type="button"
          class="w-full"
          icon="i-mdi-file-edit-outline"
          :trailingIcon="aiOpen ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
          :label="$t('common.labels.aiGeneration')"
        />
        <template #content>
          <div class="mt-3 overflow-hidden rounded-lg border border-default bg-default">
            <div class="border-b border-default px-4 py-3">
              <p class="text-sm font-semibold text-highlighted">
                {{ aiGenerating ? activeHeading : aiAuthorName || $t('articles.editor.ai.neutralAuthor') }}
              </p>
              <p class="mt-0.5 text-xs leading-5 text-muted">
                {{ aiGenerating ? activeDescription : $t('articles.editor.ai.planDescription') }}
              </p>
            </div>

            <div v-if="!aiGenerating" class="flex flex-col gap-5 p-4">
              <UFormField :label="$t('articles.editor.ai.topicLabel')">
                <UTextarea
                  v-model="customPrompt"
                  :placeholder="$t('articles.editor.ai.topicPlaceholder')"
                  class="w-full"
                  autoresize
                />
              </UFormField>

              <fieldset class="flex flex-col gap-2">
                <legend class="mb-1 text-xs font-medium text-muted">{{ $t('articles.editor.ai.outputLabel') }}</legend>
                <UFormField :label="$t('articles.editor.ai.outputLabel')" :ui="{ label: 'sr-only' }">
                  <URadioGroup
                    v-model="aiOptions.format"
                    :items="formatItems"
                    variant="card"
                    @update:modelValue="selectFormat"
                  />
                </UFormField>
              </fieldset>

              <div class="rounded-md border border-default">
                <label class="flex cursor-pointer items-start justify-between gap-3 px-3 py-3">
                  <span>
                    <span class="block text-sm font-medium text-highlighted">{{
                      $t('articles.editor.ai.researchLabel')
                    }}</span>
                    <span class="mt-0.5 block text-xs leading-5 text-muted">{{
                      $t('articles.editor.ai.researchDescription')
                    }}</span>
                  </span>
                  <USwitch
                    v-model="aiOptions.research.enabled"
                    :aria-label="$t('articles.editor.ai.researchLabel')"
                  />
                </label>
                <div v-if="aiOptions.research.enabled" class="border-t border-default px-3 py-3">
                  <p class="mb-2 text-xs font-medium text-muted">{{ $t('articles.editor.ai.depthLabel') }}</p>
                  <UFormField :label="$t('articles.editor.ai.depthLabel')" :ui="{ label: 'sr-only' }">
                    <URadioGroup
                      v-model="aiOptions.research.depth"
                      :items="depthItems"
                      orientation="horizontal"
                    />
                  </UFormField>
                  <UCheckbox
                    v-model="aiOptions.research.fallbackWithoutResearch"
                    :label="$t('articles.editor.ai.researchFallback')"
                    :aria-label="$t('articles.editor.ai.researchFallback')"
                  />
                </div>
              </div>

              <fieldset>
                <legend class="text-xs font-medium text-muted">{{ $t('articles.editor.ai.modulesLabel') }}</legend>
                <p class="mb-2 mt-1 text-xs leading-5 text-muted">{{ $t('articles.editor.ai.modulesDescription') }}</p>
                <UFormField :label="$t('articles.editor.ai.modulesLabel')" :ui="{ label: 'sr-only' }">
                  <UCheckboxGroup v-model="aiOptions.modules" :items="moduleItems" />
                </UFormField>
              </fieldset>

              <div class="border-t border-default pt-4">
                <p class="mb-3 text-xs leading-5 text-muted">{{ planSummary }}</p>
                <UButton block :disabled="!customPrompt.trim()" @click="$emit('generate')">
                  {{ $t('articles.editor.ai.generateButton') }}
                </UButton>
              </div>
            </div>

            <div v-else class="p-4" aria-live="polite">
              <ol class="flex flex-col gap-1">
                <li
                  v-for="(phase, index) in phases"
                  :key="phase"
                  class="grid grid-cols-[1rem_1fr_auto] items-start gap-2 rounded-md px-2 py-2"
                  :class="aiPhase === phase ? 'bg-elevated' : ''"
                >
                  <span
                    class="mt-1 size-2 rounded-full border"
                    :class="
                      phaseState(index) === 'done'
                        ? 'border-success bg-success'
                        : phaseState(index) === 'active'
                          ? 'border-primary bg-primary'
                          : 'border-muted'
                    "
                  />
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
                <span>{{ $t('articles.editor.ai.elapsed', { seconds: aiElapsedSeconds }) }}</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-mdi-stop-circle-outline"
                  @click="$emit('stop')"
                >
                  {{ $t('articles.editor.ai.stopButton') }}
                </UButton>
              </div>
              <p v-if="aiLastActivitySeconds >= 20" class="mt-2 text-xs leading-5 text-warning">
                {{ $t('articles.editor.ai.waiting', { seconds: aiLastActivitySeconds }) }}
              </p>
            </div>
          </div>
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
        @add:tag="$emit('addTag', $event)"
        @create:tag="$emit('addTag', $event)"
        @delete:tag="$emit('removeTag', $event)"
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
          icon="i-mdi-close"
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

import {
  ARTICLE_GENERATION_FORMATS,
  ARTICLE_GENERATION_MODULES,
  ARTICLE_GENERATION_ALLOWED_MODULES,
  RESEARCH_DEPTHS,
  type ArticleGenerationFormat,
  type ArticleGenerationOptions,
} from '~~/shared/utils/articleGeneration'

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
  aiWritingStage: GenerationWritingStage
}>()

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
const { t } = useI18n()

const activeHeading = computed(() => props.aiAuthorName || t('articles.editor.ai.neutralWorking'))
const activeDescription = computed(() =>
  props.aiPhase === 'writing'
    ? t(`articles.editor.ai.writingStage.${props.aiWritingStage}`)
    : t(`articles.editor.ai.phase${props.aiPhase[0]!.toUpperCase()}${props.aiPhase.slice(1)}`),
)
const currentPhaseIndex = computed(() => phases.indexOf(props.aiPhase))
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
  modules.map((value) => ({
    value,
    label: t(`articles.editor.ai.module.${value}`),
    disabled: !allowedModules.value.includes(value),
  })),
)
const phaseState = (index: number) =>
  index < currentPhaseIndex.value ? 'done' : index === currentPhaseIndex.value ? 'active' : 'pending'
const phaseDetail = computed(() => {
  if (props.aiPhase === 'research' && props.aiResearch?.status === 'completed')
    return t('articles.editor.ai.researchSources', { count: props.aiResearch.sourceCount })
  if (props.aiPhase === 'writing')
    return props.aiWordCount > 0
      ? t('articles.editor.ai.wordsWritten', { count: props.aiWordCount })
      : t(`articles.editor.ai.writingStage.${props.aiWritingStage}`)
  return t(`articles.editor.ai.phase${props.aiPhase[0]!.toUpperCase()}${props.aiPhase.slice(1)}`)
})
const phaseDoneLabel = (phase: GenerationPhase) => {
  if (phase !== 'research' || !props.aiResearch) return t('articles.editor.ai.done')
  if (props.aiResearch.status === 'completed')
    return t('articles.editor.ai.researchSourceBadge', { count: props.aiResearch.sourceCount })
  return t(`articles.editor.ai.researchStatus.${props.aiResearch.status}`)
}
const planSummary = computed(() =>
  t('articles.editor.ai.planSummary', {
    format: t(`articles.editor.ai.output.${aiOptions.value.format}`),
    research: aiOptions.value.research.enabled
      ? t(`articles.editor.ai.depth.${aiOptions.value.research.depth}`)
      : t('articles.editor.ai.researchOff'),
    modules: aiOptions.value.modules.length,
  }),
)
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
}>()
</script>
