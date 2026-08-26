<template>
  <div class="space-y-3">
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      :aria-label="editLabel"
      class="group relative justify-center overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default p-0 hover:bg-transparent"
      :class="[isFavicon ? 'size-24' : 'h-20 w-48', imageUrl ? 'transparency-grid' : 'bg-elevated']"
      @click="openEditor"
    >
      <AppMedia
        v-if="imageUrl"
        :src="imageUrl"
        :alt="assetAlt"
        :aspectRatio="outputAspectRatio"
        fit="contain"
        :sizes="isFavicon ? '96px' : '192px'"
        :width="isFavicon ? 96 : 192"
        containerClass="size-full bg-transparent"
      />
      <Icon v-else name="mdi:image-plus-outline" class="size-9 text-dimmed" />
      <span
        class="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Icon name="mdi:image-edit-outline" class="size-7" />
      </span>
    </UButton>

    <div class="flex flex-wrap gap-2">
      <UButton color="neutral" variant="soft" size="sm" icon="i-mdi-image-edit-outline" @click="openEditor">
        {{ imageUrl ? editLabel : $t('common.actions.clickToUpload') }}
      </UButton>
      <UButton
        v-if="imageUrl"
        color="error"
        variant="soft"
        size="sm"
        icon="i-mdi-delete-outline"
        @click="removeAsset"
      >
        {{ removeLabel }}
      </UButton>
    </div>

    <UModal
      v-model:open="open"
      scrollable
      :title="editorTitle"
      :dismissible="!busy"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <div class="flex flex-col gap-5">
          <UFileUpload
            v-if="!draftUrl"
            v-model="pickedFile"
            size="lg"
            accept="image/jpeg,image/png,image/webp,image/gif"
            icon="i-mdi-cloud-upload-outline"
            :label="$t('common.avatar.chooseImage')"
            :description="$t('common.avatar.requirements')"
            :preview="false"
            class="min-h-52"
          />

          <template v-else>
            <div
              role="group"
              :aria-label="$t('common.preferences.brandAsset.displayMode')"
              class="flex gap-1 rounded-[var(--ui-radius)] bg-elevated p-1"
            >
              <UButton
                type="button"
                class="flex-1 justify-center"
                :color="displayMode === 'contain' ? 'primary' : 'neutral'"
                :variant="displayMode === 'contain' ? 'soft' : 'ghost'"
                icon="i-mdi-fit-to-screen-outline"
                :aria-pressed="displayMode === 'contain'"
                @click="displayMode = 'contain'"
              >
                {{ $t('common.preferences.brandAsset.showWhole') }}
              </UButton>
              <UButton
                type="button"
                class="flex-1 justify-center"
                :color="displayMode === 'cover' ? 'primary' : 'neutral'"
                :variant="displayMode === 'cover' ? 'soft' : 'ghost'"
                icon="i-mdi-crop"
                :aria-pressed="displayMode === 'cover'"
                @click="displayMode = 'cover'"
              >
                {{ $t('common.preferences.brandAsset.crop') }}
              </UButton>
            </div>

            <div class="flex flex-col items-center gap-3">
              <div
                ref="cropArea"
                class="transparency-grid relative max-w-full touch-none overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default"
                :style="{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }"
                :class="isSwiping ? 'cursor-grabbing' : 'cursor-grab'"
              >
                <NuxtImg
                  :src="draftUrl"
                  alt=""
                  draggable="false"
                  class="pointer-events-none absolute max-w-none select-none"
                  :style="previewStyle"
                />
                <div v-if="busy" class="absolute inset-0 grid place-items-center bg-default/70 backdrop-blur-sm">
                  <UIcon name="i-mdi-loading" size="32" class="animate-spin text-primary" />
                </div>
              </div>
              <p class="text-balance text-center text-xs text-muted">{{ stageHint }}</p>
            </div>

            <UFormField :label="$t('common.preferences.brandAsset.zoom')" :hint="`${zoom.toFixed(1)}×`">
              <USlider v-model="zoom" :min="minZoom" :max="3" :step="0.01" :disabled="busy" />
            </UFormField>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <UFieldGroup>
                <UButton
                  square
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  icon="i-mdi-rotate-left"
                  :aria-label="$t('common.avatar.rotateLeft')"
                  :title="$t('common.avatar.rotateLeft')"
                  :disabled="busy"
                  @click="rotation -= 90"
                />
                <UButton
                  square
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  icon="i-mdi-rotate-right"
                  :aria-label="$t('common.avatar.rotateRight')"
                  :title="$t('common.avatar.rotateRight')"
                  :disabled="busy"
                  @click="rotation += 90"
                />
                <UButton
                  square
                  color="neutral"
                  variant="subtle"
                  size="sm"
                  icon="i-mdi-backup-restore"
                  :aria-label="$t('common.preferences.brandAsset.resetView')"
                  :title="$t('common.preferences.brandAsset.resetView')"
                  :disabled="busy"
                  @click="resetCrop"
                />
              </UFieldGroup>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-mdi-image-edit-outline"
                :disabled="busy"
                @click="chooseFile()"
              >
                {{ $t('common.actions.change') }}
              </UButton>
            </div>
          </template>

          <UAlert
            v-if="errorMessage"
            role="alert"
            color="error"
            variant="soft"
            icon="i-mdi-alert-circle-outline"
            :description="errorMessage"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="soft" size="lg" :disabled="busy" @click="closeEditor">
            {{ $t('common.close') }}
          </UButton>
          <UButton v-if="draftUrl" size="lg" icon="i-mdi-check" :loading="busy" @click="saveAsset">
            {{ saveLabel }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
type BrandAssetType = 'logo' | 'favicon'

const props = withDefaults(defineProps<{ imageUrl: string; assetType?: BrandAssetType }>(), { assetType: 'logo' })
const emit = defineEmits<{ upload: [payload: { url: string; optimizedUrl: string }] }>()

const isFavicon = computed(() => props.assetType === 'favicon')
const viewportWidth = isFavicon.value ? 288 : 336
const viewportHeight = isFavicon.value ? 288 : 105
const outputWidth = isFavicon.value ? 256 : 1280
const outputHeight = isFavicon.value ? 256 : 400
const outputAspectRatio = isFavicon.value ? '1 / 1' : '16 / 5'
const displayMode = shallowRef<'contain' | 'cover'>('contain')
const renderFit = computed(() => displayMode.value)

const assetAlt = computed(() =>
  isFavicon.value ? $t('common.preferences.branding.favicon') : $t('common.avatar.alt.company'),
)
const editLabel = computed(() =>
  isFavicon.value ? $t('common.preferences.branding.faviconEdit') : $t('common.preferences.companyLogo.edit'),
)
const removeLabel = computed(() =>
  isFavicon.value ? $t('common.preferences.branding.faviconRemove') : $t('common.preferences.companyLogo.remove'),
)
const editorTitle = computed(() =>
  isFavicon.value ? $t('common.preferences.branding.faviconEditorTitle') : $t('common.preferences.companyLogo.editorTitle'),
)
const saveLabel = computed(() =>
  isFavicon.value ? $t('common.preferences.branding.faviconSave') : $t('common.preferences.companyLogo.save'),
)

const open = shallowRef(false)
const busy = shallowRef(false)
const pickedFile = shallowRef<File | null>(null)
const {
  acceptFile,
  chooseFile,
  cropArea,
  draftUrl,
  errorMessage,
  isSwiping,
  previewStyle,
  render,
  reset,
  resetCrop,
  rotation,
  zoom,
} = useAvatarCropper($t, () => undefined, {
  viewportWidth,
  viewportHeight,
  outputWidth,
  outputHeight,
  fit: renderFit,
})

const minZoom = computed(() => (displayMode.value === 'cover' ? 1 : 0.5))
// cropHelp already tells the user to drag; contain mode only becomes draggable once zoom pushes the image past the frame.
const stageHint = computed(() =>
  displayMode.value === 'cover'
    ? $t('common.preferences.brandAsset.cropHelp')
    : [$t('common.preferences.brandAsset.showWholeHelp'), zoom.value > 1 && $t('common.avatar.dragHint')]
        .filter(Boolean)
        .join(' · '),
)

// Handing the file straight to the cropper and clearing the picker lets a rejected file be picked again.
watch(pickedFile, (file) => {
  if (!file) return
  acceptFile(file)
  pickedFile.value = null
})
watch(displayMode, () => resetCrop())

function openEditor() {
  open.value = true
}

function closeEditor() {
  if (busy.value) return
  open.value = false
}

// Escape, the overlay and the close icon bypass closeEditor, so the draft is discarded on the state itself.
watch(open, (isOpen) => {
  if (isOpen) return
  reset()
  pickedFile.value = null
  displayMode.value = 'contain'
})

async function saveAsset() {
  busy.value = true
  errorMessage.value = ''
  try {
    const form = new FormData()
    form.append('file', await render(), isFavicon.value ? 'favicon.webp' : 'logo.webp')
    form.append('type', isFavicon.value ? 'client-favicon' : 'client-logo')
    form.append('maxWidth', String(outputWidth))
    form.append('maxHeight', String(outputHeight))
    const result = await $fetch<{ url: string; optimizedUrl: string }>('/api/upload', { method: 'POST', body: form })
    emit('upload', { url: result.url, optimizedUrl: result.optimizedUrl })
    open.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || $t('common.avatar.uploadError')
  } finally {
    busy.value = false
  }
}

function removeAsset() {
  emit('upload', { url: '', optimizedUrl: '' })
}
</script>
