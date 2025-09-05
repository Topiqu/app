<template>
  <Button icon="mdi-image-plus" @click="open({ accept: 'image/*' })" />
</template>

<script lang="ts" setup>
const props = defineProps<{ uploadImage: (files: FileList | null) => Promise<void> }>()

const emit = defineEmits<{ (e: 'close'): void }>()

const { open, onChange } = useFileDialog()

onChange(async (files) => {
  await props.uploadImage(files)
  emit('close')
})
</script>
