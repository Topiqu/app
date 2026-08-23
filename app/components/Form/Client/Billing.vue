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
            {{ (client.tokenRemaining ?? 0).toLocaleString() }}
          </span>
        </div>
        <div v-if="!balanceIncludesExtras" class="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${tokenPercent}%` }" />
        </div>
        <p v-else class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ $t('articles.userMenu.balanceIncludesExtras', [(client.tokenLimit ?? 0).toLocaleString()]) }}
        </p>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {{ $t('common.preferences.billing.buyTokens') }}
        </span>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="pack in tokenPacks"
            :key="pack.id"
            color="neutral"
            variant="soft"
            size="sm"
            :loading="pendingAction === `pack-${pack.id}`"
            @click="buyTokens(pack.id)"
          >
            <Icon name="mdi:lightning-bolt" class="mr-1.5 size-4 text-amber-500" />
            {{ (pack.tokens / 1000).toLocaleString(locale) }}k · {{ formatTokenPackPrice(pack, locale) }}
          </UButton>
        </div>
      </div>

      <div
        v-if="upgradeTarget"
        class="flex items-center gap-1 self-start rounded-full bg-neutral-100 dark:bg-neutral-800 p-1"
      >
        <UButton
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium transition"
          :class="
            checkoutInterval === 'month'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400'
          "
          :aria-pressed="checkoutInterval === 'month'"
          @click="checkoutInterval = 'month'"
        >
          {{ $t('common.preferences.billing.intervalMonthly') }}
        </UButton>
        <UButton
          type="button"
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition"
          :class="
            checkoutInterval === 'year'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400'
          "
          :aria-pressed="checkoutInterval === 'year'"
          @click="checkoutInterval = 'year'"
        >
          {{ $t('common.preferences.billing.intervalAnnual') }}
          <span
            class="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
          >
            -20 %
          </span>
        </UButton>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 pt-1">
        <UButton
          v-if="hasSubscription"
          color="neutral"
          variant="soft"
          class="flex-1"
          :loading="pendingAction === 'portal'"
          @click="openPortal"
        >
          <Icon name="mdi:receipt-text-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.manage') }}
        </UButton>
        <UButton v-if="upgradeTarget" class="flex-1" :loading="pendingAction === 'upgrade'" @click="upgrade">
          <Icon name="mdi:arrow-up-circle-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.upgrade', { plan: upgradeTarget }) }}
        </UButton>
      </div>
    </div>

    <section
      v-if="hasSubscription"
      class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden"
      aria-labelledby="billing-invoices-title"
    >
      <div
        class="flex flex-col gap-3 border-b border-neutral-200 p-5 dark:border-neutral-700 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="billing-invoices-title" class="font-semibold text-neutral-900 dark:text-neutral-100">
            {{ $t('common.preferences.billing.invoicesTitle') }}
          </h2>
          <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {{ $t('common.preferences.billing.invoicesDescription') }}
          </p>
        </div>
        <UButton color="neutral" variant="soft" size="sm" :loading="pendingAction === 'portal'" @click="openPortal">
          <Icon name="mdi:cog-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.openPortal') }}
        </UButton>
      </div>

      <div v-if="invoiceStatus === 'pending'" class="space-y-3 p-5" role="status">
        <div v-for="index in 3" :key="index" class="h-11 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        <span class="sr-only">{{ $t('common.preferences.billing.invoicesLoading') }}</span>
      </div>

      <div v-else-if="invoiceError" class="p-5 text-sm text-neutral-600 dark:text-neutral-300">
        <p>{{ $t('common.preferences.billing.invoicesFailed') }}</p>
        <UButton class="mt-3" color="neutral" variant="soft" size="sm" @click="refreshInvoices()">
          {{ $t('common.preferences.billing.retry') }}
        </UButton>
      </div>

      <div v-else-if="!invoices?.length" class="p-5 text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('common.preferences.billing.invoicesEmpty') }}
      </div>

      <ul v-else class="divide-y divide-neutral-200 dark:divide-neutral-700">
        <li v-for="invoice in invoices" :key="invoice.id" class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-neutral-900 dark:text-neutral-100">
                {{ invoice.number ?? $t('common.preferences.billing.invoice') }}
              </span>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="invoiceStatusClass(invoice.status)">
                {{ invoiceStatusText(invoice.status) }}
              </span>
            </div>
            <div class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {{ formatTime(invoice.createdAt, 'short', client?.language) }}
            </div>
          </div>
          <div class="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {{ formatInvoiceAmount(invoice.amount, invoice.currency) }}
          </div>
          <div class="flex items-center gap-2">
            <a
              v-if="invoice.hostedUrl"
              :href="invoice.hostedUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 px-2 text-sm text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {{ $t('common.preferences.billing.viewInvoice') }}
              <Icon name="mdi:open-in-new" class="ml-1.5 size-3.5" />
            </a>
            <a
              v-if="invoice.pdfUrl"
              :href="invoice.pdfUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex size-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-neutral-800"
              :aria-label="$t('common.preferences.billing.downloadInvoice', { number: invoice.number ?? '' })"
              :title="$t('common.preferences.billing.downloadPdf')"
            >
              <Icon name="mdi:file-pdf-box" class="size-5" />
            </a>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { BillingInvoice, BillingInvoiceStatus } from '~~/shared/types/billing'

import { getUpgradeTarget } from '~~/shared/utils/plans'
import { TOKEN_PACK_LIST, formatTokenPackPrice } from '~~/shared/utils/tokenPacks'

import type { ClientSite } from '~/utils/buildClientSettingsForm'

const { client, rate } = defineProps<{ client: ClientSite | null; rate: number }>()

const toast = useAppToast()
const { locale } = useI18n()
const { formatTime } = useTime()

const tokenPacks = TOKEN_PACK_LIST
const pendingAction = ref<string | null>(null)
const checkoutInterval = ref<'month' | 'year'>(client?.billingPlan === 'ANNUAL' ? 'year' : 'month')

const tokenPercent = computed(() => {
  const limit = client?.tokenLimit ?? 0
  if (limit <= 0) return 0
  return Math.min(100, Math.round(((client?.tokenRemaining ?? 0) / limit) * 100))
})
const balanceIncludesExtras = computed(() => (client?.tokenRemaining ?? 0) > (client?.tokenLimit ?? 0))

const hasSubscription = computed(() => !!client?.stripeCustomerId)

const {
  data: invoices,
  error: invoiceError,
  status: invoiceStatus,
  refresh: refreshInvoices,
} = await useLazyFetch<BillingInvoice[]>('/api/stripe/invoices', {
  immediate: hasSubscription.value,
  default: () => [],
})

const upgradeTarget = computed(() => getUpgradeTarget(client?.plan, !!client?.stripeSubscriptionId))

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

const formatInvoiceAmount = (amount: number, currency: string) => {
  const formatter = new Intl.NumberFormat(locale.value, { style: 'currency', currency })
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amount / 10 ** fractionDigits)
}

const invoiceStatusText = (status: BillingInvoiceStatus | null) =>
  $t(`common.preferences.billing.invoiceStatus.${status ?? 'unknown'}`)

const invoiceStatusClass = (status: BillingInvoiceStatus | null) => {
  if (status === 'paid') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  if (status === 'open') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  if (status === 'void') return 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400'
  if (status === 'uncollectible') return 'bg-red-500/15 text-red-700 dark:text-red-400'
  return 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
}

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
