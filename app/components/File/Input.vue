<template>
  <div>
    <input v-if="show" ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileChange" />
    <Icon
      name="mdi-image-plus"
      class="p-1 text-gray-800 rounded inline-flex items-center justify-center"
      @click="open"
    />
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  uploadImage: (e: Event) => Promise<void>
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const show = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const open = () => {
  if (show.value) return
  show.value = true
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  await props.uploadImage(e)
  show.value = false
  emit('close')
}

defineExpose({ open })
</script>
