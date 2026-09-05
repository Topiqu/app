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
        <h2 id="consent-title" class="font-bold text-highlighted">{{ $t('common.consent.title') }}</h2>
        <p id="consent-description" class="mt-1 text-sm leading-6 text-muted">{{ $t('common.consent.banner') }}</p>
      </div>
    </div>
    <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <UButton color="neutral" variant="ghost" @click="rejectAll">
        {{ $t('common.consent.reject') }}
      </UButton>
      <UButton color="neutral" variant="soft" @click="settingsOpen = true">
        {{ $t('common.consent.customize') }}
      </UButton>
      <UButton @click="acceptAll">{{ $t('common.consent.accept') }}</UButton>
    </div>
  </div>

  <UModal v-model:open="settingsOpen" :title="$t('common.consent.settingsTitle')" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-4 rounded-[var(--ui-radius)] border border-default p-4">
          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.consent.technicalTitle') }}</h3>
            <p class="mt-1 text-sm leading-5 text-muted">{{ $t('common.consent.technicalDescription') }}</p>
          </div>
          <UBadge color="neutral" variant="soft">{{ $t('common.consent.alwaysOn') }}</UBadge>
        </div>

        <div
          v-if="capabilities.analytics"
          class="flex items-start justify-between gap-4 rounded-[var(--ui-radius)] border border-default p-4"
        >
          <label for="consent-analytics" class="min-w-0 cursor-pointer">
            <span class="font-semibold text-highlighted">{{ $t('common.consent.analyticsTitle') }}</span>
            <span class="mt-1 block text-sm leading-5 text-muted">{{ $t('common.consent.analyticsDescription') }}</span>
          </label>
          <USwitch id="consent-analytics" v-model="analyticsDraft" class="shrink-0" />
        </div>

        <div
          v-if="capabilities.marketing"
          class="flex items-start justify-between gap-4 rounded-[var(--ui-radius)] border border-default p-4"
        >
          <label for="consent-marketing" class="min-w-0 cursor-pointer">
            <span class="font-semibold text-highlighted">{{ $t('common.consent.marketingTitle') }}</span>
            <span class="mt-1 block text-sm leading-5 text-muted">{{ $t('common.consent.marketingDescription') }}</span>
          </label>
          <USwitch id="consent-marketing" v-model="marketingDraft" class="shrink-0" />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <UButton color="neutral" variant="ghost" @click="rejectAll">
          {{ $t('common.consent.reject') }}
        </UButton>
        <div class="flex flex-col-reverse gap-2 sm:flex-row">
          <UButton color="neutral" variant="soft" @click="saveDraft">
            {{ $t('common.consent.save') }}
          </UButton>
          <UButton @click="acceptAll">{{ $t('common.consent.accept') }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

const props = defineProps<{
  site: PublicClientSite | null | undefined
  enabled: boolean
}>()
const { decision, settingsOpen, capabilities, needsDecision, analyticsGranted, marketingGranted, save } = useConsent(
  () => props.site,
)
const { gtag, initialize, enableAnalytics, disableAnalytics } = useGtag()
const analyticsDraft = shallowRef(false)
const marketingDraft = shallowRef(false)

const showBanner = computed(() => props.enabled && needsDecision.value && !settingsOpen.value)
const analyticsActive = computed(() => props.enabled && analyticsGranted.value)
watch(
  settingsOpen,
  (open) => {
    if (!open) return
    analyticsDraft.value = decision.value?.analytics ?? false
    marketingDraft.value = decision.value?.marketing ?? false
  },
  { immediate: true },
)

const applyChoice = async (choices: { analytics: boolean; marketing: boolean }) => {
  const reloadWithoutMarketing = decision.value?.marketing === true && !choices.marketing
  save(choices)
  if (reloadWithoutMarketing) {
    await nextTick()
    window.location.reload()
  }
}

const saveDraft = () =>
  applyChoice({
    analytics: analyticsDraft.value,
    marketing: marketingDraft.value,
  })
const acceptAll = () => applyChoice({ analytics: true, marketing: true })
const rejectAll = () => applyChoice({ analytics: false, marketing: false })

const removeAnalyticsCookies = () => {
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name && (/^_ga/.test(name) || /^_gid$/.test(name))))
  const hostnameParts = window.location.hostname.split('.')
  const domains = hostnameParts.map((_, index) => `.${hostnameParts.slice(index).join('.')}`)

  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`
    }
  }
}

if (import.meta.client) {
  watch(
    [analyticsActive, analyticsGranted, marketingGranted],
    ([active, consented, marketing]) => {
      const id = capabilities.value.googleAnalytics ? props.site?.gtagId?.trim() : null
      if (!id) return
      const adConsent = marketing ? 'granted' : 'denied'

      if (active) {
        initialize(id)
        enableAnalytics(id)
        gtag('consent', 'update', {
          analytics_storage: 'granted',
          ad_storage: adConsent,
          ad_user_data: adConsent,
          ad_personalization: adConsent,
        })
        return
      }

      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: adConsent,
        ad_user_data: adConsent,
        ad_personalization: adConsent,
      })
      disableAnalytics(id)
      if (!consented) removeAnalyticsCookies()
    },
    { immediate: true },
  )
}
</script>
