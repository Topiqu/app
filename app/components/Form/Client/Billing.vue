<template>
  <div class="space-y-4">
    <div
      class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm"
    >
      <div class="text-xs uppercase text-neutral-600 dark:text-neutral-300 mb-2">
        {{ $t('common.preferences.currentPlan') }}
      </div>
      <div class="flex items-center gap-2">
        <Icon name="mdi:check-circle" class="size-7 text-emerald-500" />
        <div>
          <div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {{ client?.plan }}
          </div>
          <div class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ billingPlanText }}
          </div>
        </div>
      </div>
      <div class="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        {{ validityText }}
      </div>
    </div>

    <div
      v-if="client?.billingPlan !== 'PERMANENT' && client?.nextBillingAt"
      class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm"
    >
      <div class="flex items-center gap-2 text-xs uppercase text-neutral-600 dark:text-neutral-300 mb-2">
        <Icon name="mdi:calendar-clock" class="size-4" />
        {{ $t('common.preferences.nextPayment') }}
      </div>
      <div class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {{ nextBillingDate }}
      </div>
      <div class="text-sm text-neutral-500 dark:text-neutral-400">
        {{ nextBillingAmountText }}
      </div>
    </div>

    <div
      v-if="client?.billingPlan === 'ANNUAL'"
      class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm"
    >
      <div class="flex items-center gap-2 text-xs uppercase text-emerald-600 dark:text-emerald-400 mb-2">
        <Icon name="mdi:currency-usd-off" class="size-4" />
        {{ $t('common.preferences.savingsTitle') }}
      </div>
      <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
        {{ formatSavings }}
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div
        class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm"
      >
        <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
          {{ $t('common.preferences.monthlyTitle') }}
        </div>
        <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
          {{ formatPrice('monthly') }}
        </div>
        <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">/{{ $t('common.preferences.monthly') }}</div>
      </div>

      <div
        class="relative rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm"
      >
        <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
          {{ $t('common.preferences.annuallyTitle') }}
        </div>
        <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
          {{ formatPrice('annual') }}
        </div>
        <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">/{{ $t('common.preferences.annually') }}</div>
        <div v-if="client?.billingPlan === 'ANNUAL'" class="absolute -top-3 -right-3">
          <div
            class="flex items-center gap-1 bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg"
          >
            <Icon name="mdi:tag-outline" class="size-4" />
            -20 %
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="client && client.billingPlan !== 'PERMANENT'"
      class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-sm space-y-5"
    >
      <div v-if="(client.tokenLimit ?? 0) > 0" class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-neutral-700 dark:text-neutral-200">
            {{ $t('common.preferences.billing.tokenBalance') }}
          </span>
          <span class="tabular-nums text-neutral-500 dark:text-neutral-400">
            {{ (client.tokenRemaining ?? 0).toLocaleString() }} / {{ (client.tokenLimit ?? 0).toLocaleString() }}
          </span>
        </div>
        <div class="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${tokenPercent}%` }" />
        </div>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {{ $t('common.preferences.billing.buyTokens') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="pack in tokenPacks"
            :key="pack.id"
            variant="neutral"
            size="sm"
            :loading="pendingAction === `pack-${pack.id}`"
            @click="buyTokens(pack.id)"
          >
            <Icon name="mdi:lightning-bolt" class="mr-1.5 size-4 text-amber-500" />
            {{ (pack.tokens / 1000).toLocaleString() }}k · ${{ pack.priceUsd }}
          </Button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 pt-1">
        <Button
          v-if="hasSubscription"
          variant="neutral"
          class="flex-1"
          :loading="pendingAction === 'portal'"
          @click="openPortal"
        >
          <Icon name="mdi:receipt-text-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.manage') }}
        </Button>
        <Button v-if="upgradeTarget" class="flex-1" :loading="pendingAction === 'upgrade'" @click="upgrade">
          <Icon name="mdi:arrow-up-circle-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.upgrade', { plan: upgradeTarget }) }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClientSite } from '~/utils/buildClientSettingsForm'
import { TOKEN_PACK_LIST } from '~~/shared/utils/tokenPacks'

const { client, rate } = defineProps<{ client: ClientSite | null; rate: number }>()

const toast = useToast()
const { formatTime } = useTime()

const tokenPacks = TOKEN_PACK_LIST
const pendingAction = ref<string | null>(null)

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
    toast.error({ message: $t('common.preferences.billing.actionFailed') })
    pendingAction.value = null
  }
}

const buyTokens = (pack: string) => redirectTo('/api/stripe/checkout', `pack-${pack}`, { pack })
const openPortal = () => redirectTo('/api/stripe/portal', 'portal', {})
const upgrade = () => {
  if (!upgradeTarget.value) return
  redirectTo('/api/stripe/subscribe', 'upgrade', { plan: upgradeTarget.value })
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

  const monthlyCzk = client.monthlyPayment
  const yearlyCzk = monthlyCzk * 12
  const savingsCzk = Math.round(yearlyCzk * 0.2)

  const savingsInClientCurrency = client.currency === 'CZK' ? savingsCzk : savingsCzk / rate

  return new Intl.NumberFormat(client.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client.currency ?? 'EUR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client.currency === 'CZK' ? 0 : 2,
  }).format(savingsInClientCurrency)
})

const formatPrice = (type: 'monthly' | 'annual') => {
  const monthlyCzk = client?.monthlyPayment ?? 0
  if (monthlyCzk === 0) return '–'

  let amountCzk = type === 'monthly' ? monthlyCzk : monthlyCzk * 12

  if (type === 'annual' && client?.billingPlan === 'ANNUAL') {
    amountCzk = Math.round(amountCzk * 0.8)
  }

  const finalAmount = client?.currency === 'CZK' ? amountCzk : amountCzk / rate

  return new Intl.NumberFormat(client?.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client?.currency ?? 'EUR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client?.currency === 'CZK' ? 0 : 2,
  }).format(finalAmount)
}
</script>
