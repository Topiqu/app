<template>
  <UModal v-model:open="open" :title="$t('common.avatar.uploadAvatar')">
    <template #default="actions">
      <slot v-bind="actions">
        <UButton
          color="neutral"
          variant="ghost"
          square
          :loading="isLoading"
          :avatar="{ src: avatar || auth?.user.avatarUrl || undefined, alt: auth?.user.name, size: '3xl' }"
          :aria-label="$t('common.avatar.uploadAvatar')"
          @click="open = !open"
        />
      </slot>
    </template>

    <template #body>
      <div class="grow flex flex-col gap-8">
        <div class="w-full my-8 flex items-center justify-center">
          <UserPicture :url="avatar || auth?.user.avatarUrl" :size="'hg'" :name="auth?.user.name" />
        </div>

        <FileUploader type="user-avatar" @upload="handleUpload" />
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end">
        <UButton color="neutral" variant="soft" size="lg" @click="close">{{ $t('common.close') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script lang="ts" setup>
const toast = useToast()

const { data: auth, refresh } = useAuth()

const avatar = defineModel<string | null | undefined>()

const open = defineModel<boolean>('open')

const isLoading = shallowRef<boolean>(false)

const emit = defineEmits<{ (e: 'upload', value: { url: string; optimizedUrl: string }): void }>()

const handleUpload = (file: { url: string; optimizedUrl: string }) => {
  if (!auth.value)
    return toast.add({
      color: 'error',
      title: 'Chyba',
      description: 'Uživatel není přihlášen',
      icon: 'i-mdi-alert-circle',
    })

  avatar.value = file.url

  auth.value.user.avatarUrl = file.url

  refresh()

  toast.add({
    color: 'success',
    title: 'Úspěch',
    description: 'Profilový obrázek byl úspěšně nahrán',
    icon: 'i-mdi-check-circle',
  })

  emit('upload', { url: file.url, optimizedUrl: file.optimizedUrl })

  open.value = false
}
</script>
