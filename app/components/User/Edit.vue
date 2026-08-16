<template>
  <UModal
    v-model:open="open"
    :title="$t('master.userEdit.title')"
    :dismissible="false"
    :close="false"
    @close:prevent="confirmClose"
  >
    <slot :open="open" />
    <template #body>
      <div class="flex-1 overflow-y-auto pr-4">
        <div class="flex flex-col gap-6">
          <UFormField :label="$t('common.labels.username')">
            <UInput v-model="editedUser.username" :placeholder="$t('common.labels.username')" />
          </UFormField>
          <UFormField :label="$t('common.labels.email')">
            <UInput v-model="editedUser.email" :placeholder="$t('common.labels.email')" type="email" />
          </UFormField>
          <UFormField :label="$t('common.auth.password')">
            <UInput
              v-model="editedUser.password"
              :placeholder="$t('master.userEdit.passwordPlaceholder')"
              type="password"
            />
          </UFormField>
          <UFormField :label="$t('master.userEdit.role')">
            <USelect
              v-model="editedUser.role"
              :items="[
                { label: $t('master.userEdit.roles.admin'), value: 'admin' },
                { label: $t('master.userEdit.roles.reader'), value: 'reader' },
                { label: $t('master.userEdit.roles.ai'), value: 'ai' },
              ]"
              valueKey="value"
              labelKey="label"
            />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-4 justify-end flex-shrink-0">
        <UButton color="neutral" variant="ghost" @click="confirmClose">{{ $t('common.actions.close') }}</UButton>
        <UButton
          color="primary"
          variant="solid"
          :disabled="!editedUser.username || !editedUser.email"
          @click="saveEdit"
        >
          {{ $t('common.actions.saveChanges') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  user: { id: string; username: string; email: string; role?: string }
}>()
const emit = defineEmits(['saved'])
const open = defineModel<boolean>({ default: false })
const toast = useToast()
const { t } = useI18n()
const confirm = useConfirm()

const editedUser = shallowRef({
  id: props.user.id,
  username: props.user.username,
  email: props.user.email,
  password: '',
  role: props.user.role || 'reader',
})

const saveEdit = async () => {
  if (!editedUser.value.username || !editedUser.value.email) {
    toast.add({ color: 'error', title: t('master.userEdit.validation') })
    return
  }
  try {
    const body: any = {
      username: editedUser.value.username,
      email: editedUser.value.email,
      role: editedUser.value.role,
    }
    if (editedUser.value.password) body.password = editedUser.value.password
    await $fetch(`/api/users/${editedUser.value.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body,
    })
    emit('saved')
    toast.add({ color: 'success', title: t('master.userEdit.success') })
    open.value = false
  } catch (error: any) {
    toast.add({ color: 'error', title: error?.data?.message || t('master.userEdit.error') })
  }
}

const confirmClose = async () => {
  if (!editedUser.value.username && !editedUser.value.email && !editedUser.value.password && !editedUser.value.role) {
    open.value = false
    return
  }
  const r = await confirm({
    title: t('common.messages.closeConfirmTitle'),
    message: t('common.messages.closeConfirmText'),
    icon: 'i-mdi-alert-outline',
    confirmText: t('common.messages.closeConfirmButton'),
    cancelText: t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (r) open.value = false
}
</script>
