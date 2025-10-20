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
    <div v-if="showForm && otpauthUrl" class="text-center">
      <div
        class="relative mt-4 p-2 sm:p-3 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-sm bg-white dark:bg-neutral-900 sm:max-w-[22rem] w-full mx-auto"
      >
        <div
          v-if="!showQR"
          class="absolute inset-0 backdrop-blur-md bg-black/50 !dark:bg-transparent flex items-center justify-center rounded-xl z-10"
        >
          <Button
            :disabled="isLoading"
            class="rounded-full px-4 py-2 bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50 transition-transform hover:scale-110 text-sm"
            @click="showQR = true"
          >
            Show QR
          </Button>
        </div>
        <div :class="showQR ? 'opacity-100 scale-100' : 'opacity-50 scale-95'" class="transition-all duration-300">
          <div class="relative w-40 h-40 mx-auto">
            <ClientOnly>
              <Qrcode :value="otpauthUrl" class="mx-auto" />
            </ClientOnly>
          </div>
          <p class="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ $t('profile.scanTotp') }}
          </p>
          <p class="text-center mt-1 text-[10px] text-yellow-500 dark:text-yellow-400">
            ⚠️ {{ $t('profile.sensitiveInfo') }}
          </p>
          <div v-if="showQR" class="mt-3 flex justify-center">
            <Button
              size="sm"
              variant="neutral"
              class="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md px-2 py-1"
              @click="showSecret = !showSecret"
            >
              <Icon :name="showSecret ? 'mdi:eye-off' : 'mdi:eye'" class="w-4 h-4" />
              <span class="text-sm">
                {{ showSecret ? $t('profile.hideSecret') : $t('profile.showSecret') }}
              </span>
            </Button>
          </div>
          <div v-if="showSecret" class="mt-2 flex items-center justify-center gap-2">
            <code class="px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-xs">
              {{ secret }}
            </code>
            <Button size="sm" variant="neutral" class="p-1" @click="copySecret(secret)">
              <Icon name="mdi:content-copy" class="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Icon
          v-if="showQR"
          name="mdi:eye-off"
          class="w-5 h-5 absolute top-1 right-1 p-1 bg-gray-600 dark:bg-neutral-700 text-white rounded-full hover:bg-gray-700 dark:hover:bg-neutral-600 transition"
          @click="showQR = false"
        />
      </div>
      <div class="relative mt-6 max-w-xs mx-auto">
        <input
          v-model="totpCode"
          type="tel"
          pattern="[0-9]*"
          :placeholder="$t('profile.enterTotpCode')"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white px-3 sm:px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
          :class="{ 'border-red-500 dark:border-red-500': error }"
        />
        <p v-if="error" class="text-xs text-red-500 dark:text-red-400 mt-1">
          {{ error }}
        </p>
      </div>
      <Button
        :disabled="isLoading || !totpCode"
        class="w-full max-w-xs mx-auto inline-flex justify-center items-center px-4 sm:px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm touch-manipulation mt-4"
        @click="verifyTotpCode"
      >
        <Icon name="mdi:check-circle" class="w-5 h-5 mr-2" />
        {{ $t('profile.verify2FA') }}
      </Button>
    </div>
    <div v-if="enabled && otpauthUrl" class="text-center">
      <div
        class="relative mt-4 p-2 sm:p-3 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-sm bg-white dark:bg-neutral-900 sm:max-w-[22rem] w-full mx-auto"
      >
        <div
          v-if="!showQR"
          class="absolute inset-0 backdrop-blur-md bg-black/50 !dark:bg-transparent flex items-center justify-center rounded-xl z-10"
        >
          <Button
            :disabled="isLoading"
            variant="transparent"
            class="rounded-full px-4 py-2 bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 disabled:opacity-50 transition-transform hover:scale-110 text-sm"
            @click="showQR = true"
          >
            Show QR
          </Button>
        </div>
        <div :class="showQR ? 'opacity-100 scale-100' : 'opacity-50 scale-95'" class="transition-all duration-300">
          <div class="relative w-40 h-40 mx-auto">
            <ClientOnly>
              <Qrcode :value="otpauthUrl" class="mx-auto" />
            </ClientOnly>
          </div>
          <p class="text-center mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ $t('profile.scanTotp') }}
          </p>
          <p class="text-center mt-1 text-[10px] text-yellow-500 dark:text-yellow-400">
            ⚠️ {{ $t('profile.sensitiveInfo') }}
          </p>
          <div v-if="showQR" class="mt-3 flex justify-center">
            <Button
              size="sm"
              variant="neutral"
              class="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md px-2 py-1"
              @click="showSecret = !showSecret"
            >
              <Icon :name="showSecret ? 'mdi:eye-off' : 'mdi:eye'" class="w-4 h-4" />
              <span class="text-sm">
                {{ showSecret ? $t('profile.hideSecret') : $t('profile.showSecret') }}
              </span>
            </Button>
          </div>
          <div v-if="showSecret" class="mt-2 flex items-center justify-center gap-2">
            <code class="px-2 py-1 rounded bg-gray-100 dark:bg-neutral-800 text-xs">
              {{ secret }}
            </code>
            <Button size="sm" variant="neutral" class="p-1" @click="copySecret(secret)">
              <Icon name="mdi:content-copy" class="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Icon
          v-if="showQR"
          name="mdi:eye-off"
          class="w-5 h-5 absolute top-1 right-1 p-1 bg-gray-600 dark:bg-neutral-700 text-white rounded-full hover:bg-gray-700 dark:hover:bg-neutral-600 transition"
          @click="showQR = false"
        />
      </div>
      <Button
        :disabled="isLoading"
        class="w-full max-w-xs mx-auto inline-flex justify-center items-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-transform hover:scale-105 text-sm touch-manipulation mt-4"
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
const showQR = shallowRef(false)
const showSecret = shallowRef(false)
const totpCode = shallowRef('')
const error = shallowRef<string | null>(null)

const secret = computed(() => {
  try {
    const url = new URL(props.otpauthUrl)
    return url.searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
})

async function copySecret(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    alert('Copy failed')
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
    await $fetch(`/api/users/${props.userId}`, {
      method: 'PATCH',
      body: { totpSecret: null },
    })
    showForm.value = false
    showQR.value = false
    showSecret.value = false
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
