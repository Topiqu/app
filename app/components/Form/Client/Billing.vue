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

    <div v-if="(client?.monthlyPayment ?? 0) > 0" class="grid gap-4 sm:grid-cols-2">
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
          {{ $t('articles.userMenu.balanceIncludesExtras') }}
        </p>
      </div>

      <div class="space-y-2">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {{ $t('common.preferences.billing.buyTokens') }}
        </span>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            v-for="pack in tokenPacks"
            :key="pack.id"
            type="button"
            class="group relative min-w-0 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            :class="
              pack.featured
                ? 'border-primary bg-primary/5 shadow-sm hover:bg-primary/10'
                : 'border-default bg-elevated hover:border-primary/40 hover:bg-muted'
            "
            :disabled="pendingAction !== null"
            :aria-label="`${pack.name}, ${pack.price}`"
            @click="buyTokens(pack.id)"
          >
            <span class="flex min-h-6 items-start justify-between gap-2">
              <UIcon
                :name="pendingAction === `pack-${pack.id}` ? 'i-mdi-loading' : `i-${pack.icon}`"
                class="size-5 text-warning"
                :class="pendingAction === `pack-${pack.id}` ? 'animate-spin' : ''"
              />
              <span class="flex flex-wrap justify-end gap-1">
                <UBadge v-if="pack.valueBonus" color="success" variant="soft" size="xs">
                  {{ $t('common.tokens.valueBonus', [pack.valueBonus]) }}
                </UBadge>
                <UBadge v-if="pack.featured" color="primary" variant="soft" size="xs">
                  {{ $t('common.tokens.mostTokens') }}
                </UBadge>
              </span>
            </span>
            <span class="mt-3 block text-xl font-bold tabular-nums text-highlighted">
              {{ pack.tokens.toLocaleString(locale) }}
            </span>
            <span class="block text-xs text-muted">{{ $t('common.tokens.tokens') }}</span>
            <span class="mt-3 block border-t border-default pt-2 text-sm font-semibold text-highlighted">
              {{ pack.price }}
            </span>
          </button>
        </div>
      </div>

      <div v-if="hasSubscription" class="flex pt-1">
        <UButton color="neutral" variant="soft" :loading="pendingAction === 'portal'" @click="openPortal">
          <Icon name="mdi:receipt-text-outline" class="mr-1.5 size-4" />
          {{ $t('common.preferences.billing.manage') }}
        </UButton>
      </div>
    </div>

    <section
      v-if="upgradeTarget"
      class="overflow-hidden rounded-[var(--topiqu-surface-radius)] bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-5 ring ring-primary-200 dark:from-primary-950/50 dark:via-neutral-900 dark:to-emerald-950/30 dark:ring-primary-800 sm:p-6"
    >
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div class="min-w-0">
          <UBadge color="primary" variant="soft" icon="i-mdi-rocket-launch">
            {{ $t('common.preferences.billing.recommended') }}
          </UBadge>
          <h2 class="mt-3 text-xl font-bold text-highlighted sm:text-2xl">
            {{ $t(`admin.upgrade.${upsellKey}.title`) }}
          </h2>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {{ $t(`admin.upgrade.${upsellKey}.description`) }}
          </p>
          <ul class="mt-4 grid gap-x-6 gap-y-2 text-sm text-toned sm:grid-cols-2">
            <li v-for="feature in upsellFeatures" :key="feature" class="flex items-start gap-2">
              <span class="mt-0.5 shrink-0 text-emerald-500">
                <UIcon name="i-mdi-check-circle" size="18" />
              </span>
              <span>{{ feature }}</span>
            </li>
          </ul>
        </div>

        <div class="min-w-[15rem] rounded-xl bg-default/85 p-4 ring ring-default backdrop-blur-sm">
          <div class="flex items-center gap-1 rounded-full bg-elevated p-1">
            <UButton
              type="button"
              size="sm"
              :color="checkoutInterval === 'month' ? 'primary' : 'neutral'"
              :variant="checkoutInterval === 'month' ? 'solid' : 'ghost'"
              :ui="{ base: 'flex-1 rounded-full' }"
              :aria-pressed="checkoutInterval === 'month'"
              @click="checkoutInterval = 'month'"
            >
              {{ $t('common.preferences.billing.intervalMonthly') }}
            </UButton>
            <UButton
              type="button"
              size="sm"
              :color="checkoutInterval === 'year' ? 'primary' : 'neutral'"
              :variant="checkoutInterval === 'year' ? 'solid' : 'ghost'"
              :ui="{ base: 'flex-1 rounded-full' }"
              :aria-pressed="checkoutInterval === 'year'"
              @click="checkoutInterval = 'year'"
            >
              {{ $t('common.preferences.billing.intervalAnnual') }}
              <span class="text-[10px] font-bold">−20 %</span>
            </UButton>
          </div>

          <div class="mt-4 min-h-14">
            <template v-if="selectedPlanPrice">
              <div class="flex items-end gap-1">
                <strong class="text-3xl font-bold tracking-tight text-highlighted">{{ formattedPlanPrice }}</strong>
                <span class="pb-1 text-sm text-muted">/{{ selectedPricePeriod }}</span>
              </div>
              <p v-if="checkoutInterval === 'year'" class="mt-1 text-xs text-muted">
                {{ $t('common.preferences.billing.annualEquivalent', { price: formattedMonthlyEquivalent }) }}
              </p>
            </template>
            <p v-else class="text-sm text-muted">{{ $t('common.preferences.billing.priceUnavailable') }}</p>
          </div>

          <UButton
            class="mt-4"
            icon="i-mdi-arrow-up-circle-outline"
            :loading="pendingAction === 'upgrade'"
            @click="upgrade"
          >
            {{ $t('common.preferences.billing.upgrade', { plan: upgradeTarget }) }}
          </UButton>
          <p class="mt-3 text-xs leading-relaxed text-muted">{{ $t('common.preferences.billing.checkoutHint') }}</p>
        </div>
      </div>
    </section>

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
        <USkeleton v-for="index in 3" :key="index" class="h-11 w-full" />
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
            <UButton
              v-if="invoice.hostedUrl"
              :to="invoice.hostedUrl"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="soft"
              size="sm"
              trailingIcon="i-mdi-open-in-new"
            >
              {{ $t('common.preferences.billing.viewInvoice') }}
            </UButton>
            <UButton
              v-if="invoice.pdfUrl"
              :to="invoice.pdfUrl"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              icon="i-mdi-file-pdf-box"
              :aria-label="$t('common.preferences.billing.downloadInvoice', { number: invoice.number ?? '' })"
              :title="$t('common.preferences.billing.downloadPdf')"
            />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PlanPrice, PlanPricing } from '~~/shared/types/planPricing'
