<template>
  <section
    class="custom-ui flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-x-6 gap-y-4 p-4 rounded-(--topiqu-surface-radius) border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
    :aria-label="$t('articles.editor.metaBar')"
  >
    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.tags') }}</h2>
      <ArticleEditorTagsField v-model="tags" />
    </div>

    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.series') }}</h2>
      <ArticleSeriesSelector v-model="series" compact />
    </div>

    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('common.labels.releaseDate') }}</h2>
      <ArticleEditorPopover
        :label="$t('common.labels.releaseDate')"
        icon="mdi:calendar-clock"
        size="md"
        :filled="!!releaseAt"
        align="right"
      >
        <template #trigger>{{ releaseLabel }}</template>

        <div class="flex flex-col gap-2 w-60">
          <AppFormField v-model="releaseAtInput" type="datetime-local" />
          <div class="flex flex-wrap gap-1.5">
            <ArticleEditorChip v-for="kind in QUICK_KINDS" :key="kind" @click="setQuick(kind)">
              {{ $t(`articles.releaseQuick.${kind}`) }}
            </ArticleEditorChip>
            <ArticleEditorChip v-if="releaseAt" icon="mdi:close" @click="setQuick('clear')">
              {{ $t('articles.releaseQuick.clear') }}
            </ArticleEditorChip>
          </div>
          <p class="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            {{ $t('articles.editor.releaseDateNote') }}
          </p>
        </div>
      </ArticleEditorPopover>
    </div>

    <div class="flex flex-col gap-2 min-w-0">
      <h2 :class="labelClass">{{ $t('articles.columns.sources') }}</h2>
      <ArticleEditorPopover
        :label="$t('articles.columns.sources')"
        icon="mdi:link-variant"
        size="md"
        :filled="!!filledSources.length"
        align="right"
      >
        <template #trigger>{{ filledSources.length || $t('articles.sources.add') }}</template>
        <ArticleSources v-model="sources" compact />
      </ArticleEditorPopover>
    </div>
  </section>
</template>

<script setup lang="ts">
const series = defineModel<any>('series')
const tags = defineModel<string[]>('tags', { default: () => [] })
const releaseAt = defineModel<string | Date | null>('releaseAt')
const sources = defineModel<string[]>('sources', { default: () => [] })

// The editor keeps a trailing blank row for typing into; the count must not advertise it.
const filledSources = computed(() => sources.value.filter((source) => source.trim()))

const { t } = useI18n()
const { formatTime } = useTime()

const QUICK_KINDS = ['now', 'inHour', 'tomorrow'] as const

const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-500 dark:text-gray-400'

const releaseLabel = computed(() =>
  releaseAt.value ? formatTime(releaseAt.value, 'shortDatetime') : t('articles.editor.publishImmediately'),
)

const releaseAtInput = computed<string | null>({
  get: () => toDateTimeLocal(releaseAt.value),
  set: (value) => (releaseAt.value = value),
})

const setQuick = (kind: ReleaseQuick) => (releaseAt.value = releaseQuickValue(kind))
</script>
