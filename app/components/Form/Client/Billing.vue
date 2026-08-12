<template>
  <div class="space-y-4">
    <UCard>
      <div class="mb-2 text-xs uppercase text-muted">
        {{ $t('common.preferences.currentPlan') }}
      </div>
      <div class="flex items-center gap-2">
        <UIcon size="28" name="i-mdi-check-circle" class="text-success" />
        <div>
          <div class="text-2xl font-bold text-highlighted">
            {{ client?.plan }}
          </div>
          <div class="text-sm text-muted">
            {{ billingPlanText }}
          </div>
        </div>
      </div>
      <div class="mt-3 text-sm text-muted">
        {{ validityText }}
      </div>
    </UCard>

    <UCard v-if="client?.billingPlan !== 'PERMANENT' && client?.nextBillingAt">
      <div class="mb-2 flex items-center gap-2 text-xs uppercase text-muted">
        <UIcon size="16" name="i-mdi-calendar-clock" />
        {{ $t('common.preferences.nextPayment') }}
      </div>
      <div class="text-2xl font-bold text-highlighted">
        {{ nextBillingDate }}
      </div>
      <div class="text-sm text-muted">
        {{ nextBillingAmountText }}
      </div>
    </UCard>

    <UCard v-if="client?.billingPlan === 'ANNUAL'">
      <div class="mb-2 flex items-center gap-2 text-xs uppercase text-success">
        <UIcon size="16" name="i-mdi-currency-usd-off" />
        {{ $t('common.preferences.savingsTitle') }}
      </div>
      <div class="text-2xl font-bold text-success">
        {{ formatSavings }}
      </div>
    </UCard>

    <div class="grid gap-4 sm:grid-cols-2">
      <UCard>
        <div class="mb-1 text-xs uppercase tracking-wider text-muted">
          {{ $t('common.preferences.monthlyTitle') }}
        </div>
        <div class="text-4xl font-bold tracking-tight text-highlighted">
          {{ formatPrice('monthly') }}
        </div>
        <div class="mt-1 text-xs text-muted">/{{ $t('common.preferences.monthly') }}</div>
      </UCard>

      <UCard class="relative">
        <div class="mb-1 text-xs uppercase tracking-wider text-muted">
          {{ $t('common.preferences.annuallyTitle') }}
        </div>
        <div class="text-4xl font-bold tracking-tight text-highlighted">
          {{ formatPrice('annual') }}
        </div>
        <div class="mt-1 text-xs text-muted">/{{ $t('common.preferences.annually') }}</div>
        <div v-if="client?.billingPlan === 'ANNUAL'" class="absolute -top-3 -right-3">
          <UBadge color="success" variant="solid" icon="i-mdi-tag-outline">-20 %</UBadge>
        </div>
      </UCard>
    </div>

    <UCard v-if="client && client.billingPlan !== 'PERMANENT'">
      <div class="space-y-5">
        <div v-if="(client.tokenLimit ?? 0) > 0" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-highlighted">
              {{ $t('common.preferences.billing.tokenBalance') }}
            </span>
            <span class="tabular-nums text-muted">
              {{ formatNumber(client.tokenRemaining ?? 0) }} / {{ formatNumber(client.tokenLimit ?? 0) }}
            </span>
          </div>
          <UProgress color="success" :modelValue="tokenPercent" :max="100" />
        </div>

        <div class="space-y-2">
          <span class="text-sm font-medium text-highlighted">
            {{ $t('common.preferences.billing.buyTokens') }}
          </span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="pack in tokenPacks"
              :key="pack.id"
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-mdi-lightning-bolt"
              :loading="pendingAction === `pack-${pack.id}`"
              @click="buyTokens(pack.id)"
            >
              {{ (pack.tokens / 1000).toLocaleString() }}k · ${{ pack.priceUsd }}
            </UButton>
          </div>
        </div>

        <UFieldGroup v-if="upgradeTarget">
          <UButton
            :color="checkoutInterval === 'month' ? 'primary' : 'neutral'"
            :variant="checkoutInterval === 'month' ? 'solid' : 'ghost'"
            type="button"
            :aria-pressed="checkoutInterval === 'month'"
            @click="checkoutInterval = 'month'"
          >
            {{ $t('common.preferences.billing.intervalMonthly') }}
          </UButton>
          <UButton
            :color="checkoutInterval === 'year' ? 'primary' : 'neutral'"
            :variant="checkoutInterval === 'year' ? 'solid' : 'ghost'"
            type="button"
            :aria-pressed="checkoutInterval === 'year'"
            @click="checkoutInterval = 'year'"
          >
            {{ $t('common.preferences.billing.intervalAnnual') }}
            <UBadge color="success" variant="soft" size="sm">-20 %</UBadge>
          </UButton>
        </UFieldGroup>

        <div class="flex flex-col sm:flex-row gap-3 pt-1">
          <UButton
            v-if="hasSubscription"
            color="neutral"
            variant="soft"
            icon="i-mdi-receipt-text-outline"
            class="flex-1"
            :loading="pendingAction === 'portal'"
            @click="openPortal"
          >
            {{ $t('common.preferences.billing.manage') }}
          </UButton>
          <UButton
            v-if="upgradeTarget"
            icon="i-mdi-arrow-up-circle-outline"
            class="flex-1"
            :loading="pendingAction === 'upgrade'"
            @click="upgrade"
          >
            {{ $t('common.preferences.billing.upgrade', { plan: upgradeTarget }) }}
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { TOKEN_PACK_LIST } from '~~/shared/utils/tokenPacks'

