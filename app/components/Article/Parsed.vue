<template>
  <div>
    <div v-for="(node, i) in parsedContent" :key="i">
      <ArticlePoll v-if="node.type === 'poll'" :poll="node" :articleId="props.articleId" />
      <div v-else v-html="node.html" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { normalizePollOptions, type PollOptionData } from '~~/shared/utils/polls'

const props = defineProps<{ content: string; articleId: string }>()
const parsedContent = reactive<any[]>([])

const parse = () => {
  if (!props.content) return
  if (import.meta.client) {
    const p = new DOMParser()
    const d = p.parseFromString(props.content, 'text/html')
    parsedContent.splice(
      0,
      parsedContent.length,
      ...Array.from(d.body.childNodes).map((n) => {
        const el = n as Element
        if (el.nodeName === 'DIV' && el.getAttribute('data-type') === 'poll') {
          const pollId = el.getAttribute('data-poll-id') || el.getAttribute('data-id')
          if (!pollId) {
            // Server-side syncArticlePolls must stamp data-poll-id; without it the
            // vote endpoint has no FK target, so degrade to raw HTML instead of
            // rendering a vote widget that would silently drop hlasy.
            console.warn('[ArticleParsed] poll block missing data-poll-id, rendering as raw HTML', el)
            return { type: 'html', html: el.outerHTML }
          }
          let options: PollOptionData[]
          try {
            options = normalizePollOptions(JSON.parse(el.getAttribute('data-options') || '[]'))
          } catch {
            options = []
          }
          return {
            type: 'poll',
            pollId,
            question: el.getAttribute('data-question') || 'Zadej otázku',
            options,
          }
        }
        return { type: 'html', html: el.outerHTML }
      }),
    )
  }
}

onMounted(parse)

watch(() => props.content, parse)
</script>
