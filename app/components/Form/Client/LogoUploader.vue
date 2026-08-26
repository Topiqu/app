<template>
  <div class="space-y-3">
    <UButton
      type="button"
      class="group relative flex items-center justify-center overflow-hidden rounded-2xl border border-default bg-elevated shadow-sm transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      :class="isFavicon ? 'size-24' : 'h-20 w-48'"
      :aria-label="editLabel"
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
      <Icon v-else name="mdi:image-plus-outline" class="size-10 text-muted" />
      <span
        class="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Icon name="mdi:image-edit-outline" class="size-8" />
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

    <Modal v-model="open" :title="editorTitle" :onClose="closeEditor" class="max-w-lg">
      <template #content>
        <div class="flex flex-col gap-5">
          <UButton
            v-if="!draftUrl"
            type="button"
            class="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-default transition-colors hover:border-primary hover:bg-elevated"
            @click="chooseFile()"
          >
            <Icon name="mdi:image-plus-outline" class="size-10 text-primary" />
            <span class="font-medium">{{ $t('common.avatar.chooseImage') }}</span>
            <span class="text-xs text-muted">{{ $t('common.avatar.requirements') }}</span>
          </UButton>

          <template v-else>
            <UFormField :label="$t('common.preferences.brandAsset.displayMode')">
              <UFieldGroup class="w-full">
                <UButton
                  type="button"
                  class="flex-1 justify-center"
                  :color="displayMode === 'contain' ? 'primary' : 'neutral'"
                  :variant="displayMode === 'contain' ? 'solid' : 'outline'"
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
                  :variant="displayMode === 'cover' ? 'solid' : 'outline'"
                  icon="i-mdi-crop"
                  :aria-pressed="displayMode === 'cover'"
                  @click="displayMode = 'cover'"
                >
                  {{ $t('common.preferences.brandAsset.crop') }}
                </UButton>
              </UFieldGroup>
            </UFormField>

            <p class="text-sm text-muted">
              {{
                displayMode === 'contain'
                  ? $t('common.preferences.brandAsset.showWholeHelp')
                  : $t('common.preferences.brandAsset.cropHelp')
              }}
            </p>

            <div
              ref="cropArea"
              class="relative mx-auto max-w-full touch-none overflow-hidden rounded-2xl bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] shadow-lg ring-4 ring-default dark:bg-gray-800"
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
              <div v-if="busy" class="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                <UIcon name="i-mdi-loading" size="36" class="animate-spin" />
              </div>
            </div>

            <p class="text-center text-xs text-muted">{{ $t('common.preferences.companyLogo.dragHint') }}</p>
            <UFormField :label="$t('common.preferences.brandAsset.zoom')">
              <UInput
                v-model.number="zoom"
                type="range"
                :min="displayMode === 'cover' ? 1 : 0.5"
                max="3"
                step="0.01"
                class="w-full"
                :disabled="busy"
              />
            </UFormField>
            <div class="flex flex-wrap justify-center gap-2">
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-mdi-rotate-left"
                :disabled="busy"
                @click="rotation -= 90"
              >
                {{ $t('common.avatar.rotateLeft') }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-mdi-rotate-right"
                :disabled="busy"
                @click="rotation += 90"
              >
                {{ $t('common.avatar.rotateRight') }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-mdi-image-edit-outline"
                :disabled="busy"
                @click="chooseFile()"
              >
                {{ $t('common.actions.change') }}
              </UButton>
            </div>
          </template>

          <p v-if="errorMessage" role="alert" class="rounded-xl bg-error/10 p-3 text-sm text-error">
            {{ errorMessage }}
          </p>
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
    </Modal>
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
const { chooseFile, cropArea, draftUrl, errorMessage, isSwiping, previewStyle, render, reset, resetCrop, rotation, zoom } =
  useAvatarCropper($t, () => undefined, {
    viewportWidth,
    viewportHeight,
    outputWidth,
    outputHeight,
    fit: renderFit,
  })

watch(displayMode, () => resetCrop())

function openEditor() {
  open.value = true
}

function closeEditor() {
  if (busy.value) return
  reset()
  displayMode.value = 'contain'
  open.value = false
}

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
    reset()
    displayMode.value = 'contain'
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
