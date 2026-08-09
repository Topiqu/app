<template>
  <Modal v-model="open" :title="$t('common.avatar.uploadAvatar')" :onClose="closeEditor" class="max-w-lg">
    <template #default="actions">
      <slot v-bind="actions">
        <button
          type="button"
          class="relative group cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500"
          :aria-label="$t('common.avatar.uploadAvatar')"
          @click="openEditor"
        >
          <UserPicture
            :url="displayAvatar"
            size="hg"
            :name="auth?.user.name"
            class="size-32! transition-transform group-hover:scale-105 rounded-full border-4 border-white shadow-lg"
          />
          <span
            class="absolute inset-0 flex items-center justify-center bg-black/45 rounded-full transition-opacity"
            :class="busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'"
          >
            <Icon
              :name="busy ? 'mdi:loading' : 'mdi:camera'"
              class="size-8 text-white"
              :class="{ 'animate-spin': busy }"
            />
          </span>
        </button>
      </slot>
    </template>

    <template #content>
      <div class="flex flex-col gap-5">
        <button
          v-if="!draftUrl"
          type="button"
          class="h-56 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
          @click="chooseFile()"
        >
          <Icon name="mdi:image-plus-outline" class="size-10 text-indigo-500" />
          <span class="font-medium">{{ $t('common.avatar.chooseImage') }}</span>
          <span class="text-xs text-gray-500">{{ $t('common.avatar.requirements') }}</span>
        </button>

        <template v-else>
          <div
            ref="cropArea"
            class="relative mx-auto size-72 max-w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ring-4 ring-white dark:ring-gray-700 shadow-lg touch-none"
            :class="busy ? 'cursor-wait' : isSwiping ? 'cursor-grabbing' : 'cursor-grab'"
          >
            <img
              :src="draftUrl"
              alt=""
              draggable="false"
              class="absolute max-w-none select-none pointer-events-none"
              :style="previewStyle"
            />
            <div
              v-if="busy"
              class="absolute inset-0 bg-black/45 flex flex-col items-center justify-center gap-3 text-white"
            >
              <Icon name="mdi:loading" class="size-9 animate-spin" />
              <span class="text-sm font-medium">{{ uploadLabel }}</span>
              <div class="w-40 h-1.5 rounded-full overflow-hidden bg-white/30">
                <div class="h-full bg-white transition-[width]" :style="{ width: `${progress}%` }" />
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-center text-xs text-gray-500">{{ $t('common.avatar.dragHint') }}</p>
            <label class="flex items-center gap-3 text-sm">
              <Icon name="mdi:magnify-plus-outline" class="size-5" />
              <input
                v-model.number="zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                class="grow accent-indigo-600"
                :disabled="busy"
              />
            </label>
            <div class="flex justify-center gap-2">
              <Button variant="neutral" size="sm" icon="mdi:rotate-left" :disabled="busy" @click="rotation -= 90">
                {{ $t('common.avatar.rotateLeft') }}
              </Button>
              <Button variant="neutral" size="sm" icon="mdi:rotate-right" :disabled="busy" @click="rotation += 90">
                {{ $t('common.avatar.rotateRight') }}
              </Button>
              <Button variant="neutral" size="sm" icon="mdi:image-edit-outline" :disabled="busy" @click="chooseFile()">
                {{ $t('common.actions.change') }}
              </Button>
            </div>
          </div>

          <div
            v-if="errorMessage"
            role="alert"
            class="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex gap-2"
          >
            <Icon name="mdi:alert-circle-outline" class="size-5 shrink-0" />
            {{ errorMessage }}
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="w-full flex flex-wrap justify-between gap-2">
        <Button
          v-if="savedAvatar"
          variant="danger"
          size="lg"
          icon="mdi:delete-outline"
          :disabled="busy"
          @click="confirmRemove"
        >
          {{ $t('common.avatar.remove') }}
        </Button>
        <span v-else />
        <div class="flex gap-2">
          <Button variant="neutral" size="lg" :disabled="busy" @click="closeEditor">{{ $t('common.close') }}</Button>
          <Button v-if="draftUrl" size="lg" icon="mdi:check" :disabled="busy" @click="saveAvatar">
            {{ errorMessage ? $t('common.avatar.retry') : $t('common.avatar.save') }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
  <ModalMini ref="removeDialog" />
</template>

<script lang="ts" setup>
const toast = useToast()
const { data: auth, refresh } = useAuth()
const avatar = defineModel<string | null | undefined>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ (e: 'upload', value: { url: string; optimizedUrl: string }): void }>()

