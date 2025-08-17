<template>
  <div class="flex flex-col gap-4">
    <div v-if="previewUrl">
      <NuxtImg
        :src="previewUrl"
        class="w-24 h-24 object-cover rounded-xl shadow-md border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:shadow-lg"
        alt="Náhled obrázku"
      />
    </div>

    <div
      class="relative flex flex-col justify-center items-center border-2 border-dashed border-gray-300 p-5 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all duration-200 dark:border-gray-600 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
      :class="{ 'bg-gray-100 border-blue-500 shadow-md dark:bg-gray-700 dark:border-blue-400': isDragging }"
      @dragover.prevent="onDragOver"
      @dragenter.prevent="onDragEnter"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
      @click="openFileDialog"
    >
      <Icon
        name="mdi:upload"
        class="w-7 h-7 mb-2 text-gray-500 dark:text-gray-400 transition-colors duration-200"
        :class="{ 'text-blue-500 dark:text-blue-400': isDragging }"
      />
      Vyber nebo přetáhni obrázek
    </div>

    <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onFileChange" />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['upload'])
const props = defineProps<{ imageUrl?: string | null }>()
const toast = useToast()

const previewUrl = shallowRef<string | null>(props.imageUrl || null)
const fileInputRef = useTemplateRef('fileInputRef')
const isDragging = shallowRef(false)
const isProcessing = shallowRef(false)

watch(
  () => props.imageUrl,
  (newUrl) => {
    previewUrl.value = newUrl || null
  },
)

const openFileDialog = (e?: MouseEvent) => {
  if (isProcessing.value || !fileInputRef.value) return
  e?.stopPropagation()
  e?.preventDefault()
  isProcessing.value = true
  fileInputRef.value.value = ''
  fileInputRef.value.click()
  setTimeout(() => {
    isProcessing.value = false
  }, 1000)
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragEnter = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const onDragLeave = () => {
  isDragging.value = false
}

const uploadFile = async (file: File) => {
  if (!file || !file.type.startsWith('image/')) {
    toast.error({ message: 'Vyberte platný obrázek' })
    isProcessing.value = false
    return
  }
  previewUrl.value = URL.createObjectURL(file)
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (data.url) {
      emit('upload', { url: data.url })
    } else {
      toast.error({ message: 'Chyba při nahrávání obrázku' })
    }
  } catch (e: any) {
    toast.error({ message: `Chyba při nahrávání: ${e.message}` })
  } finally {
    if (fileInputRef.value) fileInputRef.value.value = ''
    isProcessing.value = false
  }
}

const onDrop = async (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await uploadFile(file)
}

const onFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && !isProcessing.value) {
    await uploadFile(file)
  }
  if (input) input.value = ''
}
</script>
