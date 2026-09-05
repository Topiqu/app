<template>
  <div :class="compact ? 'w-40' : 'w-full'" class="group/uploader" @paste.prevent="onPaste">
    <UFormField :label="$t('common.actions.clickToUpload')" :ui="{ label: 'sr-only' }">
      <UFileUpload
        ref="upload"
        v-model="selectedFile"
        accept="image/*"
        :disabled="disabled || isProcessing"
        :preview="true"
        position="inside"
        icon="mdi:cloud-upload-outline"
        :label="previewUrl ? $t('common.actions.change') : $t('common.actions.clickToUpload')"
        :description="`${$t('common.labels.orDrag')} · ${$t('common.labels.pasteImage')} (Ctrl+V)`"
        reset
        :class="compact ? 'size-40' : 'w-full'"
        :ui="uploadUi"
        @update:modelValue="onFileSelected"
      >
        <template v-if="previewUrl && !selectedFile" #leading>
          <AppMedia
            :src="previewUrl"
            :alt="$t('articles.articleCard.imageAlt')"
            :aspectRatio="resolvedAspectRatio"
            fit="contain"
            sizes="100vw sm:640px"
            :containerClass="
              compact ? 'size-20 rounded-[var(--ui-radius)]' : 'h-36 w-56 max-w-full rounded-[var(--ui-radius)]'
            "
          />
        </template>
        <template #file>
          <div class="flex w-full flex-col items-center gap-3">
            <AppMedia
              :src="previewUrl"
              :alt="$t('articles.articleCard.imageAlt')"
              :aspectRatio="resolvedAspectRatio"
              fit="contain"
              sizes="100vw sm:640px"
              :containerClass="
                compact ? 'size-20 rounded-[var(--ui-radius)]' : 'h-36 w-56 max-w-full rounded-[var(--ui-radius)]'
              "
            />
            <span v-if="selectedFile" class="max-w-full truncate text-sm font-medium text-highlighted">
              {{ selectedFile.name }}
            </span>
            <UProgress v-if="isProcessing" class="w-full" />
          </div>
        </template>
      </UFileUpload>
    </UFormField>

    <div v-if="previewUrl" class="mt-2 flex items-center justify-end gap-2">
      <UButton type="button" color="neutral" variant="soft" size="sm" icon="mdi:refresh" @click="openPicker">
        {{ $t('common.actions.change') }}
      </UButton>
      <UButton
        type="button"
        color="error"
        variant="soft"
        size="sm"
        square
        icon="mdi:delete"
        :aria-label="$t('common.remove')"
        @click="cancelUpload"
      />
    </div>

    <div v-if="!compact && !previewUrl && !isProcessing" class="mt-2 flex flex-wrap gap-2">
      <UBadge v-for="(info, i) in constraintInfo" :key="i" color="neutral" variant="subtle" size="sm">
        {{ info }}
      </UBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ (e: 'upload', payload: { url: string; optimizedUrl: string }): void }>()
const props = defineProps<{
  imageUrl?: string | null
  type?: 'client-logo' | 'client-favicon' | 'user-avatar' | 'article-image' | 'emoji'
  shortcode?: string
  disabled?: boolean
  isAiUser?: boolean
  compact?: boolean
  aspectRatio?: string
  maxSize?: number
  minSize?: number
  maxWidth?: number
  maxHeight?: number
  minWidth?: number
  minHeight?: number
}>()

const toast = useToast()
const previewUrl = ref(props.imageUrl || null)
const selectedFile = shallowRef<File | null>(null)
const isProcessing = shallowRef(false)
const upload = useTemplateRef<{ inputRef?: HTMLInputElement }>('upload')
const openPicker = () => upload.value?.inputRef?.click()
const resolvedAspectRatio = computed(() => props.aspectRatio || (props.compact ? '1 / 1' : '16 / 9'))
const uploadUi = computed(() =>
  props.compact
    ? {
        root: 'size-40',
        base: 'size-40 flex-none p-2',
        wrapper: 'gap-2 p-0',
        label: 'text-xs',
        description: 'hidden',
        files: 'w-full',
        file: 'w-full p-0',
      }
    : {
        base: 'min-h-48',
        wrapper: 'w-full',
        files: 'w-full',
        file: 'w-full',
      },
)

watch(
  () => props.imageUrl,
  (val) => (previewUrl.value = val || null),
)

