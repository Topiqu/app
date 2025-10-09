<template>
  <div>
    <div v-for="(node, i) in parsedContent" :key="i">
      <ArticlePoll v-if="node.type === 'poll'" :poll="node" :articleId="props.articleId" />
      <div v-else v-html="node.html" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
          let options
          try {
            options = JSON.parse(el.getAttribute('data-options') || '[]')
          } catch {
            options = ['Možnost 1']
          }
          return {
            type: 'poll',
            pollId: el.getAttribute('data-id') || crypto.randomUUID(),
            question: el.getAttribute('data-question') || 'Zadej otázku',
            options: options.length ? options : ['Možnost 1'],
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
