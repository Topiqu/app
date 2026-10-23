<template>
  <div class="space-y-4">
    <UFormField :label="$t('profile.email')">
      <UInput
        v-model="email"
        disabled
        class="w-full"
        :trailingIcon="isEmailVerified ? 'mdi:check-circle' : 'mdi:alert-circle'"
      />
    </UFormField>
    <div v-if="!isEmailVerified" class="space-y-3">
      <UButton
        :disabled="isLoading || verificationCooldown || !email"
        class="w-full"
        :loading="isLoading"
        icon="mdi:email-send"
        @click="sendVerificationCode"
      >
        {{ $t(isVerificationCodeSent ? 'common.auth.resendCode' : 'common.auth.sendCode') }}
      </UButton>
      <div v-if="isVerificationCodeSent" class="space-y-2">
        <UFormField :label="$t('common.auth.enterCode')">
          <UInput
            v-model="verificationCode"
            :maxlength="EMAIL_VERIFICATION_CODE_LENGTH"
            autocomplete="one-time-code"
            :placeholder="$t('common.auth.verificationCodePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UButton
          :disabled="isLoading || !validVerificationCode"
          class="w-full"
          :loading="isLoading"
          icon="mdi:check"
          @click="verifyEmail"
        >
          {{ $t('common.auth.verify') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack'

import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_COOLDOWN_MS,
  emailVerificationCodeSchema,
} from '~~/shared/utils/auth'

// Defaults rather than `required`: the panel renders before `/account` resolves.
const email = defineModel<string>('email', { default: '' })
const isEmailVerified = defineModel<boolean>('isEmailVerified', { default: false })
const isLoading = defineModel<boolean>('isLoading', { default: false })

const toast = useToast()
const verificationCode = shallowRef('')
const isVerificationCodeSent = shallowRef(false)
const validVerificationCode = computed(() => emailVerificationCodeSchema.safeParse(verificationCode.value).success)
const { isPending: verificationCooldown, start: startVerificationCooldown } = useTimeoutFn(
  () => {},
  EMAIL_VERIFICATION_COOLDOWN_MS,
  { immediate: false },
)
let verificationController: AbortController | undefined
onScopeDispose(() => verificationController?.abort())

async function sendVerificationCode() {
  if (isLoading.value || verificationCooldown.value || !email.value) return
  const controller = new AbortController()
  verificationController = controller
  const requestedEmail = email.value
  try {
    isLoading.value = true
    const response = await $fetch<InternalApi['/api/users/send-verification']['post'], '/api/users/send-verification'>(
      '/api/users/send-verification',
      { method: 'POST', signal: controller.signal },
    )
    if (controller.signal.aborted || email.value !== requestedEmail) return
    isVerificationCodeSent.value = true
    startVerificationCooldown()
    toast.add({ color: 'success', title: response.message })
  } catch (err) {
    if (!controller.signal.aborted && email.value === requestedEmail)
      toast.add({ color: 'error', title: fetchErrorMessage(err, $t('common.auth.verifyFailed')) })
  } finally {
    if (verificationController === controller) {
      verificationController = undefined
      isLoading.value = false
    }
  }
}

async function verifyEmail() {
  if (isLoading.value || !validVerificationCode.value || !email.value) return
  const controller = new AbortController()
  verificationController = controller
  const requestedEmail = email.value
  try {
    isLoading.value = true
    await $fetch<unknown, '/api/auth/verify'>('/api/auth/verify', {
      method: 'POST',
      body: { email: requestedEmail, code: verificationCode.value },
      signal: controller.signal,
    })
    if (controller.signal.aborted || email.value !== requestedEmail) return
    isEmailVerified.value = true
    isVerificationCodeSent.value = false
    verificationCode.value = ''
    toast.add({ color: 'success', title: $t('common.auth.verifySuccess') })
  } catch (err) {
    if (!controller.signal.aborted && email.value === requestedEmail)
      toast.add({ color: 'error', title: fetchErrorMessage(err, $t('common.auth.verifyFailed')) })
  } finally {
    if (verificationController === controller) {
      verificationController = undefined
      isLoading.value = false
    }
  }
}
</script>