import type { ClientSite } from '~/utils/buildClientSettingsForm'

const { client, rate } = defineProps<{ client: ClientSite | null; rate: number }>()

const toast = useToast()
const { formatTime } = useTime()
const { locale } = useI18n()
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value === 'cs' ? 'cs-CZ' : 'en-US').format(value)

const tokenPacks = TOKEN_PACK_LIST
const pendingAction = ref<string | null>(null)
const checkoutInterval = ref<'month' | 'year'>(client?.billingPlan === 'ANNUAL' ? 'year' : 'month')

const tokenPercent = computed(() => {
  const limit = client?.tokenLimit ?? 0
  if (limit <= 0) return 0
  return Math.min(100, Math.round(((client?.tokenRemaining ?? 0) / limit) * 100))
})

const hasSubscription = computed(() => !!client?.stripeCustomerId)

const upgradeTarget = computed<'PRO' | 'PREMIUM' | null>(() => {
  // A fresh Stripe subscription checkout is only for sites without an active one;
  // subscribers change plans through the portal to keep proration correct.
  if (client?.stripeSubscriptionId) return null
  if (client?.plan === 'BASIC') return 'PRO'
  if (client?.plan === 'PRO') return 'PREMIUM'
  return null
})

const redirectTo = async (url: string, action: string, body: Record<string, unknown>) => {
  pendingAction.value = action
  try {
    const res = await $fetch<{ url: string | null }>(url, {
      method: 'POST',
      body: { ...body, origin: window.location.origin },
    })
    if (res.url) window.location.href = res.url
    else throw new Error('no url')
  } catch {
    toast.add({ color: 'error', title: $t('common.preferences.billing.actionFailed') })
    pendingAction.value = null
  }
}

const buyTokens = (pack: string) => redirectTo('/api/stripe/checkout', `pack-${pack}`, { pack })
const openPortal = () => redirectTo('/api/stripe/portal', 'portal', {})
const upgrade = () => {
  if (!upgradeTarget.value) return
  redirectTo('/api/stripe/subscribe', 'upgrade', { plan: upgradeTarget.value, interval: checkoutInterval.value })
}

const billingPlanText = computed(() => {
  if (!client) return ''
  if (client.billingPlan === 'PERMANENT') return $t('common.preferences.billing.permanent')
  if (client.billingPlan === 'ANNUAL') return $t('common.preferences.billing.annual')
  return $t('common.preferences.billing.monthly')
})

const validityText = computed(() => {
  if (!client) return ''
  if (client.billingPlan === 'PERMANENT') return $t('common.preferences.validity.permanent')
  if (!client.nextBillingAt) return $t('common.preferences.validity.unknown')
  return $t('common.preferences.validity.until', {
    date: formatTime(client.nextBillingAt, 'short', client.language),
  })
})

const nextBillingDate = computed(() => {
  if (!client?.nextBillingAt) return '–'
  return formatTime(client.nextBillingAt, 'short', client.language)
})

const nextBillingAmountText = computed(() => {
  if (!client) return ''
  return client.billingPlan === 'ANNUAL'
    ? $t('common.preferences.nextBilling.annual')
    : $t('common.preferences.nextBilling.monthly')
})

const formatSavings = computed(() => {
  if (!client?.monthlyPayment) return ''

  const savingsUsd = Math.round(client.monthlyPayment * 12 * 0.2)

  return new Intl.NumberFormat(client.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client.currency ?? 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client.currency === 'CZK' ? 0 : 2,
  }).format(savingsUsd * rate)
})

const formatPrice = (type: 'monthly' | 'annual') => {
  const monthlyUsd = client?.monthlyPayment ?? 0
  if (monthlyUsd === 0) return '–'

  let amountUsd = type === 'monthly' ? monthlyUsd : monthlyUsd * 12

  if (type === 'annual' && client?.billingPlan === 'ANNUAL') {
    amountUsd = Math.round(amountUsd * 0.8)
  }

  return new Intl.NumberFormat(client?.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client?.currency ?? 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client?.currency === 'CZK' ? 0 : 2,
  }).format(amountUsd * rate)
}
</script>
