<template>
  <div class="space-y-4">
    <div class="relative">
      <label class="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{{
        $t('profile.email')
      }}</label>
      <div class="relative flex items-center justify-center">
        <input
          v-model="email"
          disabled
          class="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-700 text-gray-800 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-10"
        />
        <Icon
          v-if="isEmailVerified"
          name="mdi:check-circle"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-green-500"
        />
        <Icon
          v-else
          name="mdi:alert-circle"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-yellow-500"
        />
      </div>
    </div>
    <div v-if="!isEmailVerified" class="space-y-3">
      <Button
        :disabled="isLoading || isVerificationCodeSent"
        class="w-full inline-flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
        @click="sendVerificationCode"
      >
        <Icon name="mdi:email-send" class="w-4 h-4 mr-2" />
        {{ $t('common.auth.sendCode') }}
      </Button>
      <div v-if="isVerificationCodeSent" class="space-y-2">
        <div class="relative flex items-center justify-center">
          <input
            v-model="verificationCode"
            :placeholder="$t('common.auth.enterCode')"
            class="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
          />
        </div>
        <Button
          :disabled="isLoading || !verificationCode"
          class="w-full inline-flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
          @click="verifyEmail"
        >
          <Icon name="mdi:check" class="w-4 h-4 mr-2" />
          {{ $t('common.auth.verify') }}
        </Button>
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
    toast.success({ message: response.message })
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.auth.verifyFailed') })
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
    toast.success({ message: $t('common.auth.verifySuccess') })
  } catch (err: any) {
    toast.error({ message: err.data?.message || $t('common.auth.verifyFailed') })
  } finally {
    isLoading.value = false
  }
}
</script>
