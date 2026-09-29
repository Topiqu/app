<template>
  <UTabs
    v-model="tab"
    :items="tabs"
    variant="link"
    :unmountOnHide="false"
    class="w-full"
    :ui="{
      root: 'gap-5',
      list: 'sticky top-0 z-10 bg-default',
      trigger: 'flex-1 justify-center',
    }"
    data-article-settings-panel
  >
    <template #list-trailing>
      <slot name="actions" />
    </template>

    <template #article>
      <div class="flex flex-col gap-6">
        <section ref="imageSection" class="flex flex-col gap-3">
          <h3 :class="headingClass">
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

        <section ref="sourcesSection" class="flex flex-col gap-3">
          <h3 :class="headingClass">
            <UIcon size="16" name="mdi:link-variant" />
            {{ $t('articles.columns.sources') }}
          </h3>
          <ArticleSources ref="sourcesEditor" v-model="sources" compact />
        </section>

        <section class="flex flex-col gap-3">
          <h3 :class="headingClass">
            <UIcon size="16" name="mdi:bookmark-multiple-outline" />
            {{ $t('common.labels.series') }}
          </h3>
          <ArticleSeriesSelector v-model="selectedSeries" compact />
        </section>

        <section class="flex flex-col gap-3">
          <h3 :class="headingClass">
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

        <section class="flex flex-col gap-3">
          <h3 :class="headingClass">
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
      </div>
    </template>

    <template #ai>
      <ArticleEditorGenerationForm
        v-if="aiAvailable"
        v-model:customPrompt="customPrompt"
        v-model:aiOptions="aiOptions"
        :aiGenerating="aiGenerating"
        @generate="$emit('generate')"
      />
      <ArticleEditorAiUpsell v-else />
    </template>

    <template #checks>
      <div class="flex flex-col divide-y divide-default">
        <ArticleEditorOptimization
          class="pb-3"
          :state="optimizationState"
          :result="optimizationResult"
          @retry="$emit('retryOptimization')"
          @navigate="$emit('navigateOptimization', $event)"
        />
        <ArticleEditorFactCheck
          class="py-3"
          :state="factCheckState"
          :result="factCheckResult"
          :canRun="factCheckCanRun"
          :errorKind="factCheckErrorKind"
          :locked="!aiAvailable"
          @run="$emit('runFactCheck')"
          @navigate="$emit('navigateFactCheck', $event)"
          @navigateSources="$emit('navigateFactCheckSources')"
        />
        <ArticleEditorMediaRights
          class="pt-3"
          :state="mediaRightsState"
          :result="mediaRightsResult"
          @navigate="$emit('navigateMedia', $event)"
          @attach="(item, mediaId) => $emit('attachMedia', item, mediaId)"
          @updated="$emit('refreshMediaRights')"
        />
      </div>
    </template>
  </UTabs>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ArticleWithDetails } from '~~/types/article'
import type { MediaPickerSelection } from '~~/shared/types/mediaLibrary'
import type { ArticleFactCheckResult } from '~~/shared/types/articleFactCheck'
import type { ArticleGenerationOptions } from '~~/shared/utils/articleGeneration'
import type { MediaRightsItem, MediaRightsReport } from '~~/shared/types/mediaRights'
import type { ArticleOptimizationResult, OptimizationTarget } from '~~/shared/types/articleOptimization'

import { optimizationScoreColor } from '~~/shared/utils/articleOptimization'

import type { MediaRightsState } from '~/composables/useMediaRights'
import type { ArticleOptimizationState } from '~/composables/useArticleOptimization'
import type { ArticleFactCheckErrorKind, ArticleFactCheckState } from '~/composables/useArticleFactCheck'

type SettingsTab = 'article' | 'ai' | 'checks'

const props = defineProps<{
  article?: ArticleWithDetails
  imageUrl?: string | null
  articleTags: string[]
  aiAvailable: boolean
  aiGenerating: boolean
  optimizationState: ArticleOptimizationState
  optimizationResult: ArticleOptimizationResult | null
  factCheckState: ArticleFactCheckState
  factCheckResult: ArticleFactCheckResult | null
  factCheckCanRun: boolean
  factCheckErrorKind: ArticleFactCheckErrorKind
  mediaRightsState: MediaRightsState
  mediaRightsResult: MediaRightsReport | null
}>()

const emit = defineEmits<{
  upload: [file: { url: string; optimizedUrl: string; mediaAsset?: { id: string } }]
  generate: []
  addTag: [id: string]
  removeTag: [id: string]
  quickRelease: [kind: 'now' | 'inHour' | 'tomorrow' | 'clear']
  retryOptimization: []
  navigateOptimization: [target: OptimizationTarget]
  runFactCheck: []
  navigateFactCheck: [blockIndex: number]
  navigateFactCheckSources: []
  navigateMedia: [item: MediaRightsItem]
  attachMedia: [item: MediaRightsItem, mediaId: string]
  refreshMediaRights: []
}>()

const tab = defineModel<SettingsTab>('tab', { required: true })
const selectedSeries = defineModel<unknown>('selectedSeries')
const customPrompt = defineModel<string>('customPrompt', { required: true })
const aiOptions = defineModel<ArticleGenerationOptions>('aiOptions', { required: true })
const releaseAt = defineModel<string | null>('releaseAt', { required: true })
const sources = defineModel<string[]>('sources', { required: true })

const { t } = useI18n()
const headingClass = 'flex items-center gap-2 text-sm font-semibold text-highlighted'
const quickReleaseKinds = ['now', 'inHour', 'tomorrow'] as const

// Media needing attention outranks the score: it is what blocks a clean publish.
const checksBadge = computed(() => {
  const score = props.optimizationResult?.overallScore
  const attention = props.mediaRightsResult?.counts.needsAttention ?? 0
  if (attention) return { label: attention, icon: 'mdi:alert-outline', color: 'warning' as const, variant: 'soft' as const }
  if (score === undefined) return undefined
  return { label: score, color: optimizationScoreColor(score), variant: 'soft' as const }
})
const tabs = computed<TabsItem[]>(() => [
  { value: 'article', slot: 'article', label: t('articles.editor.tabs.article'), icon: 'mdi:file-document-outline' },
  { value: 'ai', slot: 'ai', label: t('articles.editor.tabs.ai'), icon: 'mdi:creation-outline' },
  {
    value: 'checks',
    slot: 'checks',
    label: t('articles.editor.tabs.checks'),
    icon: 'mdi:shield-check-outline',
    badge: checksBadge.value,
  },
])

const mediaPickerOpen = shallowRef(false)
const selectCoverMedia = (asset: MediaPickerSelection) => {
  emit('upload', { url: asset.url, optimizedUrl: asset.deliveryUrl || asset.url, mediaAsset: { id: asset.id } })
}

const imageSection = useTemplateRef<HTMLElement>('imageSection')
const sourcesSection = useTemplateRef<HTMLElement>('sourcesSection')
const sourcesEditor = useTemplateRef<{ focusSource: (index?: number) => HTMLElement | null }>('sourcesEditor')
// Both targets live on the Article tab; a hidden tab has no box to scroll to.
const focusOptimizationTarget = async (target: OptimizationTarget) => {
  if (target.kind !== 'featured-image' && target.kind !== 'sources') return null
  tab.value = 'article'
  await nextTick()
  const element =
    target.kind === 'featured-image'
      ? imageSection.value
      : (sourcesEditor.value?.focusSource(target.blockIndex) ?? sourcesSection.value)
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return element
}
defineExpose({ focusOptimizationTarget })
</script>
