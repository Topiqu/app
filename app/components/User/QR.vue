<template>
  <div class="space-y-3 sm:space-y-4">
    <div v-if="!enabled">
      <Button
        :disabled="isLoading"
        class="w-full inline-flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm touch-manipulation"
        @click="enable2FA"
      >
        <Icon name="mdi:shield-lock" class="w-4 h-4 mr-2" />
        {{ $t('profile.enable2FA') }}
      </Button>
    </div>
    <div v-if="showForm && otpauthUrl">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ $t('profile.scanTotp') }}</p>
      <ClientOnly>
        <Qrcode :value="otpauthUrl" size="200" class="mx-auto" />
      </ClientOnly>
      <div class="relative mt-4">
        <input
          v-model="totpCode"
          type="text"
          :placeholder="$t('profile.enterTotpCode')"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
          :class="{ 'border-red-500 dark:border-red-500': error }"
        />
        <p v-if="error" class="text-xs sm:text-sm text-red-500 dark:text-red-400 mt-1">
          {{ error }}
        </p>
      </div>
      <Button
        :disabled="isLoading || !totpCode"
        class="w-full inline-flex justify-center items-center px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation mt-4"
        @click="verifyTotpCode"
      >
        <Icon name="mdi:check-circle" class="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
        {{ $t('profile.verify2FA') }}
      </Button>
    </div>
    <div v-if="enabled" class="text-center">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ $t('profile.scanTotp') }}</p>
      <ClientOnly>
        <Qrcode :value="otpauthUrl" size="200" class="mx-auto" />
      </ClientOnly>
      <Button
        :disabled="isLoading"
        class="w-full inline-flex justify-center items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm touch-manipulation mt-4"
        @click="disable2FA"
      >
        <Icon name="mdi:shield-off" class="w-4 h-4 mr-2" />
        {{ $t('profile.disable2FA') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  enabled: boolean
  otpauthUrl: string
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:enabled', value: boolean): void
  (e: 'error', value: string): void
}>()

const isLoading = shallowRef(false)
const showForm = shallowRef(false)
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)
console.log(props.otpauthUrl)
async function enable2FA() {
  try {
    isLoading.value = true
    await $fetch(`/api/users/${props.userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpAction: 'enable' },
    })
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
    await $fetch(`/api/users/${props.userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpCode: totpCode.value },
    })
    showForm.value = false
    totpCode.value = ''
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
    await $fetch(`/api/users/${props.userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { totpSecret: null },
    })
    showForm.value = false
    totpCode.value = ''
    error.value = null
    emit('update:enabled', false)
    emit('error', '')
  } catch (err: any) {
    emit('error', err.data?.message || $t('common.messages.operationFailed'))
  } finally {
    isLoading.value = false
  }
}
</script>
