<template>
  <div class="space-y-4">
    <UButton
      v-if="!enabled && !showForm"
      class="disabled-primary-action w-full"
      icon="i-mdi-shield-lock"
      :disabled="isLoading"
      :loading="isLoading"
      @click="enable2FA"
    >
      {{ $t('profile.enable2FA') }}
    </UButton>

    <div v-if="otpauthUrl && (showForm || enabled)" class="space-y-4 text-center">
      <UCard class="mx-auto w-full sm:max-w-[22rem]">
        <template v-if="showQR">
          <ClientOnly>
            <Qrcode :value="otpauthUrl" class="mx-auto" />
          </ClientOnly>
          <p class="mt-2 text-xs text-muted">{{ $t('profile.scanTotp') }}</p>
          <UAlert
            class="mt-3"
            color="warning"
            variant="soft"
            icon="i-mdi-alert-outline"
            :description="$t('profile.sensitiveInfo')"
          />
          <div class="mt-3 flex justify-center gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :icon="showSecret ? 'i-mdi-eye-off' : 'i-mdi-eye'"
              @click="showSecret = !showSecret"
            >
              {{ showSecret ? $t('profile.hideSecret') : $t('profile.showSecret') }}
            </UButton>
            <UButton
              square
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-mdi-eye-off"
              :aria-label="$t('profile.hideSecret')"
              @click="showQR = false"
            />
          </div>
          <div v-if="showSecret" class="mt-2 flex items-center justify-center gap-2">
            <code class="text-xs text-highlighted">{{ secret }}</code>
            <UButton
              square
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-mdi-content-copy"
              :aria-label="$t('common.actions.copySecret')"
              @click="copySecret(secret)"
            />
          </div>
        </template>
        <UButton v-else color="neutral" variant="soft" icon="i-mdi-qrcode" @click="showQR = true">
          {{ $t('profile.showQr') }}
        </UButton>
      </UCard>

      <UFormField v-if="showForm" :label="$t('profile.enterTotpCode')" :error="error || undefined">
        <UPinInput v-model="totpDigits" type="number" :length="6" otp class="mx-auto" />
      </UFormField>

      <UButton
        v-if="showForm"
        class="disabled-primary-action mx-auto w-full max-w-xs"
        icon="i-mdi-check-circle"
        :disabled="isLoading || totpCode.length !== 6"
        :loading="isLoading"
        @click="verifyTotpCode"
      >
        {{ $t('profile.verify2FA') }}
      </UButton>
      <UButton
        v-else
        class="mx-auto w-full max-w-xs"
        color="error"
        icon="i-mdi-shield-off"
        :disabled="isLoading"
        :loading="isLoading"
        @click="disable2FA"
      >
        {{ $t('profile.disable2FA') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ enabled: boolean; otpauthUrl: string; userId: string }>()
const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'update:otpauthUrl' | 'error', value: string): void
}>()

const isLoading = shallowRef(false)
const showForm = shallowRef(false)
const showQR = shallowRef(false)
const showSecret = shallowRef(false)
const totpDigits = ref<number[]>([])
const totpCode = computed(() => totpDigits.value.join(''))
const error = shallowRef<string | null>(null)
const toast = useToast()

const secret = computed(() => {
  try {
    return new URL(props.otpauthUrl).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
})

async function copySecret(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
  }
}

async function enable2FA() {
  try {
    isLoading.value = true
    const response = await $fetch(`/api/users/${props.userId}` as `/api/users/:id`, {
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
    const response = await $fetch(`/api/users/${props.userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpCode: totpCode.value },
    })
    if (!('verified' in response) || !response.verified)
      throw createError({ statusCode: 500, statusMessage: 'Invalid response from server' })
    showForm.value = false
    showQR.value = false
    showSecret.value = false
    totpDigits.value = []
    error.value = null
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
    await $fetch(`/api/users/${props.userId}`, { method: 'PATCH', body: { totpSecret: null } })
    showForm.value = false
    showQR.value = false
    showSecret.value = false
    totpDigits.value = []
    error.value = null
    emit('update:enabled', false)
    emit('update:otpauthUrl', '')
    emit('error', '')
  } catch (err: any) {
    emit('error', err.data?.message || $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}
</script>
