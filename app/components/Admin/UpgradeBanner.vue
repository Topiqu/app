<template>
  <UAlert
    v-if="target"
    color="primary"
    variant="soft"
    icon="i-mdi-rocket-launch"
    :title="$t(`admin.upgrade.${i18nKey}.title`)"
    :description="$t(`admin.upgrade.${i18nKey}.description`)"
    :ui="{ root: 'relative pr-12' }"
  >
    <UButton
      class="absolute right-3 top-3"
      color="neutral"
      variant="ghost"
      icon="i-mdi-close"
      square
      size="sm"
      :aria-label="$t('common.close')"
      @click="dismiss"
    />
    <template #description>
      <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1">
        <li v-for="feature in features" :key="feature" class="flex items-start gap-2 text-sm leading-relaxed">
          <UIcon size="16" name="i-mdi-check-circle" class="mt-0.5 shrink-0" />
          <span>{{ feature }}</span>
        </li>
      </ul>
    </template>
    <template #actions>
      <div>
        <UButton
          color="primary"
          variant="solid"
          icon="i-mdi-star-four-points"
          :loading="loading"
          :disabled="loading"
          @click="upgrade"
        >
          {{ loading ? $t('admin.upgrade.loading') : $t('admin.upgrade.cta', { plan: target }) }}
        </UButton>
      </div>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
import { getUpgradeTarget } from '~~/shared/utils/plans'

// Session, not `useClientSite()`: the banner offers a plan for whichever tenant Stripe will
// actually charge, and the host tenant is not always that one.
const { data: auth } = useAuth()
const { data: status } = await useClientSiteStatus()
const { t, tm, rt } = useI18n()
const toast = useToast()

const loading = shallowRef(false)

// Keyed per offered plan, so dismissing the PRO pitch does not also swallow the PREMIUM one
// the tenant becomes eligible for later.
const dismissed = useLocalStorage<string[]>('upsell-dismissed', [])

const target = computed(() => {
  const plan = getUpgradeTarget(auth.value?.user?.plan, status.value?.hasActiveSubscription)
  return plan && !dismissed.value.includes(plan) ? plan : null
})

const i18nKey = computed(() => (target.value === 'PREMIUM' ? 'toPremium' : 'toPro'))

const features = computed<string[]>(() => {
  if (!target.value) return []
  const messages = tm(`admin.upgrade.${i18nKey.value}.features`) as unknown[]
  return Array.isArray(messages) ? messages.map((m) => rt(m as string)) : []
})

const dismiss = () => {
  if (target.value) dismissed.value = [...dismissed.value, target.value]
}

const upgrade = async () => {
  if (!target.value) return
  loading.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/stripe/subscribe', {
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
