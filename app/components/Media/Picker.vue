<template>
  <UModal
    v-model:open="open"
    :title="$t('media.choose')"
    :ui="{
      content: 'sm:max-w-6xl',
      body: 'relative h-[min(72dvh,48rem)] min-h-80 flex-none overflow-hidden p-4 sm:p-4',
    }"
  >
    <template #body>
      <div
        class="h-full min-h-0 space-y-4 overflow-y-auto overscroll-contain"
        @dragenter.prevent="enterDrag"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="leaveDrag"
        @drop.prevent="dropFile"
      >
        <MediaLibrary ref="library" selectable :selectedId="selected?.id" @select="select" @inspect="inspect">
          <template #actions>
            <UButton color="neutral" variant="soft" icon="mdi:cloud-upload-outline" @click="openUploadPicker">
              {{ $t('media.upload') }}
            </UButton>
          </template>
        </MediaLibrary>
        <UFormField v-if="mode === 'body' && selected" :label="$t('media.altText')" :hint="$t('media.bodyAltHint')">
          <UInput v-model="altText" class="w-full" />
        </UFormField>
      </div>

      <div
        v-show="dragActive || uploading"
        class="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-(--topiqu-surface-radius) border-2 border-dashed border-primary bg-default/95 p-6 backdrop-blur-sm"
      >
        <div class="w-full max-w-lg">
          <FileUploader
            ref="uploader"
            type="article-image"
            aspectRatio="16 / 9"
            @processing="uploading = $event"
            @upload="uploaded"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('common.actions.cancel') }}</UButton>
        <UButton :disabled="!selected" icon="mdi:check" @click="useSelected">{{ $t('media.use') }}</UButton>
      </div>
    </template>
  </UModal>
  <MediaDetail :id="detailId" v-model:open="detailOpen" @updated="refresh" @removed="refresh" />
</template>

<script setup lang="ts">
import type { MediaLibraryAsset, MediaPickerSelection } from '~~/shared/types/mediaLibrary'

const { mode = 'cover' } = defineProps<{ mode?: 'cover' | 'body' }>()
const emit = defineEmits<{ select: [asset: MediaPickerSelection, altText: string] }>()
const open = defineModel<boolean>('open', { default: false })
const detailOpen = shallowRef(false)
const detailId = shallowRef<string | null>(null)
const selected = shallowRef<MediaLibraryAsset | null>(null)
const altText = shallowRef('')
const library = useTemplateRef<{ reload: () => Promise<void> }>('library')
const uploader = useTemplateRef<{ openPicker: () => void; handleFile: (file: File) => Promise<void> }>('uploader')
const dragActive = shallowRef(false)
const uploading = shallowRef(false)
let dragDepth = 0

watch(open, (value) => {
  if (!value) {
    selected.value = null
    altText.value = ''
    dragActive.value = false
    dragDepth = 0
  }
})
const select = (asset: MediaLibraryAsset) => {
  selected.value = asset
  altText.value = asset.defaultAltText ?? asset.name ?? ''
}
const uploaded = async (payload: { url: string; optimizedUrl: string; mediaAsset?: any }) => {
  if (!payload.mediaAsset) return
  selected.value = {
    ...payload.mediaAsset,
    url: payload.url,
    deliveryUrl: payload.optimizedUrl,
    usageCount: 0,
    machineTags: payload.mediaAsset.machineTags ?? [],
  }
  altText.value = payload.mediaAsset.defaultAltText ?? payload.mediaAsset.name ?? ''
  dragActive.value = false
  await refresh()
}
const openUploadPicker = () => uploader.value?.openPicker()
const enterDrag = (event: DragEvent) => {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth++
  dragActive.value = true
}
const leaveDrag = () => {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth && !uploading.value) dragActive.value = false
}
const dropFile = async (event: DragEvent) => {
  dragDepth = 0
  const file = [...(event.dataTransfer?.files ?? [])].find((item) => item.type.startsWith('image/'))
  if (!file) {
    dragActive.value = false
    return
  }
  await uploader.value?.handleFile(file)
  if (!uploading.value) dragActive.value = false
}
const inspect = (id: string) => {
  detailId.value = id
  detailOpen.value = true
}
const refresh = () => library.value?.reload()
const useSelected = () => {
  if (!selected.value) return
  emit('select', selected.value, altText.value.trim())
  open.value = false
}
</script>
