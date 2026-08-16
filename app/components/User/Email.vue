<template>
  <div class="space-y-4">
    <UFormField :label="$t('profile.email')">
      <UInput
        v-model="email"
        disabled
        class="w-full"
        :trailingIcon="isEmailVerified ? 'i-mdi-check-circle' : 'i-mdi-alert-circle'"
      />
    </UFormField>
    <div v-if="!isEmailVerified" class="space-y-3">
      <UButton
        :disabled="isLoading || isVerificationCodeSent"
        class="w-full"
        :loading="isLoading"
        icon="i-mdi-email-send"
        @click="sendVerificationCode"
      >
        {{ $t('common.auth.sendCode') }}
      </UButton>
      <div v-if="isVerificationCodeSent" class="space-y-2">
        <UFormField :label="$t('common.auth.enterCode')">
          <UInput v-model="verificationCode" :placeholder="$t('common.auth.enterCode')" class="w-full" />
        </UFormField>
        <UButton
          :disabled="isLoading || !verificationCode"
          class="w-full"
          :loading="isLoading"
          icon="i-mdi-check"
          @click="verifyEmail"
        >
          {{ $t('common.auth.verify') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const email = defineModel<string>('email', { required: true })
const isEmailVerified = defineModel<boolean>('isEmailVerified', { required: true })
const isLoading = defineModel<boolean>('isLoading', { default: false })

const toast = useToast()
const verificationCode = shallowRef('')
const isVerificationCodeSent = shallowRef(false)

async function sendVerificationCode() {
  try {
    isLoading.value = true
    const response = await $fetch('/api/users/send-verification', { method: 'POST' })
    isVerificationCodeSent.value = true
    toast.add({ color: 'success', title: response.message })
  } catch (err: any) {
    toast.add({ color: 'error', title: err.data?.message || $t('common.auth.verifyFailed') })
  } finally {
    isLoading.value = false
  }
}

async function verifyEmail() {
  try {
    isLoading.value = true
    await $fetch('/api/auth/verify', {
      method: 'POST',
      body: { code: verificationCode.value },
    })
    isEmailVerified.value = true
    isVerificationCodeSent.value = false
    verificationCode.value = ''
    toast.add({ color: 'success', title: $t('common.auth.verifySuccess') })
  } catch (err: any) {
    toast.add({ color: 'error', title: err.data?.message || $t('common.auth.verifyFailed') })
  } finally {
    isLoading.value = false
  }
}
</script>
