<template>
  <div
    class="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
  >
    <div
      v-if="!showQR"
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/55 backdrop-blur-[2px] dark:bg-neutral-950/60"
    >
      <UButton color="neutral" variant="soft" icon="mdi:eye-outline" @click="showQR = true">
        {{ $t('profile.showQR') }}
      </UButton>
    </div>

    <div
      class="transition-[filter,opacity] duration-200"
      :class="showQR ? 'opacity-100' : 'pointer-events-none select-none blur-[7px] opacity-30'"
      :aria-hidden="!showQR"
    >
      <div class="mx-auto size-40 rounded-lg bg-white p-1">
        <ClientOnly>
          <Qrcode :value="otpauthUrl" class="size-full" />
        </ClientOnly>
      </div>

      <p class="mt-3 text-center text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {{ $t('profile.scanTotp') }}
      </p>
      <p class="mt-1 flex items-center justify-center gap-1.5 text-center text-xs text-amber-700 dark:text-amber-400">
        <UIcon name="mdi:alert-outline" class="size-3.5 shrink-0" aria-hidden="true" />
        {{ $t('profile.sensitiveInfo') }}
      </p>

      <div v-if="showQR" class="mt-4 border-t border-neutral-200 pt-3 text-center dark:border-neutral-800">
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :icon="showSecret ? 'mdi:eye-off-outline' : 'mdi:key-outline'"
          @click="showSecret = !showSecret"
        >
          {{ showSecret ? $t('profile.hideSecret') : $t('profile.manualSetup') }}
        </UButton>

        <div v-if="showSecret" class="mt-2 flex items-center gap-2 text-left">
          <code
            class="min-w-0 flex-1 break-all rounded-lg bg-neutral-100 px-3 py-2 text-xs leading-5 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            >{{ secret }}</code
          >
          <UButton
            size="sm"
            square
            color="neutral"
            variant="soft"
            icon="mdi:content-copy"
            :aria-label="$t('common.actions.copySecret')"
            :title="$t('common.actions.copySecret')"
            @click="copySecret"
          />
        </div>
      </div>
    </div>

    <UButton
      v-if="showQR"
      size="sm"
      square
      color="neutral"
      variant="ghost"
      icon="mdi:eye-off-outline"
      class="absolute right-1.5 top-1.5"
      :aria-label="$t('profile.hideQR')"
      :title="$t('profile.hideQR')"
      @click="hideQr"
    />
  </div>
</template>

<script setup lang="ts">
const { otpauthUrl } = defineProps<{ otpauthUrl: string }>()

const toast = useAppToast()
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

function hideQr() {
  showQR.value = false
  showSecret.value = false
}

async function copySecret() {
  try {
    await copy(secret.value)
    toast.success({ message: $t('profile.secretCopied') })
  } catch {
    toast.error({ message: $t('common.messages.operationFailed') })
  }
}

// Re-arming 2FA hands over a new secret; the old QR must not stay on screen.
watch(() => otpauthUrl, hideQr)
</script>
