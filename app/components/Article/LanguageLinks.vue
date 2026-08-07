<template>
  <nav
    v-if="links.length > 1"
    class="inline-flex items-center gap-1"
    :aria-label="$t('articles.translations.languageTabs')"
  >
    <NuxtLink
      v-for="link in links"
      :key="link.language"
      :to="link.to"
      :title="$t(`languages.${link.language}`)"
      :aria-current="link.current ? 'true' : undefined"
      class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-semibold uppercase tracking-wide no-underline border transition-colors"
      :class="
        link.current
          ? 'bg-indigo-600! border-indigo-600! text-white!'
          : 'bg-white! dark:bg-gray-900! border-gray-200! dark:border-gray-700! text-gray-600! dark:text-gray-300! hover:bg-gray-50! dark:hover:bg-gray-800!'
      "
    >
      {{ link.language }}
      <span v-if="link.dot" class="w-1.5 h-1.5 rounded-full" :class="link.dot" />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { translationStatusDot, type TranslationStatus } from '~~/shared/utils/articleTranslations'

export interface LanguageLink {
  language: string
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
  current?: string
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
</script>
