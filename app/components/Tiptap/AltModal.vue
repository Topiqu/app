<template>
  <ModalMini
    v-model:open="isOpen"
    :title="$t('articles.editor.altModal.title')"
    icon="mdi:image-text"
    :confirmText="$t('common.actions.saveChanges')"
    :cancelText="$t('common.close')"
    @confirm="confirm"
    @cancel="cancel"
  >
    <template #content>
      <FormInput
        v-model="alt"
        :placeholder="$t('articles.editor.altModal.placeholder')"
        :maxLength="200"
        @keydown.enter.prevent.stop="confirm"
      />
    </template>
  </ModalMini>
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
