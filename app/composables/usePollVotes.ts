import type { PollOptionData } from '~~/shared/utils/polls'

type VoteCounts = Record<string, number>

/** Vote counts and the reader's own vote for one poll block (a quiz is a poll too), cast optimistically. */
export function usePollVotes(source: {
  articleId: MaybeRefOrGetter<string>
  pollId: MaybeRefOrGetter<string>
  options: MaybeRefOrGetter<PollOptionData[]>
}) {
  const { t } = useI18n()
  const toast = useToast()
  const optimisticStatus = useOptimisticStatus()

  // Keyed by optionId.
  const voteCounts = reactive<VoteCounts>({})
  const hasVoted = shallowRef(false)
  const selectedOption = shallowRef<string | null>(null)
  // False while the article is a draft or scheduled: its admins see the poll, but it takes no votes.
  const open = shallowRef(true)
  const voting = shallowRef(false)

  const totalVotes = computed(() => Object.values(voteCounts).reduce((sum, count) => sum + count, 0))
  const percentage = (optionId?: string) => {
    const optionVotes = (optionId && voteCounts[optionId]) || 0
    return totalVotes.value ? Math.round((optionVotes / totalVotes.value) * 100) : 0
  }

  const replaceVoteCounts = (next: VoteCounts) => {
    for (const option of toValue(source.options)) if (option.id) voteCounts[option.id] = next[option.id] ?? 0
  }

  const fetchResults = async () => {
    const articleId = toValue(source.articleId)
    const pollId = toValue(source.pollId)
    if (!articleId || !pollId) return
    try {
      const res = await $fetch<
        { pollResult: string | null; voteCounts: VoteCounts; open?: boolean },
        '/api/articles/:id/vote'
      >(`/api/articles/${articleId}/vote?pollId=${pollId}` as '/api/articles/:id/vote')
      Object.assign(voteCounts, res.voteCounts || {})
      hasVoted.value = !!res.pollResult
      selectedOption.value = res.pollResult ? String(res.pollResult) : null
      open.value = res.open !== false
    } catch (e) {
      console.error('Failed to fetch poll results:', e)
    }
  }

  const vote = async (optionId?: string) => {
    if (hasVoted.value || voting.value || !open.value || !optionId) return
    const previousCounts = { ...voteCounts }
    const previousSelection = selectedOption.value
    const previousHasVoted = hasVoted.value
    voting.value = true
    hasVoted.value = true
    selectedOption.value = optionId
    voteCounts[optionId] = (voteCounts[optionId] ?? 0) + 1
    optimisticStatus.saving()
    try {
      const res = await $fetch<{ pollResult: string; voteCounts: VoteCounts }, '/api/articles/:id/vote'>(
        `/api/articles/${toValue(source.articleId)}/vote` as '/api/articles/:id/vote',
        { method: 'POST', body: { pollId: toValue(source.pollId), optionId } },
      )
      replaceVoteCounts(res.voteCounts)
      optimisticStatus.saved()
    } catch (e) {
      replaceVoteCounts(previousCounts)
      hasVoted.value = previousHasVoted
      selectedOption.value = previousSelection
      optimisticStatus.reverted()
      toast.add({ color: 'error', title: fetchErrorMessage(e, t('common.messages.operationFailed')) })
    } finally {
      voting.value = false
    }
  }

  onMounted(fetchResults)

  return { voteCounts, hasVoted, selectedOption, open, voting, totalVotes, percentage, vote }
}
