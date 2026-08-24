<template>
  <UDropdownMenu v-if="target === 'public' && links.length > 1" :items="publicItems">
    <UButton
      color="neutral"
      variant="soft"
      icon="i-mdi-translate"
      trailingIcon="i-mdi-chevron-down"
      :label="currentLabel"
      :aria-label="$t('articles.translations.languageTabs')"
    />
  </UDropdownMenu>

  <nav
    v-else-if="links.length > 1"
    class="inline-flex items-center gap-1"
    :aria-label="$t('articles.translations.languageTabs')"
  >
    <UButton
      v-for="link in links"
      :key="link.language"
      :to="link.to"
      :title="$t(`languages.${link.language}`)"
      :aria-current="link.current ? 'true' : undefined"
      size="xs"
      :color="link.current ? 'primary' : 'neutral'"
      :variant="link.current ? 'solid' : 'soft'"
    >
      {{ link.language }}
      <span v-if="link.dot" class="w-1.5 h-1.5 rounded-full" :class="link.dot" />
    </UButton>
  </nav>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'

import { translationStatusDot, type TranslationStatus } from '~~/shared/utils/articleTranslations'

export interface LanguageLink {
  language: Language
  slug: string
  status?: TranslationStatus
}

const {
  links: input,
  current,
  target = 'public',
  articleRef = '',
} = defineProps<{
  links: LanguageLink[]
  current?: Language
  /** `public` links to the live localized article, `editor` opens that language's tab. */
  target?: 'public' | 'editor'
  /** Source article slug — the editor route resolves the article by it, then `lang` picks the tab. */
  articleRef?: string
}>()

const localePath = useLocalePath()

const links = computed(() =>
  input.map((link) => ({
    language: link.language,
    current: link.language === current,
    // Only the editor target carries a dot — on the public page every entry is published, so a
    // dot would encode nothing.
    dot: target === 'editor' ? translationStatusDot(link.status) : '',
    to:
      target === 'editor'
        ? { path: localePath({ name: 'admin-editor-id', params: { id: articleRef } }), query: { lang: link.language } }
        : localePath({ name: 'clanky-slug', params: { slug: link.slug } }, link.language),
  })),
)

const currentLabel = computed(() => $t(`languages.${current ?? links.value[0]?.language}`))
const publicItems = computed(() =>
  links.value.map((link) => ({
    label: $t(`languages.${link.language}`),
    icon: link.current ? 'i-mdi-check' : 'i-mdi-translate',
    onSelect: () => navigateTo(link.to),
  })),
)
</script>
