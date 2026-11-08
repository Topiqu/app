<template>
  <section
    v-if="entries.length"
    :aria-labelledby="`${id}-title`"
    class="mt-10 flex flex-col gap-4 border-t border-default pt-6"
  >
    <h2 :id="`${id}-title`" class="text-lg font-medium text-highlighted">{{ $t('articles.faq') }}</h2>
    <ol class="flex flex-col gap-4">
      <li v-for="(entry, index) in entries" :key="index" class="flex items-start gap-2">
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <UInput
            :id="`${id}-question-${index}`"
            :modelValue="entry.question"
            :maxlength="300"
            :disabled
            :placeholder="$t('articles.editor.faq.questionPlaceholder')"
            :aria-label="$t('articles.editor.faq.question', { n: index + 1 })"
            class="w-full"
            @update:modelValue="update(index, { question: String($event ?? '') })"
          />
          <UTextarea
            :modelValue="entry.answer"
            :maxlength="1500"
            :rows="2"
            :disabled
            :placeholder="$t('articles.editor.faq.answerPlaceholder')"
            :aria-label="$t('articles.editor.faq.answer', { n: index + 1 })"
            class="w-full"
            autoresize
            @update:modelValue="update(index, { answer: String($event ?? '') })"
          />
        </div>
        <UButton
          icon="mdi:delete-outline"
          color="neutral"
          variant="ghost"
          square
          :disabled
          :aria-label="$t('articles.editor.faq.remove', { n: index + 1 })"
          @click="remove(index)"
        />
      </li>
    </ol>
    <UButton
      v-if="!disabled && entries.length < MAX_ENTRIES"
      icon="mdi:plus"
      color="neutral"
      variant="soft"
      size="sm"
      class="self-start"
      @click="add"
    >
      {{ $t('articles.editor.faq.add') }}
    </UButton>
  </section>
  <UButton v-else-if="!disabled" icon="mdi:plus" color="neutral" variant="soft" size="sm" class="mt-10" @click="add">
    {{ $t('articles.editor.faq.add') }}
  </UButton>
</template>

<script setup lang="ts">
import type { FaqEntry } from '~~/shared/utils/articleFaq'

const MAX_ENTRIES = 10

// Replaced, never mutated in place: the parent snapshots the list before a save.
const entries = defineModel<FaqEntry[]>({ required: true })
const { disabled = false } = defineProps<{ disabled?: boolean }>()

const id = useId()

const update = (index: number, change: Partial<FaqEntry>) => {
  entries.value = entries.value.map((entry, at) => (at === index ? { ...entry, ...change } : entry))
}
const remove = (index: number) => {
  entries.value = entries.value.filter((_, at) => at !== index)
}
const add = async () => {
  const index = entries.value.length
  entries.value = [...entries.value, { question: '', answer: '' }]
  await nextTick()
  document.getElementById(`${id}-question-${index}`)?.focus()
}
</script>
