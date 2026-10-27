<template>
  <!-- 298px = the tallest creative (336×280) plus the label, so filling never shifts the text below. -->
  <AdSlot
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
defineProps<{ articleId: string }>()

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
