<template>
  <div>
    <div v-for="(node, i) in parsedContent" :key="i">
      <div v-if="node.type === 'poll'" class="poll-display">
        <h4>{{ node.question }}</h4>
        <div v-for="(opt, j) in node.options" :key="j" class="poll-option">
          <button
            :disabled="hasVoted[node.pollId]"
            class="poll-button"
            :class="{ voted: selectedOptions[node.pollId] === opt }"
            @click="vote(node.pollId, opt)"
          >
            <span
              class="poll-background"
              :style="{ width: hasVoted[node.pollId] ? `${getPercentage(node.pollId, opt)}%` : '0%' }"
            ></span>
            <span class="poll-content">
              {{ opt }}
              <span v-if="hasVoted[node.pollId]" class="vote-info">
                ({{ voteCounts[node.pollId]?.[opt] || 0 }} hlasů, {{ getPercentage(node.pollId, opt) }}%)
              </span>
            </span>
          </button>
        </div>
      </div>
      <div v-else v-html="node.html" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ content: string; articleId: string }>()
const parsedContent = reactive<any[]>([])
const voteCounts = reactive<Record<string, Record<string, number>>>({})
const hasVoted = reactive<Record<string, boolean>>({})
const selectedOptions = reactive<Record<string, string | null>>({})
const toast = useToast()

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
          } catch (e) {
            console.error('Chyba při parsování options:', e)
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
    parsedContent.forEach((node) => {
      if (node.type === 'poll') {
        if (!(node.pollId in hasVoted)) hasVoted[node.pollId] = false
        if (!(node.pollId in selectedOptions)) selectedOptions[node.pollId] = null
        if (!(node.pollId in voteCounts)) voteCounts[node.pollId] = {}
      }
    })
  }
}

const fetchResults = async () => {
  if (!props.articleId) return
  try {
    const polls = parsedContent.filter((n) => n.type === 'poll')
    for (const poll of polls) {
      const res = await $fetch<{ pollResult: string | null; voteCounts: Record<string, number> }>(
        `/api/articles/${props.articleId}/vote?pollId=${poll.pollId}`,
      )
      voteCounts[poll.pollId] = res.voteCounts || {}
      hasVoted[poll.pollId] = !!res.pollResult
      selectedOptions[poll.pollId] = res.pollResult ? String(res.pollResult) : null
    }
  } catch (e) {
    console.error('Failed to fetch poll results:', e)
  }
}

const getPercentage = (pollId: string, option: string) => {
  const counts = voteCounts[pollId] || {}
  const totalVotes = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const optionVotes = counts[option] || 0
  return totalVotes ? Math.round((optionVotes / totalVotes) * 100) : 0
}

const vote = async (pollId: string, option: string) => {
  if (hasVoted[pollId]) return
  try {
    const res = await $fetch(`/api/articles/${props.articleId}/vote`, {
      method: 'POST',
      body: { pollId, response: option },
    })
    hasVoted[pollId] = true
    selectedOptions[pollId] = option
    voteCounts[pollId] = res.voteCounts
  } catch (e: any) {
    toast.error({ message: `Hlasování selhalo: ${e.data?.message}` })
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
  border-radius: 8px;
  background-color: #f9fafb;
}
html.dark .poll-display {
  background-color: #374151;
  border-color: #4b5563;
}
.poll-display h4 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1f2937;
}
html.dark .poll-display h4 {
  color: #e5e7eb;
}
.poll-option .poll-button {
  position: relative;
  width: 100%;
  padding: 8px 16px;
  margin: 4px 0;
  background-color: #e5e7eb;
  color: #1f2937;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  overflow: hidden;
  text-align: left;
}
.poll-option .poll-button:disabled {
  cursor: not-allowed;
}
.poll-option .voted {
  font-weight: 600;
}
.poll-option .poll-background {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #bcc3ce;
  transition: width 0.5s ease-in-out;
  z-index: 0;
}
.poll-option .voted .poll-background {
  background-color: #10b981;
}
.poll-option .poll-content {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
}
.poll-option .vote-info {
  font-size: 0.85rem;
  opacity: 0.9;
  margin-left: 8px;
}
html.dark .poll-option .poll-button {
  background-color: #4b5563;
  color: #e5e7eb;
}
html.dark .poll-option .poll-background {
  background-color: #60a5fa;
}
html.dark .poll-option .voted .poll-background {
  background-color: #34d399;
}
</style>
