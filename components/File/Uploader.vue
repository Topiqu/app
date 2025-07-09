<template>
  <div class="flex flex-col gap-4">
    <div v-if="previewUrl">
      <img
        :src="previewUrl"
        class="w-20 h-20 object-cover rounded-md shadow-md"
        alt="Preview"
      />
    </div>

    <button
      class="upload-input border-2 border-dashed border-gray-300 p-3 rounded-md text-center hover:bg-gray-100 transition-colors"
      @click="openFileDialog"
    >
      Vyber nebo přetáhni obrázek
    </button>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['upload'])

const previewUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const openFileDialog = () => {
  fileInputRef.value?.click()
}

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

<style scoped>
.upload-input {
  transition: background-color 0.2s;
}
.upload-input:hover {
  background-color: #f3f4f6;
}
</style>
