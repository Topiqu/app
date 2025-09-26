<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="previewUrl"
      class="flex flex-col gap-2 justify-center items-center bg-gray-100 dark:bg-gray-700 p-4 rounded-xl"
    >
      <NuxtImg
        :src="previewUrl"
        class="max-w-xs max-h-40 object-contain rounded-xl shadow-md border border-gray-200 dark:border-gray-500 transition-all duration-300 hover:scale-105"
        :alt="$t('articles.articleCard.imageAlt')"
      />
      <Button
        variant="danger"
        size="sm"
        class="flex items-center gap-1 text-red-500 hover:text-red-600"
        @click="cancelUpload"
      >
        <Icon name="mdi:cancel" class="w-5 h-5" />
      </Button>
    </div>

    <div class="flex flex-col gap-4 items-center">
      <div
        class="w-full relative flex flex-col justify-center items-center border-2 border-dashed border-gray-300 p-6 rounded-xl text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all duration-200 dark:border-gray-500 dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 aspect-video"
        :class="{
          'border-blue-500 dark:border-blue-400 shadow-md animate-pulse': isDragging && !disabled,
          'opacity-50 cursor-not-allowed': disabled,
        }"
        @dragover.prevent="onDragOver"
        @dragenter.prevent="onDragEnter"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
        @click="disabled ? null : open({ accept: 'image/*' })"
      >
        <Icon
          name="mdi:upload"
          class="w-10 h-10 mb-2 text-gray-500 dark:text-gray-300 transition-all duration-200"
          :class="{ 'text-blue-500 dark:text-blue-400 animate-bounce': isDragging && !disabled }"
        />
        <span class="font-semibold">{{ $t('common.actions.upload') }}</span>
        {{ $t('common.labels.image') }}
        <div v-if="props.maxSize || props.minSize || props.maxWidth || props.maxHeight || props.minWidth || props.minHeight" class="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          <div v-if="props.maxSize">Max: {{ (props.maxSize / 1024 / 1024).toFixed(1) }} MB</div>
          <div v-if="props.minSize">Min: {{ (props.minSize / 1024).toFixed(0) }} KB</div>
          <div v-if="props.maxWidth || props.maxHeight">Max dim: {{ props.maxWidth || '∞' }}×{{ props.maxHeight || '∞' }}px</div>
          <div v-if="props.minWidth || props.minHeight">Min dim: {{ props.minWidth || 0 }}×{{ props.minHeight || 0 }}px</div>
        </div>
      </div>
      <Button
        :disabled="isProcessing || disabled"
        class="w-full"
        @click="open({ accept: 'image/*' })"
      >
        {{ $t('common.actions.upload') }} {{ $t('common.labels.image') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'upload', payload: { url: string }): void
}>()

const props = defineProps<{
  imageUrl?: string | null
  type?: 'client-logo' | 'user-avatar' | 'article-image' | 'emoji'
  shortcode?: string
  disabled?: boolean
  isAiUser?: boolean
  maxSize?: number
  minSize?: number
  maxWidth?: number
  maxHeight?: number
  minWidth?: number
  minHeight?: number
}>()

const toast = useToast()
const previewUrl = shallowRef<string | null>(props.imageUrl || null)
const isDragging = shallowRef(false)
const isProcessing = shallowRef(false)

watch(
  () => props.imageUrl,
  (newUrl) => {
    previewUrl.value = newUrl || null
  },
)

const { open, onChange, reset } = useFileDialog({ accept: 'image/*', multiple: false })

onChange(async (files) => {
  if (props.disabled || !files || !files[0]) return
  const file = files[0]
  await handleFile(file)
})

const handleFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error({ message: $t('common.messages.operationFailed') })
    reset()
    return
  }
  if (props.maxSize && file.size > props.maxSize) {
    toast.error({
      message: `Soubor je příliš velký (max ${(props.maxSize / 1024 / 1024).toFixed(1)} MB)`,
    })
    reset()
    return
  }
  if (props.minSize && file.size < props.minSize) {
    toast.error({
      message: `Soubor je příliš malý (min ${(props.minSize / 1024).toFixed(0)} KB)`,
    })
    reset()
    return
  }

  const image = new Image()
  const objectUrl = URL.createObjectURL(file)
  image.src = objectUrl
  await new Promise((resolve) => (image.onload = resolve))
  const { width, height } = image
  if (props.maxWidth && width > props.maxWidth || props.maxHeight && height > props.maxHeight) {
    toast.error({
      message: `Rozměry obrázku jsou příliš velké (max ${props.maxWidth || '∞'}×${props.maxHeight || '∞'} px)`,
    })
    reset()
    return
  }
  if (props.minWidth && width < props.minWidth || props.minHeight && height < props.minHeight) {
    toast.error({
      message: `Rozměry obrázku jsou příliš malé (min ${props.minWidth || 0}×${props.minHeight || 0} px)`,
    })
    reset()
    return
  }

  isProcessing.value = true
  previewUrl.value = objectUrl

  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', props.type || 'article-image')
  if (props.shortcode && props.type === 'emoji') formData.append('shortcode', props.shortcode)
  if (props.isAiUser) formData.append('isAiUser', 'true')
  if (props.maxSize) formData.append('maxSize', props.maxSize.toString())
  if (props.minSize) formData.append('minSize', props.minSize.toString())
  if (props.maxWidth) formData.append('maxWidth', props.maxWidth.toString())
  if (props.maxHeight) formData.append('maxHeight', props.maxHeight.toString())
  if (props.minWidth) formData.append('minWidth', props.minWidth.toString())
  if (props.minHeight) formData.append('minHeight', props.minHeight.toString())

  try {
    const { url } = await $fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    emit('upload', { url })
  } catch (e: any) {
    toast.error({ message: $t('common.avatar.uploadError') + e.data?.message })
    reset()
  } finally {
    isProcessing.value = false
  }
}

const cancelUpload = () => {
  previewUrl.value = null
  reset()
  emit('upload', { url: '' })
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

const onDrop = async (e: DragEvent) => {
  if (props.disabled) return
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await handleFile(file)
}
</script>
