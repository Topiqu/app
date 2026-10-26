<template>
  <p v-if="prefix || segments.length" class="mt-2 text-xs text-muted">
    {{ prefix
    }}<template v-for="(segment, i) in segments" :key="i"
      >{{ segment.before
      }}<a
        v-if="segment.href"
        :href="segment.href"
        target="_blank"
        rel="noopener"
        class="underline decoration-dotted hover:text-highlighted"
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

// A generated cover says so on the picture itself (`ArticleHeaderHero`); an illustrative one says
// so in its credit label, so only an uncredited illustration needs the bare prefix.
const prefix = computed(() => (cover?.kind === 'illustration' && !cover.credit ? t('articles.image.illustration') : ''))

const segments = computed(() =>
  cover?.credit
    ? creditSegments(
        cover.credit,
        t(cover.kind === 'illustration' ? 'articles.image.illustrationBy' : 'articles.image.photoBy'),
      )
    : [],
)
</script>
