<template>
  <div>
    <div v-for="(node, i) in parsedContent" :key="i">
      <div
        v-if="node.type === 'poll'"
        class="border border-gray-200 dark:border-gray-400 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm m-4"
      >
        <h4 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{{ node.question }}</h4>
        <div v-for="(opt, j) in node.options" :key="j" class="relative group mb-2">
          <button
            :disabled="hasVoted[node.pollId]"
            class="relative z-10 w-full p-3 text-left rounded-md border border-transparent transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-500 hover:border-gray-400 dark:hover:border-gray-500 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
            :class="{
              'ring-2 ring-green-400': hasVoted[node.pollId] && opt === getTopOption(node.pollId),
              'cursor-pointer': !hasVoted[node.pollId],
            }"
            @click="vote(node.pollId, opt)"
          >
            <div
              class="absolute inset-0 rounded-md transition-all duration-500 ease-out"
              :class="
                selectedOptions[node.pollId] === opt
                  ? 'bg-green-500/60 dark:bg-green-400/50'
                  : 'bg-gray-300 dark:bg-gray-600'
              "
              :style="{ width: hasVoted[node.pollId] ? `${getPercentage(node.pollId, opt)}%` : '0%' }"
            ></div>
            <span class="relative flex justify-between items-center">
              {{ opt }}
              <span v-if="hasVoted[node.pollId]" class="text-xs opacity-80">
                {{ getPercentage(node.pollId, opt) }}%
              </span>
            </span>
          </button>
        </div>
        <div v-if="hasVoted[node.pollId]" class="text-sm opacity-80 mb-4 text-gray-600 dark:text-gray-300">
          ({{ `${getTotalVotes(node.pollId)} ${$t('articles.votes').toLowerCase()}` }})
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

const getTotalVotes = (pollId: string) => {
  const counts = voteCounts[pollId] || {}
  return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

const getTopOption = (pollId: string) => {
  const counts = voteCounts[pollId] || {}
  return Object.entries(counts).reduce(
    (top, [opt, count]) => (count > (counts[top] || 0) ? opt : top),
    Object.keys(counts)[0] || '',
  )
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
