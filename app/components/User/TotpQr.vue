<template>
  <div
    class="relative mx-auto w-full max-w-[22rem] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3"
  >
    <div
      v-if="!showQR"
      class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-neutral-900/60 backdrop-blur-md"
    >
      <Button size="sm" variant="secondary" icon="mdi:eye" @click="showQR = true">{{ $t('profile.showQR') }}</Button>
    </div>

    <div class="transition-opacity duration-300" :class="showQR ? 'opacity-100' : 'opacity-40'">
      <div class="relative mx-auto size-40">
        <ClientOnly>
          <Qrcode :value="otpauthUrl" class="mx-auto" />
        </ClientOnly>
      </div>

      <p class="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">{{ $t('profile.scanTotp') }}</p>
      <p class="mt-1 text-center text-xs text-amber-600 dark:text-amber-500">{{ $t('profile.sensitiveInfo') }}</p>

      <div v-if="showQR" class="mt-3 flex flex-col items-center gap-2">
        <Button
          size="sm"
          variant="transparent"
          :icon="showSecret ? 'mdi:eye-off' : 'mdi:eye'"
          @click="showSecret = !showSecret"
        >
          {{ showSecret ? $t('profile.hideSecret') : $t('profile.showSecret') }}
        </Button>
        <div v-if="showSecret" class="flex items-center gap-2">
          <code class="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">{{ secret }}</code>
          <Button
            size="sm"
            square
            borderless
            variant="transparent"
            icon="mdi:content-copy"
            :aria="$t('common.actions.copyLink')"
            @click="copySecret"
          />
        </div>
      </div>
    </div>

    <Button
      v-if="showQR"
      size="sm"
      square
      borderless
      variant="transparent"
      icon="mdi:eye-off"
      class="absolute right-1 top-1"
      :aria="$t('profile.hideQR')"
      :title="$t('profile.hideQR')"
      @click="showQR = false"
    />
  </div>
</template>

<script setup lang="ts">
const { otpauthUrl } = defineProps<{ otpauthUrl: string }>()

const toast = useToast()
const { copy } = useClipboard({ legacy: true })

const showQR = shallowRef(false)
const showSecret = shallowRef(false)

const secret = computed(() => {
  try {
    return new URL(otpauthUrl).searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
})

async function copySecret() {
  try {
    await copy(secret.value)
    toast.success({ message: $t('common.actions.copySuccess') })
  } catch {
    toast.error({ message: $t('common.messages.operationFailed') })
  }
}

// Re-arming 2FA hands over a new secret; the old QR must not stay on screen.
watch(
  () => otpauthUrl,
  () => {
    showQR.value = false
    showSecret.value = false
  },
)
</script>
