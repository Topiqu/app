<template>
  <section
    class="not-prose my-8 overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default p-5 shadow-sm sm:p-6"
    :aria-labelledby="headingId"
  >
    <div class="mb-4 flex items-start gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon name="mdi:head-question-outline" class="size-5" />
      </span>
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-primary">{{ $t('articles.quiz.label') }}</p>
        <div :id="headingId" role="heading" aria-level="4" class="text-lg font-semibold text-highlighted">
          {{ quiz.question }}
        </div>
      </div>
    </div>

    <ul class="space-y-2.5">
      <li v-for="opt in quiz.options" :key="opt.id ?? opt.label">
        <div
          v-if="hasVoted"
          class="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm"
          :class="answeredStyle(opt).row"
        >
          <UIcon :name="answeredStyle(opt).icon" class="size-5 shrink-0" :class="answeredStyle(opt).iconClass" />
          <span class="min-w-0 flex-1">{{ opt.label }}</span>
          <UBadge v-if="selectedOption === opt.id" :color="opt.correct ? 'success' : 'error'" variant="soft" size="sm">
            {{ $t('articles.quiz.yourAnswer') }}
          </UBadge>
          <UBadge v-if="opt.correct" color="success" variant="outline" size="sm">
            {{ $t('articles.quiz.correctAnswer') }}
          </UBadge>
        </div>
        <UButton
          v-else
          color="neutral"
          variant="ghost"
          icon="mdi:circle-outline"
          :disabled="voting || !open"
          class="min-h-11 w-full"
          @click="vote(opt.id)"
        >
          <span class="min-w-0 flex-1 text-left">{{ opt.label }}</span>
        </UButton>
      </li>
    </ul>

    <p v-if="!open" class="mt-4 flex items-center gap-1.5 text-sm text-muted">
      <UIcon name="mdi:lock-outline" class="size-4 shrink-0" />
      {{ $t('articles.quiz.notOpenYet') }}
    </p>

    <div aria-live="polite">
      <div
        v-if="hasVoted && answer"
        class="mt-4 space-y-2 rounded-lg border p-4"
        :class="answeredCorrectly ? 'border-success/40 bg-success/5' : 'border-error/40 bg-error/5'"
      >
        <p class="flex items-start gap-2 font-semibold" :class="answeredCorrectly ? 'text-success' : 'text-error'">
          <UIcon :name="answeredCorrectly ? 'mdi:check-circle' : 'mdi:close-circle'" class="mt-0.5 size-5 shrink-0" />
          {{
            answeredCorrectly ? $t('articles.quiz.correct') : $t('articles.quiz.incorrect', { answer: answer.label })
          }}
        </p>
        <p v-if="quiz.explanation" class="text-sm text-default">{{ quiz.explanation }}</p>
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="mdi:account-group-outline" class="size-4 shrink-0" />
          {{ $t('articles.quiz.correctShare', { percent: percentage(answer.id) }) }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { QuizOptionData } from '~~/shared/utils/polls'

const props = defineProps<{
  quiz: { pollId: string; question: string; options: QuizOptionData[]; explanation: string }
  articleId: string
}>()

const headingId = useId()
const { hasVoted, selectedOption, open, voting, percentage, vote } = usePollVotes({
  articleId: () => props.articleId,
  pollId: () => props.quiz.pollId,
  options: () => props.quiz.options,
})

const ANSWERED_STYLE = {
  correct: { row: 'bg-success/10 text-highlighted', icon: 'mdi:check-circle', iconClass: 'text-success' },
  chosen: { row: 'bg-error/10 text-highlighted', icon: 'mdi:close-circle', iconClass: 'text-error' },
  other: { row: 'text-muted', icon: 'mdi:circle-outline', iconClass: 'text-dimmed' },
}
const answeredStyle = (opt: QuizOptionData) =>
  ANSWERED_STYLE[opt.correct ? 'correct' : selectedOption.value === opt.id ? 'chosen' : 'other']

const answer = computed(() => props.quiz.options.find((o) => o.correct && o.id))
const answeredCorrectly = computed(() => !!answer.value && selectedOption.value === answer.value.id)
</script>
