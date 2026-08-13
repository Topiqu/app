<template>
  <div class="space-y-3">
    <button
      type="button"
      class="group relative flex size-36 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm transition hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 dark:border-gray-700 dark:bg-gray-800"
      :aria-label="$t('common.preferences.companyLogo.edit')"
      @click="openEditor"
    >
      <NuxtImg
        v-if="logoUrl"
        :src="logoUrl"
        width="144"
        height="144"
        fit="contain"
        class="size-full object-contain p-3"
        :alt="$t('common.avatar.alt.company')"
      />
      <Icon v-else name="mdi:image-plus-outline" class="size-10 text-gray-400" />
      <span
        class="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <Icon name="mdi:image-edit-outline" class="size-8" />
      </span>
    </button>

    <div class="flex flex-wrap gap-2">
      <Button variant="neutral" size="sm" icon="mdi:image-edit-outline" @click="openEditor">
        {{ logoUrl ? $t('common.preferences.companyLogo.edit') : $t('common.actions.clickToUpload') }}
      </Button>
      <Button v-if="logoUrl" variant="danger" size="sm" icon="mdi:delete-outline" @click="removeLogo">
        {{ $t('common.preferences.companyLogo.remove') }}
      </Button>
    </div>

    <Modal
      v-model="open"
      :title="$t('common.preferences.companyLogo.editorTitle')"
      :onClose="closeEditor"
      class="max-w-lg"
    >
      <template #content>
        <div class="flex flex-col gap-5">
          <button
            v-if="!draftUrl"
            type="button"
            class="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 transition-colors hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-gray-600 dark:hover:bg-indigo-950/20"
            @click="chooseFile()"
          >
            <Icon name="mdi:image-plus-outline" class="size-10 text-indigo-500" />
            <span class="font-medium">{{ $t('common.avatar.chooseImage') }}</span>
            <span class="text-xs text-gray-500">{{ $t('common.avatar.requirements') }}</span>
          </button>

          <template v-else>
            <div
              ref="cropArea"
              class="relative mx-auto max-w-full touch-none overflow-hidden rounded-2xl bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] shadow-lg ring-4 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700"
              :style="{ width: `${LOGO_VIEWPORT_WIDTH}px`, height: `${LOGO_VIEWPORT_HEIGHT}px` }"
              :class="isSwiping ? 'cursor-grabbing' : 'cursor-grab'"
            >
              <img
                :src="draftUrl"
                alt=""
                draggable="false"
                class="pointer-events-none absolute max-w-none select-none"
                :style="previewStyle"
              />
              <div v-if="busy" class="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                <Icon name="mdi:loading" class="size-9 animate-spin" />
              </div>
            </div>

            <p class="text-center text-xs text-gray-500">{{ $t('common.preferences.companyLogo.dragHint') }}</p>
            <label class="flex items-center gap-3 text-sm">
              <Icon name="mdi:magnify-plus-outline" class="size-5" />
              <input
                v-model.number="zoom"
                type="range"
                min="0.5"
                max="3"
                step="0.01"
                class="grow accent-indigo-600"
                :disabled="busy"
              />
            </label>
            <div class="flex flex-wrap justify-center gap-2">
              <Button variant="neutral" size="sm" icon="mdi:rotate-left" :disabled="busy" @click="rotation -= 90">{{
                $t('common.avatar.rotateLeft')
              }}</Button>
              <Button variant="neutral" size="sm" icon="mdi:rotate-right" :disabled="busy" @click="rotation += 90">{{
                $t('common.avatar.rotateRight')
              }}</Button>
              <Button
                variant="neutral"
                size="sm"
                icon="mdi:image-edit-outline"
                :disabled="busy"
                @click="chooseFile()"
                >{{ $t('common.actions.change') }}</Button
              >
            </div>
          </template>

          <p
            v-if="errorMessage"
            role="alert"
            class="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {{ errorMessage }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <Button variant="neutral" size="lg" :disabled="busy" @click="closeEditor">{{ $t('common.close') }}</Button>
          <Button v-if="draftUrl" size="lg" icon="mdi:check" :loading="busy" @click="saveLogo">{{
            $t('common.preferences.companyLogo.save')
          }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
defineProps<{ logoUrl: string }>()
const emit = defineEmits<{ upload: [payload: { url: string; optimizedUrl: string }] }>()

const open = shallowRef(false)
const busy = shallowRef(false)
const LOGO_VIEWPORT_WIDTH = 336
const LOGO_VIEWPORT_HEIGHT = 144
const { chooseFile, cropArea, draftUrl, errorMessage, isSwiping, previewStyle, render, reset, rotation, zoom } =
  useAvatarCropper($t, () => undefined, {
    viewportWidth: LOGO_VIEWPORT_WIDTH,
    viewportHeight: LOGO_VIEWPORT_HEIGHT,
    outputWidth: 1400,
    outputHeight: 600,
    fit: 'contain',
  })

function openEditor() {
  open.value = true
}

function closeEditor() {
  if (busy.value) return
  reset()
  open.value = false
}

async function saveLogo() {
  busy.value = true
  errorMessage.value = ''
  try {
    const form = new FormData()
    form.append('file', await render(), 'logo.webp')
    form.append('type', 'client-logo')
    form.append('maxWidth', '1400')
    form.append('maxHeight', '600')
    const result = await $fetch('/api/upload', { method: 'POST', body: form })
    emit('upload', { url: result.url, optimizedUrl: result.optimizedUrl })
    reset()
    open.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.message || error?.message || $t('common.avatar.uploadError')
  } finally {
    busy.value = false
  }
}

function removeLogo() {
  emit('upload', { url: '', optimizedUrl: '' })
}
</script>
