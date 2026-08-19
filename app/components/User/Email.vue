<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ $t('profile.email') }}
        </p>
        <p class="mt-0.5 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ email }}</p>
      </div>
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        :class="
          isEmailVerified
            ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
        "
      >
        <Icon :name="isEmailVerified ? 'mdi:check-circle' : 'mdi:alert-circle-outline'" class="size-3.5" />
        {{ isEmailVerified ? $t('profile.checks.emailVerified') : $t('profile.checks.emailNotVerified') }}
      </span>
    </div>

    <div v-if="!isEmailVerified" class="space-y-3">
      <Button
        :disabled="isLoading || isVerificationCodeSent"
        icon="mdi:email-send-outline"
        class="w-full"
        @click="sendVerificationCode"
      >
        {{ $t('common.auth.sendCode') }}
      </Button>

      <div v-if="isVerificationCodeSent" class="space-y-2">
        <FormInput v-model="verificationCode" name="verificationCode" :placeholder="$t('common.auth.enterCode')" />
        <Button
          :disabled="isLoading || !verificationCode"
          icon="mdi:check"
          variant="success"
          class="w-full"
          @click="verifyEmail"
        >
          {{ $t('common.auth.verify') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Defaults rather than `required`: the panel renders before `/account` resolves.
const email = defineModel<string>('email', { default: '' })
const isEmailVerified = defineModel<boolean>('isEmailVerified', { default: false })
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
