<template>
  <div class="space-y-3 sm:space-y-4">
    <div v-if="!enabled">
      <Button
        :disabled="isLoading"
        class="w-full inline-flex justify-center items-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation"
        @click="enable2FA"
      >
        <Icon name="mdi:shield-lock" class="w-5 h-5 mr-2" />
        {{ $t('profile.enable2FA') }}
      </Button>
    </div>
    <div v-if="showForm && otpauthUrl">
      <div
        class="mt-4 p-4 sm:p-6 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-sm bg-white dark:bg-neutral-900"
      >
        <div class="w-32 h-32 mx-auto overflow-hidden">
          <div class="scale-75 origin-center">
            <ClientOnly>
              <Qrcode :value="otpauthUrl" class="mx-auto" />
            </ClientOnly>
          </div>
        </div>
        <p class="text-center mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {{ $t('profile.scanTotp') }}
        </p>
      </div>
      <div class="relative mt-6">
        <input
          v-model="totpCode"
          type="text"
          :placeholder="$t('profile.enterTotpCode')"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-3 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
          :class="{ 'border-red-500 dark:border-red-500': error }"
        />
        <p v-if="error" class="text-xs sm:text-sm text-red-500 dark:text-red-400 mt-1">
          {{ error }}
        </p>
      </div>
      <Button
        :disabled="isLoading || !totpCode"
        class="w-full inline-flex justify-center items-center px-4 sm:px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation mt-4"
        @click="verifyTotpCode"
      >
        <Icon name="mdi:check-circle" class="w-5 h-5 mr-2" />
        {{ $t('profile.verify2FA') }}
      </Button>
    </div>
    <div v-if="enabled && otpauthUrl" class="text-center">
      <div
        class="mt-4 p-4 sm:p-6 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-sm bg-white dark:bg-neutral-900"
      >
        <div class="w-40 h-40 mx-auto overflow-hidden">
          <ClientOnly>
            <Qrcode :value="otpauthUrl" class="mx-auto" />
          </ClientOnly>
        </div>
        <p class="text-center mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {{ $t('profile.scanTotp') }}
        </p>
      </div>
      <Button
        :disabled="isLoading"
        class="w-full inline-flex justify-center items-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm sm:text-base touch-manipulation mt-4"
        @click="disable2FA"
      >
        <Icon name="mdi:shield-off" class="w-5 h-5 mr-2" />
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
  (e: 'update:otpauthUrl' | 'error', value: string): void
}>()

const isLoading = shallowRef(false)
const showForm = shallowRef(false)
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)

async function enable2FA() {
  try {
    isLoading.value = true
    const response = await $fetch(`/api/users/${props.userId}`, {
      method: 'PATCH',
      body: { totpAction: 'enable' },
    })
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
    const response = await $fetch(`/api/users/${props.userId}`, {
      method: 'PATCH',
      body: { totpCode: totpCode.value },
    })
    if (response.verified) {
      showForm.value = false
      totpCode.value = ''
      error.value = null
      emit('update:enabled', true)
      emit('error', '')
    }
  } catch (err: any) {
    error.value = err.data?.message || $t('common.messages.operationFailed')
  } finally {
    isLoading.value = false
  }
}

async function disable2FA() {
  try {
    isLoading.value = true
    await $fetch(`/api/users/${props.userId}`, {
      method: 'PATCH',
      body: { totpSecret: null },
    })
    showForm.value = false
    totpCode.value = ''
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