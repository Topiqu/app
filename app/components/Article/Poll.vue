<template>
  <UCard class="not-prose my-8">
    <h4 class="mb-4 text-lg font-semibold text-highlighted">{{ poll.question }}</h4>
    <div v-for="opt in poll.options" :key="opt.id" class="mb-3 space-y-1.5">
      <UButton
        :color="selectedOption === opt.id ? 'primary' : 'neutral'"
        :variant="selectedOption === opt.id ? 'soft' : 'ghost'"
        :icon="selectedOption === opt.id ? 'i-mdi-check-circle' : 'i-mdi-circle-outline'"
        :disabled="hasVoted"
        class="w-full"
        :aria-pressed="selectedOption === opt.id"
        @click="vote(opt.id)"
      >
        <span class="flex w-full min-w-0 items-center gap-2 text-left">
          <span class="min-w-0 flex-1">{{ opt.label }}</span>
          <UBadge v-if="selectedOption === opt.id" color="primary" variant="soft" size="xs">
            {{ $t('articles.poll.yourVote') }}
          </UBadge>
          <span v-if="hasVoted" class="shrink-0 text-xs tabular-nums opacity-80">{{ getPercentage(opt.id) }}%</span>
        </span>
      </UButton>
      <UProgress
        v-if="hasVoted"
        :modelValue="getPercentage(opt.id)"
        :max="100"
        :color="selectedOption === opt.id ? 'success' : 'neutral'"
        size="sm"
      />
    </div>
    <div v-if="hasVoted" class="mt-4 text-sm text-muted">
      ({{ `${getTotalVotes} ${$t('articles.votes').toLowerCase()}` }})
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { PollOptionData } from '~~/shared/utils/polls'

const props = defineProps<{
  poll: { type: string; pollId: string; question: string; options: PollOptionData[] }
  articleId: string
}>()
// Vote counts keyed by optionId.
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

const getPercentage = (optionId?: string) => {
  const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0)
  const optionVotes = (optionId && voteCounts[optionId]) || 0
  return totalVotes ? Math.round((optionVotes / totalVotes) * 100) : 0
}

const getTotalVotes = computed(() => Object.values(voteCounts).reduce((sum, count) => sum + count, 0))

const vote = async (optionId?: string) => {
  if (hasVoted.value || !optionId) return
  try {
    const res = await $fetch<{ pollResult: string; voteCounts: Record<string, number> }>(
      `/api/articles/${props.articleId}/vote`,
      {
        method: 'POST',
        body: { pollId: props.poll.pollId, optionId },
      },
    )
    hasVoted.value = true
    selectedOption.value = optionId
    Object.assign(voteCounts, res.voteCounts)
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message })
  }
}

onMounted(fetchResults)
</script>
