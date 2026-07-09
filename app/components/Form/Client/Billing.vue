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
  </div>
</template>

<script setup lang="ts">
import type { ClientSite } from '~/utils/buildClientSettingsForm'

const { client, rate } = defineProps<{ client: ClientSite | null; rate: number }>()

const { formatTime } = useTime()

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
