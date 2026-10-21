<template>
  <div
    v-if="showBanner"
    class="z-popover fixed inset-x-3 bottom-3 mx-auto max-w-3xl rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-2xl sm:bottom-5 sm:p-5"
    role="dialog"
    aria-modal="false"
    aria-labelledby="consent-title"
    aria-describedby="consent-description"
  >
    <div class="flex items-start gap-3">
      <UIcon name="mdi:cookie-outline" size="24" class="mt-0.5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1">
        <h2 id="consent-title" class="font-semibold text-highlighted">{{ $t('common.consent.title') }}</h2>
        <p id="consent-description" class="mt-1 text-sm leading-6 text-muted">{{ bannerText }}</p>
      </div>
    </div>
    <div class="mt-4 grid gap-2 sm:grid-cols-3">
      <UButton
        color="neutral"
        variant="soft"
        block
        size="lg"
        class="h-auto min-h-11 whitespace-normal text-center"
        :ui="{ label: 'whitespace-normal' }"
        @click="rejectAll"
      >
        {{ $t('common.consent.reject') }}
      </UButton>
      <UButton
        color="neutral"
        variant="soft"
        block
        size="lg"
        class="h-auto min-h-11 whitespace-normal text-center"
        :ui="{ label: 'whitespace-normal' }"
        @click="acceptAll"
      >
        {{ $t('common.consent.accept') }}
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        block
        size="lg"
        class="h-auto min-h-11 whitespace-normal text-center"
        :ui="{ label: 'whitespace-normal' }"
        @click="settingsOpen = true"
      >
        {{ $t('common.consent.customize') }}
      </UButton>
    </div>
  </div>
  <LazyConsentSettings
    v-if="site && settingsMounted"
    v-model:open="settingsOpen"
    :site="site"
    :capabilities="capabilities"
    :decision="decision"
    @save="applyChoice"
    @accept="acceptAll"
    @reject="rejectAll"
  />
</template>

<script setup lang="ts">
import type { ConsentCapabilities } from '~~/shared/utils/consent'
import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

const props = defineProps<{ site: PublicClientSite | null | undefined; enabled: boolean }>()
const { t } = useI18n()
const { decision, settingsOpen, capabilities, needsDecision, analyticsGranted, marketingGranted, save } = useConsent(
  () => props.site,
)
const currentCapabilities = useState<ConsentCapabilities | null>('consent-capabilities', () => null)
// Retain the dialog after first opening so its close transition and focus restoration finish.
const settingsMounted = computed<boolean>((previous) => Boolean(previous || settingsOpen.value))
watch(capabilities, (value) => (currentCapabilities.value = value), { immediate: true, flush: 'sync' })
useGoogleAnalyticsConsent(
  () => props.site,
  () => props.enabled,
)

const showBanner = computed(() => props.enabled && needsDecision.value && !settingsOpen.value)
const bannerText = computed(() =>
  [
    t('common.consent.banner'),
    ...(capabilities.value.analytics ? [t('common.consent.bannerAnalytics')] : []),
    ...(capabilities.value.marketing ? [t('common.consent.bannerMarketing')] : []),
  ].join(' '),
)

let cleanup: Promise<unknown> | undefined
const clearAnalytics = () => {
  cleanup ??= $fetch('/api/consent/analytics', { method: 'DELETE', timeout: 3000 })
    .catch(() => {})
    .finally(() => {
      cleanup = undefined
    })
  return cleanup
}
watch(analyticsGranted, (granted, previous) => {
  if (previous && !granted) void clearAnalytics()
})
watch(marketingGranted, async (granted, previous) => {
  if (!previous || granted || !props.enabled) return
  if (!analyticsGranted.value) await clearAnalytics()
  window.location.reload()
})
const applyChoice = (choices: { analytics: boolean; marketing: boolean }) => {
  save(choices)
  if (!choices.analytics) void clearAnalytics()
}
const acceptAll = () => applyChoice({ analytics: true, marketing: true })
const rejectAll = () => applyChoice({ analytics: false, marketing: false })
</script>
