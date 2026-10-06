<template>
  <div class="space-y-5">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <UIcon
          :name="enabled ? 'mdi:shield-check-outline' : otpauthUrl ? 'mdi:shield-key-outline' : 'mdi:shield-outline'"
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
        v-if="!enabled && !otpauthUrl"
        :disabled="isLoading"
        :loading="isLoading"
        icon="mdi:shield-lock-outline"
        class="shrink-0 max-sm:w-full"
        @click="enable2FA"
      >
        {{ $t('profile.enable2FA') }}
      </UButton>
    </div>

    <UserTotpQr v-if="otpauthUrl" :otpauthUrl />

    <form
      v-if="otpauthUrl || enabled"
      class="mx-auto max-w-[22rem]"
      :class="{ 'border-t border-neutral-200 pt-4 dark:border-neutral-800': !otpauthUrl }"
      @submit.prevent="otpauthUrl ? verifyTotpCode() : disable2FA()"
    >
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
      />
      <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
      <UButton
        type="submit"
        :disabled="isLoading || !totpCode"
        :loading="isLoading"
        :icon="otpauthUrl ? 'mdi:check-circle-outline' : 'mdi:shield-off-outline'"
        :color="otpauthUrl ? 'success' : 'error'"
        :variant="otpauthUrl ? 'solid' : 'soft'"
        class="mt-3 w-full"
      >
        {{ otpauthUrl ? $t('profile.verify2FA') : $t('profile.disable2FA') }}
      </UButton>
    </form>
  </div>
</template>

<script setup lang="ts">
const enabled = defineModel<boolean>('enabled', { required: true })
const { userId } = defineProps<{ userId: string }>()
const emit = defineEmits<{ error: [message: string] }>()

const confirm = useConfirm()
const totpInputId = useId()
const isLoading = shallowRef(false)
const otpauthUrl = shallowRef('')
const totpSetup = shallowRef('')
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)

const statusTitle = computed(() => {
  if (enabled.value) return $t('profile.twoFactorEnabledStatus')
  if (otpauthUrl.value) return $t('profile.twoFactorSetupTitle')
  return $t('profile.twoFactorDisabledTitle')
})

const statusDescription = computed(() => {
  if (enabled.value) return $t('profile.twoFactorEnabledDescription')
  if (otpauthUrl.value) return $t('profile.twoFactorSetupDescription')
  return $t('profile.twoFactorDisabledDescription')
})

const patch = (body: Record<string, string>) =>
  $fetch(`/api/users/${userId}` as `/api/users/:id`, { method: 'PATCH', body })

async function enable2FA() {
  try {
    isLoading.value = true
    const response = await patch({ totpAction: 'enable' })
    if (!('totpSetup' in response))
      throw createError({ statusCode: 500, statusMessage: 'Invalid response from server' })
    otpauthUrl.value = response.otpauthUrl
    totpSetup.value = response.totpSetup
  } catch (err: any) {
    emit('error', fetchErrorMessage(err, $t('common.messages.operationFailed')))
  } finally {
    isLoading.value = false
  }
}

async function verifyTotpCode() {
  if (!totpCode.value || isLoading.value) return

  try {
    isLoading.value = true
    await patch({ totpCode: totpCode.value, totpSetup: totpSetup.value })
    reset()
    enabled.value = true
  } catch (err: any) {
    error.value = fetchErrorMessage(err, $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}

async function disable2FA() {
  if (!totpCode.value || isLoading.value) return

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
    await patch({ totpAction: 'disable', totpCode: totpCode.value })
    reset()
    enabled.value = false
  } catch (err: any) {
    error.value = fetchErrorMessage(err, $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}

function reset() {
  otpauthUrl.value = ''
  totpSetup.value = ''
  totpCode.value = ''
  error.value = null
}
</script>
