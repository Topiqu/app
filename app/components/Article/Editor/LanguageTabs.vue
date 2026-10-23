<template>
  <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
    <UButton
      type="button"
      size="sm"
      :disabled="disabled"
      color="neutral"
      variant="ghost"
      icon="mdi:translate"
      trailingIcon="mdi:chevron-down"
      class="uppercase tracking-wide text-muted hover:text-highlighted"
      :aria-label="$t('articles.translations.languageTabs')"
    >
      {{ activeTab?.code }}
    </UButton>
    <template #item-leading="{ item }"><LanguageFlag :language="item.language" /></template>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { ArticleTranslationRow } from '~~/shared/utils/articleTranslations'

const modelValue = defineModel<string>({ required: true })

const {
  primaryLanguage,
  targetLanguages,
  byLanguage,
  sourceValue = '',
  disabled = false,
} = defineProps<{
  primaryLanguage: string
  targetLanguages: string[]
  byLanguage: Record<string, ArticleTranslationRow | undefined>
  sourceValue?: string
  disabled?: boolean
}>()

const { t } = useI18n()

/** The source tab is `''` so the page can branch on one flag; the label still shows its code. */
const tabs = computed(() => [
  { lang: sourceValue, code: primaryLanguage, hint: t('articles.translations.sourceTab'), dot: '' },
  ...targetLanguages.map((lang) => ({
    lang,
    code: lang,
    hint: t(`languages.${lang}`),
    dot: translationStatusDot(byLanguage[lang]?.status),
  })),
])
const activeTab = computed(() => tabs.value.find((tab) => tab.lang === modelValue.value) ?? tabs.value[0])
const menuItems = computed(() =>
  tabs.value.map((tab) => ({
    label: tab.hint,
    language: tab.code,
    type: 'checkbox' as const,
    checked: tab.lang === modelValue.value,
    disabled,
    onSelect: () => {
      modelValue.value = tab.lang
    },
  })),
)
</script>