import type { BillingInvoice, BillingInvoiceStatus } from '~~/shared/types/billing'

import { getUpgradeTarget } from '~~/shared/utils/plans'

import type { ClientSite } from '~/utils/buildClientSettingsForm'

import { buildTokenPackViews } from '~/utils/tokenPackPresentation'

const { client, rate } = defineProps<{ client: ClientSite | null; rate: number }>()

const toast = useAppToast()
const { locale, tm, rt, t } = useI18n()
const { formatTime } = useTime()

const tokenPacks = computed(() => buildTokenPackViews(t, locale.value))
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
const { data: planPricing } = await useLazyFetch<PlanPricing>('/api/stripe/plans', {
  immediate: Boolean(upgradeTarget.value),
  default: () => ({ PRO: { month: null, year: null }, PREMIUM: { month: null, year: null } }),
})
const upsellKey = computed(() => (upgradeTarget.value === 'PREMIUM' ? 'toPremium' : 'toPro'))
const upsellFeatures = computed<string[]>(() => {
  const messages = tm(`admin.upgrade.${upsellKey.value}.features`) as unknown[]
  return Array.isArray(messages) ? messages.map((message) => rt(message as string)) : []
})
const selectedPlanPrice = computed<PlanPrice | null>(() => {
  if (!upgradeTarget.value) return null
  return planPricing.value?.[upgradeTarget.value]?.[checkoutInterval.value] ?? null
})
const formatMinorAmount = (amount: number, currency: string) => {
  const formatter = new Intl.NumberFormat(locale.value, { style: 'currency', currency })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amount / 10 ** digits)
}
const formattedPlanPrice = computed(() => {
  const price = selectedPlanPrice.value
  return price ? formatMinorAmount(price.amount, price.currency) : ''
})
const formattedMonthlyEquivalent = computed(() => {
  const price = selectedPlanPrice.value
  return price ? formatMinorAmount(Math.round(price.amount / 12), price.currency) : ''
})
const selectedPricePeriod = computed(() =>
  checkoutInterval.value === 'year' ? $t('common.preferences.annually') : $t('common.preferences.monthly'),
)

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
