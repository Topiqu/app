<template>
  <UFormField :label="$t('common.actions.clickToUpload')" :ui="{ label: 'sr-only' }">
    <UFileUpload
      v-model="file"
      accept="image/*"
      :aria-label="$t('common.actions.clickToUpload')"
      :preview="false"
      reset
      @update:modelValue="upload"
    >
      <template #default="{ open }">
        <UButton
          icon="mdi:file-image"
          color="neutral"
          variant="ghost"
          :aria-label="$t('common.actions.clickToUpload')"
          :title="$t('common.actions.clickToUpload')"
          @click="() => open()"
        />
      </template>
    </UFileUpload>
  </UFormField>
</template>

<script lang="ts" setup>
const props = defineProps<{ uploadImage: (files: FileList | null) => Promise<void> }>()

const emit = defineEmits<{ (e: 'close'): void }>()

const file = shallowRef<File | null>(null)
const upload = async (selected: File | null | undefined) => {
  if (!selected) return
  const transfer = new DataTransfer()
  transfer.items.add(selected)
  await props.uploadImage(transfer.files)
  emit('close')
}
</script>
