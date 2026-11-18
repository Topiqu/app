<template>
  <node-view-wrapper
    class="not-prose group relative my-6 flex w-full max-w-full flex-col gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm transition-colors sm:p-5"
    contenteditable="false"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span
        data-drag-handle
        draggable="true"
        class="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-lg bg-primary/10 text-primary active:cursor-grabbing"
        :title="$t('articles.quiz.label')"
      >
        <UIcon name="i-mdi-head-question-outline" class="size-5" />
      </span>
      <UInput
        :modelValue="node.attrs.question"
        :aria-label="$t('articles.quiz.question')"
        :maxlength="500"
        :placeholder="$t('articles.poll.questionPlaceholder')"
        size="xl"
        class="min-w-0 flex-1"
        :ui="{ base: 'font-semibold text-highlighted' }"
        @update:modelValue="updateAttributes({ question: String($event ?? '') })"
        @click.stop
        @mousedown.stop
        @focus.stop
      />
      <UButton
        square
        size="sm"
        color="error"
        variant="ghost"
        icon="i-mdi-trash-can-outline"
        class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="$t('articles.quiz.delete')"
        :title="$t('articles.quiz.delete')"
        @click.stop.prevent="deleteNode()"
        @mousedown.stop.prevent
      />
    </div>

    <fieldset class="space-y-2">
      <legend class="mb-2 text-sm font-medium text-muted">{{ $t('articles.quiz.options') }}</legend>
      <div
        v-for="(opt, i) in options"
        :key="i"
        class="flex items-center gap-2 rounded-lg border p-2 transition-colors"
        :class="
          opt.correct ? 'border-success/50 bg-success/5' : 'border-default bg-elevated/40 hover:border-primary/40'
        "
      >
        <input
          type="radio"
          :name="radioName"
          :checked="!!opt.correct"
          :aria-label="$t('articles.quiz.markCorrect', { index: i + 1 })"
          class="size-5 shrink-0 cursor-pointer accent-(--ui-success)"
          @change="markCorrect(i)"
          @click.stop
          @mousedown.stop
        />
        <UInput
          :modelValue="opt.label"
          :aria-label="$t('articles.poll.option', { index: i + 1 })"
          :maxlength="255"
          :placeholder="$t('articles.poll.optionPlaceholder')"
          variant="none"
          class="min-w-0 flex-1"
          :ui="{ base: 'bg-transparent text-highlighted' }"
          @update:modelValue="setLabel(i, String($event ?? ''))"
          @click.stop
          @mousedown.stop
          @focus.stop
        />
        <UBadge v-if="opt.correct" color="success" variant="soft" size="sm" icon="i-mdi-check" class="shrink-0">
          {{ $t('articles.quiz.correctAnswer') }}
        </UBadge>
        <UButton
          v-if="options.length > QUIZ_MIN_OPTIONS"
          square
          size="sm"
          color="error"
          variant="ghost"
          icon="i-mdi-close"
          class="shrink-0"
          :aria-label="$t('articles.quiz.removeOption', { index: i + 1 })"
          :title="$t('articles.quiz.removeOption', { index: i + 1 })"
          @click.stop.prevent="remove(i)"
          @mousedown.stop.prevent
        />
      </div>
    </fieldset>

    <p v-if="!hasAnswer" class="flex items-center gap-1.5 text-sm text-warning" aria-live="polite">
      <UIcon name="i-mdi-alert-outline" class="size-4 shrink-0" />
      {{ $t('articles.quiz.correctMissing') }}
    </p>

    <UButton
      v-if="options.length < QUIZ_MAX_OPTIONS"
      color="primary"
      variant="soft"
      icon="i-mdi-plus"
      class="w-full justify-center rounded-lg border border-dashed border-default shadow-none hover:border-primary/50"
      @click.stop.prevent="add"
      @mousedown.stop.prevent
    >
      {{ $t('articles.poll.addOption') }}
    </UButton>

    <UFormField :label="$t('articles.quiz.explanation')" :help="$t('articles.quiz.explanationHelp')">
      <UTextarea
        :modelValue="node.attrs.explanation ?? ''"
        :rows="2"
        :maxlength="1000"
        autoresize
        class="w-full"
        @update:modelValue="updateAttributes({ explanation: String($event ?? '') })"
        @click.stop
        @mousedown.stop
        @focus.stop
      />
    </UFormField>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

import { QUIZ_MAX_OPTIONS, QUIZ_MIN_OPTIONS, type QuizOptionData } from '../shared/utils/polls'

// Read through `props.node` on every render: Tiptap swaps in a new node (e.g. ids stamped on save),
// so a copy taken at setup would write stale options back on the next keystroke.
const props = defineProps(nodeViewProps)

const radioName = useId()
const options = computed<QuizOptionData[]>(() => props.node.attrs.options ?? [])
// The stored HTML drops an option without text, so a blank correct option is no answer at all.
const hasAnswer = computed(() => options.value.some((o) => o.correct && o.label.trim()))

const setOptions = (next: QuizOptionData[]) => props.updateAttributes({ options: next })

const withCorrect = (opts: QuizOptionData[], correctIndex: number) =>
  opts.map(({ correct: _, ...o }, idx) => (idx === correctIndex ? { ...o, correct: true } : o))

const setLabel = (index: number, label: string) =>
  setOptions(options.value.map((o, idx) => (idx === index ? { ...o, label } : o)))

const markCorrect = (index: number) => setOptions(withCorrect(options.value, index))

const add = () => {
  if (options.value.length < QUIZ_MAX_OPTIONS) setOptions([...options.value, { label: '' }])
}

const remove = (index: number) => {
  if (options.value.length <= QUIZ_MIN_OPTIONS) return
  const next = options.value.filter((_, idx) => idx !== index)
  // Removing the answer hands the flag to the first option: a quiz always keeps exactly one.
  setOptions(options.value[index]?.correct ? withCorrect(next, 0) : next)
}
</script>
