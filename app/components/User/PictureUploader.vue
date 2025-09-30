<template>
  <Modal v-model="open" :title="$t('common.avatar.uploadAvatar')">
    <template #default="actions">
      <slot v-bind="actions">
        <div class="flex flex-col items-center sm:items-start gap-4" @click="open = !open">
          <div class="relative group cursor-pointer">
            <UserPicture
              :url="avatar || auth?.user.avatarUrl"
              :size="'hg'"
              :name="auth?.user.name"
              class="size-32! transition-transform group-hover:scale-105 rounded-full border-4 border-white shadow-lg"
            />
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full transition-opacity"
              :class="{ 'opacity-100': isLoading, 'opacity-0 group-hover:opacity-100': !isLoading }"
            >
              <Icon v-if="!isLoading" name="mdi:camera" class="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              <Icon v-else name="mdi:loading" class="w-6 h-6 sm:w-8 sm:h-8 text-white animate-spin" />
            </div>
          </div>
        </div>
      </slot>
    </template>

    <template #content>
      <div class="grow flex flex-col gap-8">
        <div class="w-full my-8 flex items-center justify-center">
          <UserPicture
            :url="auth?.user.avatarUrl"
            :size="'hg'"
            :name="auth?.user.name"
            class="size-32! transition-transform group-hover:scale-105 rounded-full border-4 border-white shadow-lg"
          />
        </div>

        <FileUploader type="user-avatar" @upload="handleUpload" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end">
        <Button variant="neutral" size="lg" @click="close">{{ $t('common.close') }}</Button>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
const toast = useToast()

const { data: auth } = useAuth()

const avatar = defineModel<string | null | undefined>()

const open = defineModel<boolean>('open')

const isLoading = shallowRef<boolean>(false)

const emit = defineEmits<{ (e: 'upload', value: string): void }>()

const handleUpload = (file: { url: string }) => {
  if (!auth.value)
    return toast.error({
      title: 'Chyba',
      message: 'Uživatel není přihlášen',
      icon: 'mdi:alert-circle',
    })

  avatar.value = file.url

  auth.value.user.avatarUrl = file.url

  toast.success({
    title: 'Úspěch',
    message: 'Profilový obrázek byl úspěšně nahrán',
    icon: 'mdi:check-circle',
  })

  emit('upload', file.url)

  open.value = false
}
</script>
