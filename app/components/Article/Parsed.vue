<template>
  <div ref="root" @error.capture="handleMediaError">
    <template v-for="(block, i) in blocks" :key="i">
      <ArticlePoll v-if="block.type === 'poll'" :poll="block" :articleId="articleId" />
      <!-- eslint-disable-next-line vue/no-v-html -- server-sanitised body (`sanitizeHtml` on write) -->
      <div v-else v-html="visibleHtml(block.html)" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ArticleBlock } from '~~/shared/utils/articleBlocks'

import { canOptimizeImageUrl } from '~~/shared/utils/imageHosts'
import { optimizeArticleImages } from '~~/shared/utils/articleImages'

// Blocks come pre-built. Splitting here (in `onMounted`) left the SSR HTML with an empty body.
const {
  blocks,
  articleId,
  discloseAi = true,
} = defineProps<{
  blocks: ArticleBlock[]
  articleId: string
  discloseAi?: boolean
}>()
const root = useTemplateRef<HTMLElement>('root')
const image = useImage()
const transformArticleImage = (source: string, width: number) =>
  canOptimizeImageUrl(source) ? image(source, { width, format: 'webp', quality: 82 }) : null

const handleMediaError = (event: Event) => {
  const failed = event.target
  if (!(failed instanceof HTMLImageElement) || !root.value?.contains(failed)) return

  const original = failed.dataset.originalSrc
  if (original && failed.dataset.originalRetry !== 'true') {
    failed.dataset.originalRetry = 'true'
    failed.removeAttribute('srcset')
    failed.removeAttribute('sizes')
    failed.src = original
    return
  }

  const fallback = document.createElement('span')
  fallback.className = 'article-inline-image-fallback'
  fallback.setAttribute('role', 'img')
  fallback.setAttribute('aria-label', failed.alt || $t('articles.columns.imageUrl'))
  const icon = document.createElement('span')
  icon.className = 'article-inline-image-fallback__mark'
  icon.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  label.textContent = failed.alt || failed.currentSrc.split('/').pop() || $t('articles.columns.imageUrl')
  fallback.append(icon, label)
  failed.replaceWith(fallback)
}

onMounted(() => {
  // An SSR image can finish failing before Vue hydrates and attaches the capturing listener.
  // Reconcile after the browser has painted the hydrated tree; mutating a child synchronously
  // from its mounted hook can otherwise race a still-hydrating parent on slower viewports.
  requestAnimationFrame(() => {
    for (const media of root.value?.querySelectorAll('img') ?? []) {
      if (media.complete && media.naturalWidth === 0) handleMediaError({ target: media } as unknown as Event)
    }
  })
})

// The span is the current format. The two text alternatives keep the toggle effective for old
// articles and for captions round-tripped through TipTap, which may flatten unknown attributes.
const visibleHtml = (html: string) => {
  const visible = discloseAi
    ? html
    : html
        .replace(/<span\s+data-ai-disclosure(?:="")?>(.*?)<\/span>/gi, '')
        .replace(/(<small\b[^>]*>)\s*(?:Illustrative image \(AI\)|Ilustrační obrázek \(AI\)):\s*/gi, '$1')

  const normalized = visible
    .replace(/<p(?:\s[^>]*)?>\s*(?:<br\s*\/?>|&nbsp;|\u00a0)?\s*<\/p>/gi, '')
    .replace(/(<p(?:\s[^>]*)?>)\s*(<img\b[^>]*>)\s*(<\/p>)/gi, '$1$2$3')

  return optimizeArticleImages(normalized, transformArticleImage)
}
</script>
