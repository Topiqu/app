<template>
  <div class="flex flex-col gap-4">
    <input type="file" accept="image/*" @change="onFileChange" />
    <img v-if="previewUrl" :src="previewUrl" class="w-40 rounded-xl" />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['upload'])

const previewUrl = ref<string | null>(null)

const onFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  previewUrl.value = URL.createObjectURL(file)

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (data.url) emit('upload', { url: data.url })
}
</script>
