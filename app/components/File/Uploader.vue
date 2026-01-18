<template>
  <div class="w-full group/uploader" @paste.prevent="onPaste">
    <transition name="fade" mode="out-in">
      <div
        v-if="previewUrl"
        class="relative w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm group/preview"
      >
        <div
          class="absolute inset-0 bg-cover bg-center blur-xl opacity-50 dark:opacity-30"
          :style="{ backgroundImage: `url(${previewUrl})` }"
        />

        <div class="relative z-10 p-6 flex flex-col items-center gap-4">
          <NuxtImg
            :src="previewUrl"
            class="max-h-64 w-auto object-contain rounded-lg shadow-lg ring-1 ring-black/5"
            :alt="$t('articles.articleCard.imageAlt')"
          />

          <div class="flex gap-2">
            <Button
              variant="neutral"
              size="sm"
              icon="mdi:refresh"
              class="bg-white/90 backdrop-blur hover:text-blue-600"
              @click="cancelUpload"
            >
              {{ $t('common.actions.change') }}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon="mdi:delete"
              class="backdrop-blur hover:bg-red-50"
              @click="cancelUpload"
            />
          </div>
        </div>

        <div
          v-if="isProcessing"
          class="absolute inset-0 z-20 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <Icon name="mdi:loading" class="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>

      <div
        v-else-if="isProcessing"
        class="w-full h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse flex flex-col items-center justify-center gap-3 border border-transparent"
      >
        <Icon name="mdi:image-filter-hdr" class="w-10 h-10 text-gray-300 dark:text-gray-600" />
        <span class="text-xs font-medium text-gray-400">{{ $t('common.loading') }}</span>
      </div>

      <div
        v-else
        class="relative w-full h-48 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden"
        :class="[
          isDragging && !disabled
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 scale-[1.01] shadow-lg'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-400',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
        @dragover.prevent="!disabled && (isDragging = true)"
        @dragenter.prevent="!disabled && (isDragging = true)"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="!disabled && open({ accept: 'image/*' })"
      >
        <div
          class="flex flex-col items-center gap-2 text-center p-4 transition-transform duration-300"
          :class="{ 'scale-110': isDragging }"
        >
          <div class="p-3 rounded-full bg-white dark:bg-gray-700 shadow-sm ring-1 ring-gray-100 dark:ring-gray-600">
            <Icon name="mdi:cloud-upload-outline" class="w-6 h-6 text-blue-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {{ $t('common.actions.clickToUpload') }}
              <span class="text-gray-400 font-normal">{{ $t('common.labels.orDrag') }}</span>
            </span>
            <span class="text-xs text-gray-400 mt-1">
              {{ isDragging ? $t('common.actions.dropHere') : `${$t('common.labels.pasteImage')} (Ctrl+V)` }}
            </span>
          </div>
        </div>

        <div class="absolute bottom-3 flex gap-2 opacity-60 hover:opacity-100 transition-opacity">
          <span
            v-for="(info, i) in constraintInfo"
            :key="i"
            class="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {{ info }}
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'upload', payload: { url: string; optimizedUrl: string }): void }>()
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
const { open, onChange, reset } = useFileDialog({ accept: 'image/*', multiple: false })

const previewUrl = ref(props.imageUrl || null)
const isDragging = shallowRef(false)
const isProcessing = shallowRef(false)

watch(
  () => props.imageUrl,
  (val) => (previewUrl.value = val || null),
)

const constraints = computed(() => {
  const defaults =
    {
      'client-logo': { maxWidth: 3840, maxHeight: 2160, maxSize: 8e6 },
      'user-avatar': { maxWidth: 3840, maxHeight: 2160, maxSize: 5e6 },
      'article-image': { maxWidth: 3840, maxHeight: 2160, minWidth: 300, minHeight: 200, maxSize: 5e6 },
      emoji: { maxWidth: 128, maxHeight: 128, maxSize: 1e6 },
    }[props.type || 'article-image'] || {}
  return { ...defaults, ...props }
})

const constraintInfo = computed(() => {
  const c = constraints.value
  return [
    c.maxSize && `Max ${(c.maxSize / 1e6).toFixed(1)}MB`,
    (c.maxWidth || c.maxHeight) && `${c.maxWidth || '∞'}×${c.maxHeight || '∞'}px`,
  ].filter(Boolean)
})

const cancelUpload = () => {
  previewUrl.value = null
  reset()
  emit('upload', { url: '', optimizedUrl: '' })
}

const validate = (condition: boolean, msg: string) => {
  if (condition) {
    toast.error({ message: msg })
    reset()
    return false
  }
  return true
}

const handleFile = async (file: File) => {
  if (props.disabled) return
  if (!validate(!file.type.startsWith('image/'), $t('common.messages.operationFailed'))) return

  const c = constraints.value
  if (!validate(!!c.maxSize && file.size > c.maxSize, `Příliš velký (max ${(c.maxSize! / 1e6).toFixed(1)} MB)`)) return
  if (!validate(!!c.minSize && file.size < c.minSize, `Příliš malý`)) return

  const objectUrl = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((r) => {
    const i = new Image()
    i.onload = () => r(i)
    i.src = objectUrl
  })

  if (
    !validate(
      (!!c.maxWidth && img.width > c.maxWidth) || (!!c.maxHeight && img.height > c.maxHeight),
      `Rozměry příliš velké`,
    )
  )
    return
  if (
    !validate(
      (!!c.minWidth && img.width < c.minWidth) || (!!c.minHeight && img.height < c.minHeight),
      `Rozměry příliš malé`,
    )
  )
    return

  isProcessing.value = true
  previewUrl.value = objectUrl

  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', props.type || 'article-image')

  const { shortcode: _, isAiUser: __, ...cOnly } = c
  Object.entries({ shortcode: props.shortcode, isAiUser: props.isAiUser, ...cOnly }).forEach(
    ([k, v]) => v !== undefined && formData.append(k, String(v)),
  )

  try {
    const { url, optimizedUrl } = await $fetch('/api/upload', { method: 'POST', body: formData })
    emit('upload', { url, optimizedUrl })
  } catch (e: any) {
    toast.error({ message: $t('common.avatar.uploadError') + e.data?.message })
    reset()
  } finally {
    isProcessing.value = false
  }
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

const onPaste = (e: ClipboardEvent) => {
  if (props.disabled) return
  const items = e.clipboardData?.items
  if (!items) return
  const file = [...items].find((x) => x.type.startsWith('image'))?.getAsFile()
  if (file) handleFile(file)
}

onChange((files) => {
  if (files?.[0]) handleFile(files[0])
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
