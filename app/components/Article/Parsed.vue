<template>
  <div>
    <template v-for="(block, i) in blocks" :key="i">
      <ArticlePoll v-if="block.type === 'poll'" :poll="block" :articleId="articleId" />
      <!-- eslint-disable-next-line vue/no-v-html -- server-sanitised body (`sanitizeHtml` on write) -->
      <div v-else v-html="block.html" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ArticleBlock } from '~~/shared/utils/articleBlocks'

// Blocks come pre-built. Splitting here (in `onMounted`) left the SSR HTML with an empty body.
defineProps<{ blocks: ArticleBlock[]; articleId: string }>()
</script>
