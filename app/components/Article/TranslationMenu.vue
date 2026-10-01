<template>
  <UDropdownMenu :items :content="{ align: 'start' }">
    <UButton
      color="neutral"
      variant="soft"
      size="xs"
      trailingIcon="mdi:chevron-down"
      class="tabular-nums"
      :aria-label="summary"
      :title="summary"
    >
      <span class="uppercase">{{ source }}</span>
      <span v-if="existing.length" class="text-muted">+{{ existing.length }}</span>
      <span v-if="attention" class="size-1.5 rounded-full" :class="translationStatusDot(attention)" />
    </UButton>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Language } from '~~/shared/utils/language'
import type { TranslationStatus } from '~~/shared/utils/articleTranslations'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { translationStatusDot } from '~~/shared/utils/articleTranslations'

const {
  source,
  slug,
  translations = [],
  translating = false,
} = defineProps<{
  source: Language
  /** Source slug — the editor resolves the article by it, `lang` picks the tab. */
  slug: string
  translations?: { language: string; status: string }[]
  translating?: boolean
}>()

const emit = defineEmits<{ translate: [language: Language] }>()

const localePath = useLocalePath()

// Most urgent first; a published or in-flight translation needs nothing from the author.
const ATTENTION: TranslationStatus[] = ['FAILED', 'READY', 'STALE']

const statusOf = (language: Language) =>
  translations.find((row) => row.language === language)?.status as TranslationStatus | undefined
const targets = computed(() => LANGUAGE_OPTIONS.filter((language) => language !== source))
const existing = computed(() => targets.value.filter((language) => statusOf(language)))
const attention = computed(() =>
  ATTENTION.find((status) => existing.value.some((language) => statusOf(language) === status)),
)
const summary = computed(() =>
  [
    `${$t('articles.translations.languageTabs')}: ${source.toUpperCase()}`,
    existing.value.length ? `+${existing.value.length}` : '',
    attention.value ? $t(`articles.translations.status.${attention.value}`) : '',
  ]
    .filter(Boolean)
    .join(', '),
)

const editorTab = (language: Language) => ({
  path: localePath({ name: 'admin-editor-id', params: { id: slug } }),
  query: { lang: language },
})

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: $t(`languages.${source}`),
      description: $t('articles.translations.sourceTab'),
      icon: 'mdi:file-document-outline',
      to: editorTab(source),
    },
  ],
  targets.value.map((language) => {
    const status = statusOf(language)
    return status
      ? {
          label: $t(`languages.${language}`),
          description: $t(`articles.translations.status.${status}`),
          icon: 'mdi:translate',
          to: editorTab(language),
        }
      : {
          label: $t(`languages.${language}`),
          description: $t('articles.translations.actions.translate'),
          icon: 'mdi:plus',
          disabled: translating,
          onSelect: () => emit('translate', language),
        }
  }),
  ...(existing.value.length
    ? [
        [
          {
            label: $t('articles.translations.actions.retranslate'),
            icon: 'mdi:refresh',
            disabled: translating,
            children: existing.value.map((language) => ({
              label: $t(`languages.${language}`),
              onSelect: () => emit('translate', language),
            })),
          },
        ],
      ]
    : []),
])
</script>
