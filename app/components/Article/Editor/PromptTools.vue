<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <UDropdownMenu :items="items" :content="{ align: 'start' }" :disabled="!prompt.trim() || pending !== null">
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="mdi:creation-outline"
          trailingIcon="mdi:chevron-down"
          :loading="pending !== null"
          :disabled="!prompt.trim() || pending !== null"
        >
          {{ $t('articles.editor.aiEdit.prompt.label') }}
        </UButton>
      </UDropdownMenu>
      <UButton v-if="previous !== null" size="xs" color="neutral" variant="ghost" icon="mdi:undo-variant" @click="undo">
        {{ $t('articles.editor.aiEdit.undo') }}
      </UButton>
    </div>

    <form
      v-if="questions.length"
      class="flex flex-col gap-3 rounded-md border border-default bg-elevated/40 p-3"
      @submit.prevent="applyAnswers"
    >
      <p class="text-xs leading-5 text-muted">{{ $t('articles.editor.aiEdit.prompt.questionsHint') }}</p>
      <UFormField v-for="(question, index) in questions" :key="question" :label="question">
        <UInput v-model="answers[index]" class="w-full" />
      </UFormField>
      <div class="flex justify-end gap-2">
        <UButton size="sm" color="neutral" variant="ghost" @click="questions = []">
          {{ $t('common.actions.cancel') }}
        </UButton>
        <UButton size="sm" type="submit" :disabled="!answers.some((answer) => answer?.trim())">
          {{ $t('articles.editor.aiEdit.prompt.applyAnswers') }}
        </UButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ArticleGenerationFormat } from '~~/shared/utils/articleGeneration'

import { PROMPT_EDIT_ACTIONS, type PromptEditAction } from '~~/shared/utils/aiEdit'

const { format } = defineProps<{ format: ArticleGenerationFormat }>()
const prompt = defineModel<string>({ required: true })

const { t } = useI18n()
const toast = useToast()
const pending = shallowRef<PromptEditAction | null>(null)
const previous = shallowRef<string | null>(null)
const questions = shallowRef<string[]>([])
const answers = ref<string[]>([])

// Undo restores the text before the AI edit; once the author types, that snapshot is stale.
let applied: string | null = null
const replacePrompt = (next: string) => {
  previous.value = prompt.value
  applied = next
  prompt.value = next
}
watch(prompt, (value) => {
  if (value !== applied) previous.value = null
})

const run = async (action: PromptEditAction) => {
  pending.value = action
  try {
    const result = await $fetch<{ prompt?: string; questions?: string[] }>('/api/articles/generate/enhance', {
      method: 'POST',
      body: { prompt: prompt.value, action, format },
    })
    if (result.questions) {
      questions.value = result.questions
      answers.value = result.questions.map(() => '')
    } else if (result.prompt) replacePrompt(result.prompt)
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.aiEdit.failed')) })
  } finally {
    pending.value = null
  }
}

const items = computed<DropdownMenuItem[]>(() =>
  PROMPT_EDIT_ACTIONS.map((action) => ({
    label: t(`articles.editor.aiEdit.prompt.${action}`),
    onSelect: () => run(action),
  })),
)

// Answers join the brief as the author's own statements, which the writer treats as testimony.
const applyAnswers = () => {
  const lines = questions.value.flatMap((question, index) => {
    const answer = answers.value[index]?.trim()
    return answer ? [`- ${question} ${answer}`] : []
  })
  replacePrompt(`${prompt.value.trim()}\n\n${t('articles.editor.aiEdit.prompt.answersHeading')}\n${lines.join('\n')}`)
  questions.value = []
}

const undo = () => {
  if (previous.value === null) return
  applied = previous.value
  prompt.value = previous.value
  previous.value = null
}
</script>
