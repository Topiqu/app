<template>
  <form
    :aria-label="$t('articles.editor.aiEdit.label')"
    class="flex w-96 max-w-full min-w-0 items-center gap-2"
    @submit.prevent.stop="submit"
    @keydown.esc.prevent.stop="!pending && emit('cancel')"
  >
    <UButton
      type="button"
      icon="mdi:arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :aria-label="$t('common.actions.back')"
      :title="$t('common.actions.back')"
      :disabled="pending"
      class="shrink-0"
      @mousedown.prevent
      @click="emit('cancel')"
    />
    <UInput
      v-model="instruction"
      autofocus
      variant="none"
      :maxlength="TEXT_EDIT_INSTRUCTION_MAX_LENGTH"
      :aria-label="$t('articles.editor.aiEdit.instructionLabel')"
      :placeholder="$t('articles.editor.aiEdit.instructionLabel')"
      :disabled="pending"
      :ui="{ base: 'h-9 px-0 text-sm' }"
      class="min-w-0 flex-1"
      @keydown.ctrl.enter.prevent.stop="submit"
      @keydown.meta.enter.prevent.stop="submit"
    />
    <UButton
      type="submit"
      icon="mdi:arrow-up"
      size="sm"
      square
      :aria-label="$t('articles.editor.aiEdit.apply')"
      :title="$t('articles.editor.aiEdit.apply')"
      :loading="pending"
      :disabled="!canSubmit"
      class="shrink-0"
    />
  </form>
</template>

<script setup lang="ts">
import { TEXT_EDIT_INSTRUCTION_MAX_LENGTH } from '~~/shared/utils/aiEdit'

const { pending = false } = defineProps<{ pending?: boolean }>()
const emit = defineEmits<{ submit: [instruction: string]; cancel: [] }>()
const instruction = shallowRef('')
const canSubmit = computed(() => !pending && Boolean(instruction.value.trim()))
const submit = () => {
  if (canSubmit.value) emit('submit', instruction.value.trim())
}
</script>
