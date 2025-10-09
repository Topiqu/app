<template>
  <div class="border border-gray-200 dark:border-gray-400 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm m-4">
    <h4 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{{ poll.question }}</h4>
    <div v-for="(opt, j) in poll.options" :key="j" class="relative group mb-2">
      <button
        :disabled="hasVoted"
        class="relative z-10 w-full p-3 text-left rounded-md border border-transparent transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-500 hover:border-gray-400 dark:hover:border-gray-500 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
        :class="{
          'ring-2 ring-green-400': hasVoted && opt === getTopOption,
          'cursor-pointer': !hasVoted,
        }"
        @click="vote(opt)"
      >
        <div
          class="absolute inset-0 rounded-md transition-all duration-500 ease-out"
          :class="selectedOption === opt ? 'bg-green-500/60 dark:bg-green-400/50' : 'bg-gray-300 dark:bg-gray-600'"
          :style="{ width: hasVoted ? `${getPercentage(opt)}%` : '0%' }"
        ></div>
        <span class="relative flex justify-between items-center">
          {{ opt }}
          <span v-if="hasVoted" class="text-xs opacity-80"> {{ getPercentage(opt) }}% </span>
        </span>
      </button>
    </div>
    <div v-if="hasVoted" class="text-sm opacity-80 mb-4 text-gray-600 dark:text-gray-300">
      ({{ `${getTotalVotes} ${$t('articles.votes').toLowerCase()}` }})
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  poll: { type: string; pollId: string; question: string; options: string[] }
  articleId: string
}>()
const voteCounts = reactive<Record<string, number>>({})
const hasVoted = ref<boolean>(false)
const selectedOption = ref<string | null>(null)
const toast = useToast()

const fetchResults = async () => {
  if (!props.articleId || !props.poll.pollId) return
  try {
    const res = await $fetch<{ pollResult: string | null; voteCounts: Record<string, number> }>(
      `/api/articles/${props.articleId}/vote?pollId=${props.poll.pollId}`,
    )
    Object.assign(voteCounts, res.voteCounts || {})
    hasVoted.value = !!res.pollResult
    selectedOption.value = res.pollResult ? String(res.pollResult) : null
  } catch (e) {
    console.error('Failed to fetch poll results:', e)
  }
}

const getPercentage = (option: string) => {
  const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
  const optionVotes = voteCounts[option] || 0
  return totalVotes ? Math.round((optionVotes / totalVotes) * 100) : 0
}

const getTotalVotes = computed(() => Object.values(voteCounts).reduce((sum, count) => sum + count, 0))

const getTopOption = computed(() =>
  Object.entries(voteCounts).reduce(
    (top, [opt, count]) => (count > (voteCounts[top] || 0) ? opt : top),
    Object.keys(voteCounts)[0] || '',
  ),
)

const vote = async (option: string) => {
  if (hasVoted.value) return
  try {
    const res = await $fetch(`/api/articles/${props.articleId}/vote`, {
      method: 'POST',
      body: { pollId: props.poll.pollId, response: option },
    })
    hasVoted.value = true
    selectedOption.value = option
    Object.assign(voteCounts, res.voteCounts)
  } catch (e: any) {
    toast.error({ message: e.data?.message })
  }
}

onMounted(fetchResults)
</script>
