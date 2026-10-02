<template>
  <form
    class="w-full min-w-0 space-y-3"
    @submit.prevent.stop="submit"
    @keydown.esc.prevent.stop="!pending && emit('cancel')"
  >
    <UFormField :label="$t('articles.editor.aiEdit.instructionLabel')">
      <UTextarea
        v-model="instruction"
        autofocus
        :rows="3"
        :maxlength="TEXT_EDIT_INSTRUCTION_MAX_LENGTH"
        :placeholder="$t('articles.editor.aiEdit.instructionPlaceholder')"
        :disabled="pending"
        :ui="{ base: 'resize-none bg-default text-sm leading-relaxed' }"
        class="w-full"
        @keydown.ctrl.enter.prevent.stop="submit"
        @keydown.meta.enter.prevent.stop="submit"
      />
    </UFormField>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-muted">{{ $t(`articles.editor.aiEdit.scope.${scope}`) }}</span>
      <div class="flex shrink-0 gap-1">
        <UButton type="button" color="neutral" variant="ghost" size="sm" :disabled="pending" @click="emit('cancel')">
          {{ $t('common.actions.cancel') }}
        </UButton>
        <UButton type="submit" icon="mdi:creation-outline" size="sm" :loading="pending" :disabled="!canSubmit">
          {{ $t('articles.editor.aiEdit.apply') }}
        </UButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { TEXT_EDIT_INSTRUCTION_MAX_LENGTH } from '~~/shared/utils/aiEdit'

const { pending = false } = defineProps<{ scope: 'selection' | 'document'; pending?: boolean }>()
const emit = defineEmits<{ submit: [instruction: string]; cancel: [] }>()

const instruction = shallowRef('')
const canSubmit = computed(() => !pending && Boolean(instruction.value.trim()))
const submit = () => {
  if (canSubmit.value) emit('submit', instruction.value.trim())
}
</script>
