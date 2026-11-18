<template>
  <node-view-wrapper
    class="not-prose group relative my-6 flex w-full max-w-full flex-col gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm transition-colors sm:p-5"
    contenteditable="false"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UIcon name="i-mdi-poll" class="size-5" />
      </span>
      <UInput
        :modelValue="node.attrs.question"
        :aria-label="$t('articles.poll.questionPlaceholder')"
        :placeholder="$t('articles.poll.questionPlaceholder')"
        size="xl"
        class="min-w-0 flex-1"
        :ui="{ base: 'font-semibold text-highlighted' }"
        @update:modelValue="update({ question: String($event ?? '') })"
        @blur="node.attrs.question?.trim() || update({ question: $t('articles.poll.defaultQuestion') })"
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
        :aria-label="$t('common.delete')"
        :title="$t('common.delete')"
        @click.stop.prevent="deleteNode()"
        @mousedown.stop.prevent
      />
    </div>

    <div class="space-y-2">
      <div
        v-for="(opt, i) in options"
        :key="i"
        class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 p-2 transition-colors hover:border-primary/40 hover:bg-elevated"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary"
        >
          {{ i + 1 }}
        </span>
        <UInput
          :modelValue="opt.label"
          :aria-label="$t('articles.poll.option', { index: i + 1 })"
          :placeholder="$t('articles.poll.optionPlaceholder')"
          variant="none"
          class="min-w-0 flex-1"
          :ui="{ base: 'bg-transparent text-highlighted' }"
          @update:modelValue="setLabel(i, String($event ?? ''))"
          @click.stop
          @mousedown.stop
          @focus.stop
        />

        <UButton
          v-if="options.length > 1"
          square
          size="sm"
          color="error"
          variant="ghost"
          icon="i-mdi-close"
          class="shrink-0"
          :aria-label="$t('common.delete')"
          :title="$t('common.delete')"
          @click.stop.prevent="remove(i)"
          @mousedown.stop.prevent
        />
      </div>
    </div>

    <UButton
      color="primary"
      variant="soft"
      icon="i-mdi-plus"
      class="w-full justify-center rounded-lg border border-dashed border-default shadow-none hover:border-primary/50"
      @click.stop.prevent="add"
      @mousedown.stop.prevent
    >
      {{ $t('articles.poll.addOption') }}
    </UButton>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

import type { PollOptionData } from '../shared/utils/polls'

// Read through `props.node` on every render: Tiptap swaps in a new node on undo, a content reload or
// ids stamped on save, and a copy taken at setup kept showing (and writing back) the old options.
// Text is stored as typed, so spaces survive mid-word; `renderHTML` trims it, and an emptied question
// gets its default on blur rather than while the author is retyping it.
const props = defineProps(nodeViewProps)
const { deleteNode } = props

const options = computed<PollOptionData[]>(() =>
  props.node.attrs.options?.length ? props.node.attrs.options : [{ label: $t('articles.poll.defaultOption') }],
)

const update = (attrs: { question?: string; options?: PollOptionData[] }) =>
  props.updateAttributes({ id: props.node.attrs.id || crypto.randomUUID(), ...attrs })

const setLabel = (index: number, label: string) =>
  update({ options: options.value.map((option, i) => (i === index ? { ...option, label } : option)) })

const add = () => update({ options: [...options.value, { label: '' }] })

const remove = (index: number) => {
  if (options.value.length > 1) update({ options: options.value.filter((_, i) => i !== index) })
}
</script>
