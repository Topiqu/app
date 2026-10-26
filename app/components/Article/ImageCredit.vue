<template>
  <p v-if="prefix || segments.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
    <span v-if="prefix">{{ prefix }}</span>
    <span v-if="prefix && segments.length"> — </span>
    <template v-for="(segment, i) in segments" :key="i"
      >{{ creditSeparator(i, segments.length) }}{{ segment.before
      }}<a
        v-if="segment.href"
        :href="segment.href"
        target="_blank"
        rel="noopener"
        class="underline decoration-dotted hover:text-gray-700 dark:hover:text-gray-200"
        >{{ segment.text }}</a
      ><template v-else>{{ segment.text }}</template
      >{{ segment.after }}</template
    >
  </p>
</template>

<script setup lang="ts">
import type { CoverCredit } from '~~/shared/utils/imageCredit'

const { cover } = defineProps<{ cover?: CoverCredit | null }>()

const { t } = useI18n()

// A generated cover says so on the picture itself (`ArticleHeaderHero`).
const prefix = computed(() => (cover?.kind === 'illustration' ? t('articles.image.illustration') : ''))

const segments = computed(() => (cover?.credit ? creditSegments(cover.credit, t('articles.image.photoBy')) : []))
</script>