const removeDialog = useTemplateRef<ModalMiniRef>('removeDialog')
const savedAvatar = shallowRef<string | null>(null)
const busy = shallowRef(false)
const progress = shallowRef(0)
const stage = shallowRef<'uploading' | 'saving'>('uploading')

const { chooseFile, cropArea, draftUrl, errorMessage, isSwiping, previewStyle, render, reset, rotation, zoom } =
  useAvatarCropper($t, (url) => {
    if (url) avatar.value = url
  })

const displayAvatar = computed(() => draftUrl.value || avatar.value || auth.value?.user.avatarUrl)
const uploadLabel = computed(() =>
  stage.value === 'uploading' ? $t('common.avatar.uploading') : $t('common.avatar.saving'),
)

function openEditor() {
  savedAvatar.value = avatar.value || auth.value?.user.avatarUrl || null
  open.value = true
}

function closeEditor() {
  if (busy.value) return
  avatar.value = savedAvatar.value
  reset()
  open.value = false
}

function upload(blob: Blob) {
  return new Promise<{ avatarUrl: string }>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/users/avatar')
    request.responseType = 'json'
    request.upload.onprogress = (event) => {
      stage.value = 'uploading'
      if (event.lengthComputable) progress.value = Math.min(90, Math.round((event.loaded / event.total) * 90))
    }
    request.upload.onload = () => {
      stage.value = 'saving'
      progress.value = 95
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve(request.response)
      else
        reject(
          new Error(request.response?.statusMessage || request.response?.message || $t('common.avatar.uploadError')),
        )
    }
    request.onerror = () => reject(new Error($t('common.avatar.networkError')))
    const form = new FormData()
    form.append('file', blob, 'avatar.webp')
    request.send(form)
  })
}

async function saveAvatar() {
  busy.value = true
  progress.value = 2
  errorMessage.value = ''
  try {
    const response = await upload(await render())
    progress.value = 100
    savedAvatar.value = response.avatarUrl
    avatar.value = response.avatarUrl
    if (auth.value) auth.value.user.avatarUrl = response.avatarUrl
    await refresh()
    emit('upload', { url: response.avatarUrl, optimizedUrl: response.avatarUrl })
    toast.success({ message: $t('common.avatar.uploadSuccess') })
    reset()
    open.value = false
  } catch (error: any) {
    errorMessage.value = error?.message || $t('common.avatar.uploadError')
    avatar.value = draftUrl.value || savedAvatar.value
  } finally {
    busy.value = false
  }
}

async function confirmRemove() {
  const answer = await removeDialog.value?.ask({
    title: $t('common.avatar.removeTitle'),
    message: $t('common.avatar.removeConfirm'),
    confirmText: $t('common.actions.confirm'),
    cancelText: $t('common.messages.cancel'),
    icon: 'mdi:account-remove-outline',
    variant: 'danger',
  })
  if (answer !== 'ok') return

  busy.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/users/avatar', { method: 'DELETE' })
    savedAvatar.value = null
    avatar.value = null
    if (auth.value) auth.value.user.avatarUrl = null
    await refresh()
    emit('upload', { url: '', optimizedUrl: '' })
    toast.success({ message: $t('common.avatar.removeSuccess') })
    reset()
    open.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || $t('common.avatar.removeError')
  } finally {
    busy.value = false
  }
}
</script>
