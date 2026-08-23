<template>
  <UModal v-model:open="open" :title="$t('common.avatar.uploadAvatar')">
    <template #default="actions">
      <slot v-bind="{ ...actions, open: openEditor }">
        <UButton
          color="neutral"
          variant="ghost"
          square
          :loading="isLoading"
          :avatar="{ src: avatar || auth?.user.avatarUrl || undefined, alt: auth?.user.name, size: '3xl' }"
          :aria-label="$t('common.avatar.uploadAvatar')"
          @click="openEditor"
        />
      </slot>
    </template>

    <template #body>
      <div class="grow flex flex-col gap-8">
        <div v-if="!draftUrl" class="my-8 flex w-full flex-col items-center justify-center gap-5">
          <UserPicture :url="displayAvatar" size="xl" :name="name ?? auth?.user.name" />
          <UButton icon="i-mdi-image-edit-outline" size="lg" @click="chooseFile()">
            {{ $t('common.avatar.chooseImage') }}
          </UButton>
          <p class="text-center text-xs text-muted">{{ $t('common.avatar.requirements') }}</p>
        </div>

        <template v-else>
          <div
            ref="cropArea"
            class="relative mx-auto size-72 max-w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ring-4 ring-white dark:ring-gray-700 shadow-lg touch-none"
            :class="busy ? 'cursor-wait' : isSwiping ? 'cursor-grabbing' : 'cursor-grab'"
          >
            <NuxtImg
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
              <UInput
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
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="mdi:rotate-left"
                :disabled="busy"
                @click="rotation -= 90"
              >
                {{ $t('common.avatar.rotateLeft') }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="mdi:rotate-right"
                :disabled="busy"
                @click="rotation += 90"
              >
                {{ $t('common.avatar.rotateRight') }}
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="mdi:image-edit-outline"
                :disabled="busy"
                @click="chooseFile()"
              >
                {{ $t('common.actions.change') }}
              </UButton>
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

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end">
        <UButton v-if="currentAvatar" color="error" variant="soft" icon="i-mdi-delete-outline" @click="confirmRemove">
          {{ $t('common.avatar.remove') }}
        </UButton>
        <UButton color="neutral" variant="soft" size="lg" @click="(closeEditor(), close())">{{
          $t('common.close')
        }}</UButton>
        <UButton v-if="draftUrl" :loading="busy" icon="i-mdi-content-save" @click="saveAvatar">
          {{ $t('common.actions.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
  <AppConfirmDialog ref="removeDialog" />
</template>

<script lang="ts" setup>
const toast = useAppToast()
const { data: auth, refresh } = useAuth()
const avatar = defineModel<string | null | undefined>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ (e: 'upload', avatarUrl: string | null): void }>()

// `api` points the same editor at an avatar that is not the signed-in user's (the AI author's, say);
// only the session user's own avatar may be mirrored back into the session.
const { api, name } = defineProps<{ api?: string; name?: string }>()
const endpoint = computed(() => api ?? '/api/users/avatar')
const isOwnAvatar = computed(() => !api)

const removeDialog = useTemplateRef<{ ask: (options?: Record<string, unknown>) => Promise<'ok' | 'no'> }>(
  'removeDialog',
)
const savedAvatar = shallowRef<string | null>(null)
const busy = shallowRef(false)
const isLoading = computed(() => busy.value)
const progress = shallowRef(0)
const stage = shallowRef<'uploading' | 'saving'>('uploading')

const { chooseFile, cropArea, draftUrl, errorMessage, isSwiping, previewStyle, render, reset, rotation, zoom } =
  useAvatarCropper($t, (url) => {
    if (url) avatar.value = url
  })

const currentAvatar = computed(() => avatar.value || (isOwnAvatar.value ? auth.value?.user.avatarUrl : null) || null)
const displayAvatar = computed(() => draftUrl.value || currentAvatar.value)
const uploadLabel = computed(() =>
  stage.value === 'uploading' ? $t('common.avatar.uploading') : $t('common.avatar.saving'),
)

function openEditor() {
  savedAvatar.value = currentAvatar.value
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
    request.open('POST', endpoint.value)
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
    if (isOwnAvatar.value) {
      if (auth.value) auth.value.user.avatarUrl = response.avatarUrl
      await refresh()
    }
    emit('upload', response.avatarUrl)
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
    await $fetch(endpoint.value, { method: 'DELETE' })
    savedAvatar.value = null
    avatar.value = null
    if (isOwnAvatar.value) {
      if (auth.value) auth.value.user.avatarUrl = null
      await refresh()
    }
    emit('upload', null)
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
