<template>
  <div
    class="flex items-center gap-0.5 p-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
    role="tablist"
    :aria-label="$t('articles.translations.languageTabs')"
  >
    <UButton
      v-for="tab in tabs"
      :key="tab.lang"
      type="button"
      role="tab"
      :aria-selected="tab.lang === modelValue"
      :title="tab.hint"
      class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors border-none"
      :class="
        tab.lang === modelValue
          ? 'bg-indigo-600! text-white!'
          : 'bg-transparent! text-gray-600! dark:text-gray-300! hover:bg-gray-200! dark:hover:bg-gray-800!'
      "
      @click="modelValue = tab.lang"
    >
      {{ tab.code }}
      <span v-if="tab.dot" class="w-1.5 h-1.5 rounded-full" :class="tab.dot" />
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { translationStatusDot, type ArticleTranslationRow } from '~~/shared/utils/articleTranslations'

const modelValue = defineModel<string>({ required: true })

const { primaryLanguage, targetLanguages, byLanguage } = defineProps<{
  primaryLanguage: string
  targetLanguages: string[]
  byLanguage: Record<string, ArticleTranslationRow | undefined>
}>()

const { t } = useI18n()

/** The source tab is `''` so the page can branch on one flag; the label still shows its code. */
const tabs = computed(() => [
  { lang: '', code: primaryLanguage, hint: t('articles.translations.sourceTab'), dot: '' },
  ...targetLanguages.map((lang) => ({
    lang,
    code: lang,
    hint: t(`languages.${lang}`),
    dot: translationStatusDot(byLanguage[lang]?.status),
  })),
])
</script>
