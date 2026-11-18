<template>
  <div
    class="not-prose my-8 overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default p-5 shadow-sm sm:p-6"
  >
    <div class="mb-4 flex items-start gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon name="mdi:poll" class="size-5" />
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
        :disabled="hasVoted || voting || !open"
        class="min-h-11 w-full"
        :aria-pressed="selectedOption === opt.id"
        @click="vote(opt.id)"
      >
        <span class="flex w-full min-w-0 items-center gap-2 text-left">
          <span class="min-w-0 flex-1">{{ opt.label }}</span>
          <UBadge v-if="selectedOption === opt.id" color="primary" variant="soft" size="xs">
            {{ $t('articles.poll.yourVote') }}
          </UBadge>
          <span v-if="hasVoted" class="shrink-0 text-xs tabular-nums opacity-80">{{ percentage(opt.id) }}%</span>
        </span>
      </UButton>
      <UProgress
        v-if="hasVoted"
        :modelValue="percentage(opt.id)"
        :max="100"
        :color="selectedOption === opt.id ? 'success' : 'neutral'"
        size="sm"
      />
    </div>
    <p v-if="!open" class="mt-4 flex items-center gap-1.5 text-sm text-muted">
      <UIcon name="mdi:lock-outline" class="size-4 shrink-0" />
      {{ $t('articles.poll.notOpenYet') }}
    </p>
    <div v-if="hasVoted" class="mt-4 flex items-center gap-1.5 text-sm text-muted" aria-live="polite">
      <UIcon name="mdi:account-group-outline" class="size-4" />
      {{ `${totalVotes} ${$t('articles.votes').toLowerCase()}` }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PollOptionData } from '~~/shared/utils/polls'

const props = defineProps<{
  poll: { type: string; pollId: string; question: string; options: PollOptionData[] }
  articleId: string
}>()

const { hasVoted, selectedOption, open, voting, totalVotes, percentage, vote } = usePollVotes({
  articleId: () => props.articleId,
  pollId: () => props.poll.pollId,
  options: () => props.poll.options,
})
</script>
