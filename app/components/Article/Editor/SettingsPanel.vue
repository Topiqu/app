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
          icon="i-mdi-sparkles"
          :trailingIcon="aiOpen ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
          :label="$t('common.labels.aiGeneration')"
        />
        <template #content>
          <div class="mt-3 flex flex-col gap-3">
            <UFormField :label="$t('articles.editor.ai.customPromptPlaceholder')">
              <UTextarea
                v-model="customPrompt"
                :placeholder="$t('articles.editor.ai.customPromptPlaceholder')"
                class="w-full"
                autoresize
              />
            </UFormField>
            <UButton v-if="!aiGenerating" icon="i-mdi-lightning-bolt" class="w-full" @click="$emit('generate')">
              {{ $t('articles.editor.ai.generateButton') }}
            </UButton>
            <div v-else class="flex items-center gap-2">
              <span class="min-w-0 flex-1 text-sm text-muted">
                {{
                  aiPhase === 'images' ? $t('articles.editor.ai.phaseImages') : $t('articles.editor.ai.phaseWriting')
                }}
              </span>
              <UProgress class="w-20" />
              <UButton icon="i-mdi-stop" color="error" variant="soft" square @click="$emit('stop')" />
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

defineProps<{
  article?: ArticleWithDetails
  imageUrl?: string | null
  articleTags: string[]
  aiGenerating: boolean
  aiPhase: 'writing' | 'images'
}>()

const selectedSeries = defineModel<unknown>('selectedSeries')
const customPrompt = defineModel<string>('customPrompt', { required: true })
const releaseAt = defineModel<string | null>('releaseAt', { required: true })
const sources = defineModel<string[]>('sources', { required: true })
const aiOpen = defineModel<boolean>('aiOpen', { required: true })
const quickReleaseKinds = ['now', 'inHour', 'tomorrow'] as const

defineEmits<{
  upload: [file: { url: string; optimizedUrl: string }]
  generate: []
  stop: []
  addTag: [id: string]
  removeTag: [id: string]
  quickRelease: [kind: 'now' | 'inHour' | 'tomorrow' | 'clear']
}>()
</script>
