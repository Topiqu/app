<template>
  <UDropdownMenu v-if="links.length > 1" :items>
    <UButton
      color="neutral"
      variant="soft"
      icon="mdi:translate"
      trailingIcon="mdi:chevron-down"
      :label="currentLabel"
      :aria-label="$t('articles.translations.languageTabs')"
    />
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { Language } from '~~/shared/utils/language'

export interface LanguageLink {
  language: Language
  slug: string
}

// The admin table has its own `TranslationMenu`; this one links to the live localized article.
const { links, current } = defineProps<{ links: LanguageLink[]; current?: Language }>()

const localePath = useLocalePath()

const currentLabel = computed(() => $t(`languages.${current ?? links[0]?.language}`))
const items = computed(() =>
  links.map((link) => ({
    label: $t(`languages.${link.language}`),
    icon: link.language === current ? 'mdi:check' : 'mdi:translate',
    onSelect: () => navigateTo(localePath({ name: 'clanky-slug', params: { slug: link.slug } }, link.language)),
  })),
)
</script>
