<template>
  <UModal v-model:open="isOpen" :title="$t('articles.editor.altModal.title')">
    <template #body>
      <UFormField :label="$t('articles.editor.altModal.placeholder')">
        <UInput
          v-model="alt"
          :placeholder="$t('articles.editor.altModal.placeholder')"
          :maxlength="200"
          @keydown.enter.prevent.stop="confirm"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="cancel">{{ $t('common.close') }}</UButton>
        <UButton icon="mdi:check" @click="confirm">{{ $t('common.actions.saveChanges') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const isOpen = defineModel<boolean>('open', { default: false })

const { defaultAlt } = defineProps<{ defaultAlt: string }>()
const emit = defineEmits<{ (e: 'submit', alt: string): void }>()

const alt = shallowRef('')

watch(isOpen, (open) => open && (alt.value = defaultAlt))

const confirm = () => {
  emit('submit', alt.value.trim() || defaultAlt)
  isOpen.value = false
}

const cancel = () => {
  emit('submit', defaultAlt)
  isOpen.value = false
}
</script>
