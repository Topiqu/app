<template>
  <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
    <UButton
      type="button"
      size="sm"
      color="neutral"
      variant="ghost"
      icon="mdi:translate"
      trailingIcon="mdi:chevron-down"
      class="uppercase tracking-wide text-muted hover:text-highlighted"
      :aria-label="$t('articles.translations.languageTabs')"
    >
      {{ activeTab?.code }}
    </UButton>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import { translationStatusDot, type ArticleTranslationRow } from '~~/shared/utils/articleTranslations'

const modelValue = defineModel<string>({ required: true })

const {
  primaryLanguage,
  targetLanguages,
  byLanguage,
  sourceValue = '',
} = defineProps<{
  primaryLanguage: string
  targetLanguages: string[]
  byLanguage: Record<string, ArticleTranslationRow | undefined>
  sourceValue?: string
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
    icon: tab.lang === modelValue.value ? 'mdi:check' : 'mdi:translate',
    onSelect: () => {
      modelValue.value = tab.lang
    },
  })),
)
</script>