const formatBytes = (bytes: number) =>
  bytes < 1e6 ? `${Math.round(bytes / 1e3)} kB` : `${(bytes / 1e6).toFixed(1)} MB`

const constraints = computed(() => {
  const defaults =
    {
      'client-logo': { maxWidth: 3840, maxHeight: 2160, maxSize: 8e6 },
      'client-favicon': {
        minWidth: FAVICON_MIN_SIZE,
        minHeight: FAVICON_MIN_SIZE,
        maxWidth: FAVICON_MAX_SIZE,
        maxHeight: FAVICON_MAX_SIZE,
        maxSize: FAVICON_MAX_BYTES,
      },
      'user-avatar': { maxWidth: 3840, maxHeight: 2160, maxSize: 5e6 },
      'article-image': { maxWidth: 3840, maxHeight: 2160, minWidth: 300, minHeight: 200, maxSize: 5e6 },
      emoji: { maxWidth: 128, maxHeight: 128, maxSize: 1e6 },
    }[props.type || 'article-image'] || {}
  return { ...defaults, ...props }
})

const constraintInfo = computed(() => {
  const c = constraints.value
  return [
    c.maxSize && `Max ${formatBytes(c.maxSize)}`,
    (c.maxWidth || c.maxHeight) && `${c.maxWidth || '∞'}×${c.maxHeight || '∞'}px`,
  ].filter(Boolean)
})

const cancelUpload = () => {
  previewUrl.value = null
  selectedFile.value = null
  emit('upload', { url: '', optimizedUrl: '' })
}

// Resolves null instead of rejecting: a file the browser cannot decode must surface a reason, not hang the promise.
const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })

const rejectionReason = async (file: File, src: string) => {
  const c = constraints.value
  const isFavicon = props.type === 'client-favicon'

  if (!file.type.startsWith('image/')) return $t('common.upload.notImage')
  if (isFavicon && !isFaviconMimeType(file.type))
    return $t('common.upload.formatNotAllowed', { actual: file.type.replace('image/', '').toUpperCase() })
  if (c.maxSize && file.size > c.maxSize)
    return $t('common.upload.tooLarge', { actual: formatBytes(file.size), limit: formatBytes(c.maxSize) })
  if (c.minSize && file.size < c.minSize)
    return $t('common.upload.tooSmall', { actual: formatBytes(file.size), limit: formatBytes(c.minSize) })

  const image = await loadImage(src)
  if (!image) return $t('common.upload.unreadable')

  const { naturalWidth: width, naturalHeight: height } = image
  const actual = `${width} × ${height}`
  if (isFavicon && width !== height) return $t('common.upload.notSquare', { actual })
  if ((c.maxWidth && width > c.maxWidth) || (c.maxHeight && height > c.maxHeight))
    return $t('common.upload.dimensionsTooLarge', { actual, limit: `${c.maxWidth ?? '∞'} × ${c.maxHeight ?? '∞'}` })
  if ((c.minWidth && width < c.minWidth) || (c.minHeight && height < c.minHeight))
    return $t('common.upload.dimensionsTooSmall', { actual, limit: `${c.minWidth ?? 0} × ${c.minHeight ?? 0}` })
  return null
}

const handleFile = async (file: File) => {
  if (props.disabled) return

  const objectUrl = URL.createObjectURL(file)
  const reason = await rejectionReason(file, objectUrl)
  if (reason) {
    URL.revokeObjectURL(objectUrl)
    selectedFile.value = null
    toast.add({
      color: 'error',
      icon: 'mdi:image-off-outline',
      title: $t('common.upload.rejected'),
      description: reason,
      duration: 8000,
    })
    return
  }

  const c = constraints.value
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
    toast.add({
      color: 'error',
      icon: 'mdi:cloud-off-outline',
      title: $t('common.avatar.uploadError'),
      description: e?.data?.message || e?.message,
      duration: 8000,
    })
    previewUrl.value = props.imageUrl || null
    selectedFile.value = null
    URL.revokeObjectURL(objectUrl)
  } finally {
    isProcessing.value = false
  }
}

const onPaste = (e: ClipboardEvent) => {
  if (props.disabled) return
  const items = e.clipboardData?.items
  if (!items) return
  const file = [...items].find((x) => x.type.startsWith('image'))?.getAsFile()
  if (file) handleFile(file)
}

const onFileSelected = (file: File | null | undefined) => file && handleFile(file)
</script>
