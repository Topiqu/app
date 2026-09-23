<template>
  <UCard
    class="not-prose my-8 overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default shadow-sm"
  >
    <div class="mb-4 flex items-start gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon name="i-mdi-poll" class="size-5" />
      </span>
      <div role="heading" aria-level="4" class="min-w-0 pt-1 text-lg font-semibold text-highlighted">
        {{ poll.question }}
      </div>
    </div>
    <div v-for="opt in poll.options" :key="opt.id" class="mb-2.5 space-y-1.5 last:mb-0">
      <UButton
        :color="selectedOption === opt.id ? 'primary' : 'neutral'"
        :variant="selectedOption === opt.id ? 'soft' : 'ghost'"
        :icon="selectedOption === opt.id ? 'mdi:check-circle' : 'mdi:circle-outline'"
        :disabled="hasVoted || voting"
        class="min-h-11 w-full justify-start rounded-lg border border-default bg-elevated/40 px-3 text-left transition-colors hover:border-primary/40 hover:bg-elevated"
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
    <div v-if="hasVoted" class="mt-4 flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
      <UIcon name="i-mdi-account-group-outline" class="size-4" />
      {{ `${getTotalVotes} ${$t('articles.votes').toLowerCase()}` }}
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
const voting = shallowRef(false)
const optimisticStatus = useOptimisticStatus()

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
const replaceVoteCounts = (next: Record<string, number>) => {
  for (const option of props.poll.options) if (option.id) voteCounts[option.id] = next[option.id] ?? 0
}

const vote = async (optionId?: string) => {
  if (hasVoted.value || voting.value || !optionId) return
  const previousCounts = { ...voteCounts }
  const previousSelection = selectedOption.value
  const previousHasVoted = hasVoted.value
  voting.value = true
  hasVoted.value = true
  selectedOption.value = optionId
  voteCounts[optionId] = (voteCounts[optionId] ?? 0) + 1
  optimisticStatus.saving()
  try {
    const res = await $fetch<{ pollResult: string; voteCounts: Record<string, number> }>(
      `/api/articles/${props.articleId}/vote`,
      {
        method: 'POST',
        body: { pollId: props.poll.pollId, optionId },
      },
    )
    replaceVoteCounts(res.voteCounts)
    optimisticStatus.saved()
  } catch (e: any) {
    replaceVoteCounts(previousCounts)
    hasVoted.value = previousHasVoted
    selectedOption.value = previousSelection
    optimisticStatus.reverted()
    toast.add({ color: 'error', title: e.data?.message })
  } finally {
    voting.value = false
  }
}

onMounted(fetchResults)
</script>
