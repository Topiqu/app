<template>
  <div class="space-y-4">
    <div v-if="!enabled && !showForm" class="flex items-start justify-between gap-3">
      <p class="text-sm text-neutral-500 dark:text-neutral-400 text-pretty">{{ $t('profile.scanTotp') }}</p>
      <UButton :disabled="isLoading" icon="i-mdi-shield-lock-outline" class="shrink-0" @click="enable2FA">
        {{ $t('profile.enable2FA') }}
      </UButton>
    </div>

    <template v-if="otpauthUrl">
      <UserTotpQr :otpauthUrl="otpauthUrl" />

      <div v-if="showForm" class="mx-auto max-w-xs space-y-2">
        <UInput
          v-model="totpCode"
          type="tel"
          name="totpCode"
          pattern="[0-9]*"
          inputmode="numeric"
          autocomplete="one-time-code"
          :placeholder="$t('profile.enterTotpCode')"
        />
        <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
        <UButton
          :disabled="isLoading || !totpCode"
          icon="i-mdi-check-circle-outline"
          color="success"
          variant="soft"
          class="w-full"
          @click="verifyTotpCode"
        >
          {{ $t('profile.verify2FA') }}
        </UButton>
      </div>

      <UButton
        v-else-if="enabled"
        :disabled="isLoading"
        icon="i-mdi-shield-off-outline"
        color="error"
        variant="soft"
        class="mx-auto w-full max-w-xs"
        @click="disable2FA"
      >
        {{ $t('profile.disable2FA') }}
      </UButton>
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

const isLoading = shallowRef(false)
const showForm = shallowRef(false)
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)

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
