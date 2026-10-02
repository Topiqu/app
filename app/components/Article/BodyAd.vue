<template>
  <!-- 298px = the tallest creative (336×280) plus the label, so filling never shifts the text below. -->
  <AdSenseSlot v-if="provider === 'adsense'" :adSlot="adsenseSlot" class="not-prose my-8 min-h-[298px]" />
  <AdSlot
    v-else-if="provider === 'gam'"
    adUnitPath="/article/body"
    :slotId="`article-body-ad-${articleId}`"
    :sizes="[[300, 250]]"
    :sizeMapping="gamMapping"
    :targeting="{ article_id: articleId, placement: 'body' }"
    showLabel
    class="not-prose min-h-[298px]"
  />
</template>

<script setup lang="ts">
import type { AdProvider } from '~~/shared/utils/advertising'

import type { GamSizeMapping } from '~/composables/useGam'

defineProps<{ provider: AdProvider; articleId: string }>()

const adsenseSlot = String(useRuntimeConfig().public.adsenseArticleBodySlot || '')

const gamMapping: GamSizeMapping[] = [
  {
    viewport: [768, 0],
    sizes: [
      [728, 90],
      [336, 280],
      [300, 250],
    ],
  },
  {
    viewport: [0, 0],
    sizes: [
      [336, 280],
      [300, 250],
    ],
  },
]
</script>
