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
        v-model="localQuestion"
        :placeholder="$t('articles.poll.questionPlaceholder')"
        size="xl"
        class="min-w-0 flex-1"
        :ui="{ base: 'font-semibold text-highlighted' }"
        @input="syncQuestion"
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
        @click.stop.prevent="deleteNode"
        @mousedown.stop.prevent
      />
    </div>

    <div class="space-y-2">
      <div
        v-for="(opt, i) in localOptions"
        :key="i"
        class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 p-2 transition-colors hover:border-primary/40 hover:bg-elevated"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary"
        >
          {{ i + 1 }}
        </span>
        <UInput
          v-model="opt.label"
          :placeholder="$t('articles.poll.optionPlaceholder')"
          variant="none"
          class="min-w-0 flex-1"
          :ui="{ base: 'bg-transparent text-highlighted' }"
          @input="syncOptions"
          @click.stop
          @mousedown.stop
          @focus.stop
        />

        <UButton
          v-if="localOptions.length > 1"
          square
          size="sm"
          color="error"
          variant="ghost"
          icon="i-mdi-close"
          class="shrink-0"
          :aria-label="$t('common.delete')"
          :title="$t('common.delete')"
          @click.stop.prevent="rm(i)"
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

<script setup>
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { node, updateAttributes, deleteNode } = props

const defaultOption = () => ({ label: $t('articles.poll.defaultOption') })

const localQuestion = shallowRef(node.attrs.question || $t('articles.poll.defaultQuestion'))
const localOptions = ref(node.attrs.options?.length ? node.attrs.options.map((o) => ({ ...o })) : [defaultOption()])
const localId = shallowRef(node.attrs.id || crypto.randomUUID())

const syncQuestion = () => {
  const question = localQuestion.value.trim() || $t('articles.poll.defaultQuestion')
  const validOptions = localOptions.value.length ? localOptions.value : [defaultOption()]
  updateAttributes({ question, id: localId.value, options: validOptions })
}

const syncOptions = () => {
  const validOptions = localOptions.value.length ? localOptions.value : [defaultOption()]
  localOptions.value = validOptions
  updateAttributes({
    question: localQuestion.value.trim() || $t('articles.poll.defaultQuestion'),
    id: localId.value,
    options: validOptions,
  })
}

const add = () => {
  localOptions.value = [...localOptions.value, { label: '' }]
  syncOptions()
}

const rm = (i) => {
  if (localOptions.value.length <= 1) return
  localOptions.value = localOptions.value.filter((_, idx) => idx !== i)
  syncOptions()
}

watch(
  () => node.attrs.question,
  (newVal) => {
    localQuestion.value = newVal || $t('articles.poll.defaultQuestion')
  },
)

watch(
  () => node.attrs.id,
  (newVal) => {
    localId.value = newVal || crypto.randomUUID()
  },
)
</script>
