<template>
  <!-- Min-heights are the tallest creative per breakpoint plus the label, so filling never shifts the feed. -->
  <AdSenseSlot
    v-if="provider === 'adsense'"
    :adSlot="adsenseSlot"
    class="col-span-full min-h-[298px] lg:min-h-[268px]"
  />
  <AdSlot
    v-else-if="provider === 'gam'"
    adUnitPath="/home/feed"
    slotId="home-feed-ad"
    :sizes="[[300, 250]]"
    :sizeMapping="gamMapping"
    showLabel
    class="col-span-full min-h-[298px] md:min-h-[108px] lg:min-h-[268px]"
  />
</template>

<script setup lang="ts">
import type { AdProvider } from '~~/shared/utils/advertising'

import type { GamSizeMapping } from '~/composables/useGam'

defineProps<{ provider: AdProvider }>()

const adsenseSlot = String(useRuntimeConfig().public.adsenseFeedSlot || '')

const gamMapping: GamSizeMapping[] = [
  {
    viewport: [1024, 0],
    sizes: [
      [970, 250],
      [728, 90],
    ],
  },
  { viewport: [768, 0], sizes: [[728, 90]] },
  {
    viewport: [0, 0],
    sizes: [
      [300, 250],
      [336, 280],
    ],
  },
]
</script>
