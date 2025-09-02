```vue
<template>
  <div>
    <div v-for="(node, i) in parsedContent" :key="i">
      <div v-if="node.type === 'poll'" class="poll-display">
        <h3>{{ node.question }}</h3>
        <div v-for="(opt, j) in node.options" :key="j" class="poll-option">
          <button
            :disabled="hasVoted[node.pollId]"
            class="poll-button"
            :class="{ voted: selectedOptions[node.pollId] === opt }"
            @click="vote(node.pollId, opt)"
          >
            {{ opt }} ({{ voteCounts[node.pollId]?.[opt] || 0 }} hlasů)
          </button>
        </div>
      </div>
      <div v-else v-html="node.html" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ content: string; articleId: string }>()
const parsedContent = ref<any[]>([])
const voteCounts = ref<Record<string, Record<string, number>>>({})
const hasVoted = ref<Record<string, boolean>>({})
const selectedOptions = ref<Record<string, string | null>>({})
const toast = useToast()

const parse = () => {
  if (!props.content) return
  if (import.meta.client) {
    const p = new DOMParser()
    const d = p.parseFromString(props.content, 'text/html')
    parsedContent.value = Array.from(d.body.childNodes).map((n) => {
      const el = n as Element
      if (el.nodeName === 'DIV' && el.getAttribute('data-type') === 'poll') {
        return {
          type: 'poll',
          pollId: el.getAttribute('data-id') || crypto.randomUUID(),
          question: el.getAttribute('data-question') || '',
          options: JSON.parse(el.getAttribute('data-options') || '[]'),
        }
      }
      return { type: 'html', html: el.outerHTML }
    })
    parsedContent.value.forEach((node) => {
      if (node.type === 'poll') {
        if (!hasVoted.value[node.pollId]) hasVoted.value[node.pollId] = false
        if (!selectedOptions.value[node.pollId]) selectedOptions.value[node.pollId] = null
        if (!voteCounts.value[node.pollId]) voteCounts.value[node.pollId] = {}
      }
    })
  }
}

const fetchResults = async () => {
  if (!props.articleId) return
  try {
    const polls = parsedContent.value.filter((n) => n.type === 'poll')
    for (const poll of polls) {
      const res = await $fetch<{ pollResult: string; voteCounts: Record<string, number> }>(
        `/api/articles/${props.articleId}/vote?pollId=${poll.pollId}`,
      )
      voteCounts.value[poll.pollId] = res.voteCounts || {}
      if (res.pollResult) {
        hasVoted.value[poll.pollId] = true
        selectedOptions.value[poll.pollId] = res.pollResult
      }
    }
  } catch (e) {
    console.error('Failed to fetch poll results:', e)
  }
}

const vote = async (pollId: string, option: string) => {
  if (hasVoted.value[pollId]) return
  try {
    const res = await $fetch(`/api/articles/${props.articleId}/vote`, {
      method: 'POST',
      body: { pollId, response: option },
    })
    hasVoted.value[pollId] = true
    selectedOptions.value[pollId] = option
    voteCounts.value[pollId] = res.voteCounts
  } catch (e: any) {
    toast.error({ message: `Hlasování selhalo: ${e.message}` })
  }
}

onMounted(() => {
  parse()
  fetchResults()
})

watch(
  () => props.content,
  () => {
    parse()
    fetchResults()
  },
)
</script>

<style>
.poll-display {
  border: 1px solid #ccc;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
  background-color: #f9fafb;
}
html.dark .poll-display {
  background-color: #374151;
  border-color: #4b5563;
}
.poll-display h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1f2937;
}
html.dark .poll-display h3 {
  color: #e5e7eb;
}
.poll-option .poll-button {
  padding: 8px 16px;
  margin: 4px;
  background-color: #3b82f6;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}
.poll-option .poll-button:disabled {
  background-color: #6b7280;
  cursor: not-allowed;
}
.poll-option .voted {
  background-color: #10b981;
}
html.dark .poll-option .poll-button {
  background-color: #60a5fa;
}
html.dark .poll-option .poll-button:disabled {
  background-color: #4b5563;
}
html.dark .poll-option .voted {
  background-color: #34d399;
}
</style>
