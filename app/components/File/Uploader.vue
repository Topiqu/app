<template>
  <div class="flex flex-col gap-4">
    <div v-if="previewUrl" class="flex justify-center items-center bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
      <NuxtImg
        :src="previewUrl"
        class="max-w-xs max-h-40 object-contain rounded-xl shadow-md border border-gray-200 dark:border-gray-500 transition-all duration-300 hover:scale-105"
        alt="Náhled obrázku"
      />
    </div>

    <div class="flex gap-4 items-center">
      <div
        class="relative flex flex-col justify-center items-center border-2 border-dashed border-gray-300 p-6 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all duration-200 dark:border-gray-500 dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
        :class="{
          'border-blue-500 dark:border-blue-400 shadow-md animate-pulse': isDragging && !disabled,
          'opacity-50 cursor-not-allowed': disabled,
        }"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
        @click="disabled ? null : openFileDialog"
      >
        <Icon
          name="mdi:upload"
          class="w-10 h-10 mb-2 text-gray-500 dark:text-gray-300 transition-all duration-200"
          :class="{ 'text-blue-500 dark:text-blue-400 animate-bounce': isDragging && !disabled }"
        />
        <span class="font-semibold">Vyber</span> nebo přetáhni obrázek
      </div>
      <button
        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200"
        :disabled="isProcessing || disabled"
        @click="openFileDialog"
      >
        Nahrát obrázek
      </button>
    </div>
    <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onFileChange" />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['upload'])
const props = defineProps<{
  imageUrl?: string | null
  type?: 'client-logo' | 'user-avatar' | 'article-image' | 'emoji'
  shortcode?: string
  disabled?: boolean
  isAiUser?: boolean
}>()
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
  if (isProcessing.value || props.disabled || !fileInputRef.value) return
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
  if (props.disabled) return
  e.preventDefault()
  isDragging.value = true
}

const onDragEnter = (e: DragEvent) => {
  if (props.disabled) return
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
  formData.append('type', props.type || 'article-image')
  if (props.shortcode && props.type === 'emoji') formData.append('shortcode', props.shortcode)
  if (props.isAiUser) formData.append('isAiUser', 'true')
  try {
    const { url } = await $fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    emit('upload', { url })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Chyba při nahrávání' })
  } finally {
    if (fileInputRef.value) fileInputRef.value.value = ''
    isProcessing.value = false
  }
}

const onDrop = async (e: DragEvent) => {
  if (props.disabled) return
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await uploadFile(file)
}

const onFileChange = async (e: Event) => {
  if (props.disabled) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && !isProcessing.value) {
    await uploadFile(file)
  }
  if (input) input.value = ''
}
</script>
