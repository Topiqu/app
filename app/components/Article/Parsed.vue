<template>
  <div>
    <template v-for="(block, i) in blocks" :key="i">
      <ArticlePoll v-if="block.type === 'poll'" :poll="block" :articleId="articleId" />
      <!-- eslint-disable-next-line vue/no-v-html -- server-sanitised body (`sanitizeHtml` on write) -->
      <div v-else v-html="visibleHtml(block.html)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ArticleBlock } from '~~/shared/utils/articleBlocks'

// Blocks come pre-built. Splitting here (in `onMounted`) left the SSR HTML with an empty body.
const props = withDefaults(defineProps<{ blocks: ArticleBlock[]; articleId: string; discloseAi?: boolean }>(), {
  discloseAi: true,
})

// The span is the current format. The two text alternatives keep the toggle effective for old
// articles and for captions round-tripped through TipTap, which may flatten unknown attributes.
const visibleHtml = (html: string) =>
  props.discloseAi
    ? html
    : html
        .replace(/<span\s+data-ai-disclosure(?:="")?>(.*?)<\/span>/gi, '')
        .replace(/(<small\b[^>]*>)\s*(?:Illustrative image \(AI\)|Ilustrační obrázek \(AI\)):\s*/gi, '$1')
</script>
