<template>
  <UAlert
    v-if="target"
    color="neutral"
    variant="subtle"
    orientation="horizontal"
    icon="mdi:rocket-launch-outline"
    :title="$t(`admin.upgrade.${i18nKey}.description`)"
    :description="status?.trial.repeatInbox ? $t('admin.upgrade.repeatInbox') : undefined"
    close
    @update:open="dismiss"
  >
    <template #actions>
      <UButton size="sm" variant="soft" :loading :disabled="loading" @click="upgrade">
        {{ loading ? $t('admin.upgrade.loading') : $t('admin.upgrade.cta', { plan: planName(target) }) }}
      </UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
// Session, not `useClientSite()`: the banner offers a plan for whichever tenant Stripe will
// actually charge, and the host tenant is not always that one.
const { data: auth } = useAuth()
const { data: status } = await useClientSiteStatus()
const { t } = useI18n()
const toast = useToast()

const loading = shallowRef(false)

// Keyed per offered plan, so dismissing the PRO pitch does not also swallow the PREMIUM one
// the tenant becomes eligible for later. A cookie, unlike localStorage, is known during SSR.
const dismissed = useCookie<string[]>('upsell-dismissed', {
  default: () => [],
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})

const target = computed(() => {
  if (status.value?.billingProvider === 'SHOPIFY') return null
  const plan = getUpgradeTarget(auth.value?.user?.plan, status.value?.hasActiveSubscription)
  return plan && !dismissed.value.includes(plan) ? plan : null
})

const i18nKey = computed(() => (target.value === 'PREMIUM' ? 'toPremium' : 'toPro'))

const dismiss = () => {
  if (target.value) dismissed.value = [...dismissed.value, target.value]
}

const upgrade = async () => {
  if (!target.value) return
  loading.value = true
  try {
    const { url } = await $fetch<{ url: string }, '/api/stripe/subscribe'>('/api/stripe/subscribe', {
      method: 'POST',
      body: {
        plan: target.value,
        origin: window.location.origin,
      },
    })
    if (url) window.location.href = url
  } catch {
    toast.add({ color: 'error', title: t('admin.upgrade.error') })
    loading.value = false
  }
}
</script>
