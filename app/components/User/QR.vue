<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <UIcon
          :name="enabled ? 'mdi:shield-check-outline' : showForm ? 'mdi:shield-key-outline' : 'mdi:shield-outline'"
          class="mt-0.5 size-5 shrink-0"
          :class="enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400 dark:text-neutral-500'"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ statusTitle }}
            <span v-if="enabled" class="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          </p>
          <p class="mt-0.5 max-w-lg text-sm leading-5 text-neutral-500 text-pretty dark:text-neutral-400">
            {{ statusDescription }}
          </p>
        </div>
      </div>

      <UButton
        v-if="!enabled && !showForm"
        :disabled="isLoading"
        :loading="isLoading"
        icon="mdi:shield-lock-outline"
        class="shrink-0 max-sm:w-full"
        @click="enable2FA"
      >
        {{ $t('profile.enable2FA') }}
      </UButton>
    </div>

    <template v-if="otpauthUrl">
      <UserTotpQr :otpauthUrl="otpauthUrl" />

      <div v-if="showForm" class="mx-auto max-w-[22rem]">
        <AppFormLabel :forId="totpInputId" :text="$t('profile.verificationCodeLabel')" />
        <UInput
          :id="totpInputId"
          v-model="totpCode"
          type="tel"
          name="totpCode"
          pattern="[0-9]*"
          inputmode="numeric"
          autocomplete="one-time-code"
          :placeholder="$t('profile.enterTotpCode')"
          class="mt-1"
          @keyup.enter="verifyTotpCode"
        />
        <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
        <UButton
          :disabled="isLoading || !totpCode"
          :loading="isLoading"
          icon="mdi:check-circle-outline"
          color="success"
          class="mt-3 w-full"
          @click="verifyTotpCode"
        >
          {{ $t('profile.verify2FA') }}
        </UButton>
      </div>

      <div v-else-if="enabled" class="flex justify-end border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <UButton
          :disabled="isLoading"
          :loading="isLoading"
          icon="mdi:shield-off-outline"
          color="error"
          variant="ghost"
          @click="disable2FA"
        >
          {{ $t('profile.disable2FA') }}
        </UButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const { enabled, otpauthUrl, userId } = defineProps<{
  enabled: boolean
  otpauthUrl: string
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'update:otpauthUrl' | 'error', value: string): void
}>()

const confirm = useConfirm()
const totpInputId = useId()
const isLoading = shallowRef(false)
const showForm = shallowRef(false)
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)

const statusTitle = computed(() => {
  if (enabled) return $t('profile.twoFactorEnabledStatus')
  if (showForm.value) return $t('profile.twoFactorSetupTitle')
  return $t('profile.twoFactorDisabledTitle')
})

const statusDescription = computed(() => {
  if (enabled) return $t('profile.twoFactorEnabledDescription')
  if (showForm.value) return $t('profile.twoFactorSetupDescription')
  return $t('profile.twoFactorDisabledDescription')
})

async function enable2FA() {
  try {
    isLoading.value = true
    const response = await $fetch(`/api/users/${userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpAction: 'enable' },
    })
    if (!('otpauthUrl' in response))
      throw createError({ statusCode: 500, statusMessage: 'Invalid response from server' })
    emit('update:otpauthUrl', response.otpauthUrl)
    showForm.value = true
    emit('update:enabled', false)
  } catch (err: any) {
    emit('error', err.data?.message || $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}

async function verifyTotpCode() {
  if (!totpCode.value || isLoading.value) return

  try {
    isLoading.value = true
    const response = await $fetch(`/api/users/${userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpCode: totpCode.value },
    })
    if (!('verified' in response) || !response.verified)
      throw createError({ statusCode: 500, statusMessage: 'Invalid response from server' })

    reset()
    emit('update:enabled', true)
    emit('error', '')
  } catch (err: any) {
    error.value = err.data?.message || $t('common.messages.operationFailed')
  } finally {
    isLoading.value = false
  }
}

async function disable2FA() {
  const confirmed = await confirm({
    title: $t('profile.disable2FAConfirmTitle'),
    message: $t('profile.disable2FAConfirmText'),
    icon: 'mdi:shield-off-outline',
    confirmText: $t('profile.disable2FA'),
    cancelText: $t('common.actions.cancel'),
    variant: 'danger',
  })
  if (!confirmed) return

  try {
    isLoading.value = true
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { totpSecret: null },
    })
    reset()
    emit('update:enabled', false)
    emit('update:otpauthUrl', '')
    emit('error', '')
  } catch (err: any) {
    emit('error', err.data?.message || $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}

function reset() {
  showForm.value = false
  totpCode.value = ''
  error.value = null
}
</script>
