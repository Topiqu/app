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
import { creditSegments, creditSeparator, type CoverCredit } from '~~/shared/utils/imageCredit'

const { cover } = defineProps<{ cover?: CoverCredit | null }>()

const { t } = useI18n()

/** Only a real photo goes unlabelled; anything else says so before it says who made it. */
const prefix = computed(() => {
  if (cover?.kind === 'ai') return t('articles.image.ai')
  if (cover?.kind === 'illustration') return t('articles.image.illustration')

  return ''
})

const segments = computed(() => (cover?.credit ? creditSegments(cover.credit, t('articles.image.photoBy')) : []))
</script>
