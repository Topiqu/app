<template>
  <UModal
    v-model:open="open"
    :dismissible="!creating"
    :title="$t('common.tenant.createTitle')"
    :description="$t('common.tenant.createDescription')"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3 text-xs text-muted">
            <span>{{ $t('common.tenant.stepProgress', { current: step + 1, total: steps.length }) }}</span>
            <span class="font-medium text-highlighted">{{ steps[step]?.label }}</span>
          </div>
          <UProgress :modelValue="((step + 1) / steps.length) * 100" size="sm" />
          <ol class="grid grid-cols-4 gap-1 sm:gap-2" :aria-label="$t('common.tenant.stepsLabel')">
            <li v-for="(item, index) in steps" :key="item.id" class="min-w-0">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                :class="index === step ? 'bg-primary/10 font-semibold text-primary' : 'text-muted'"
                :aria-current="index === step ? 'step' : undefined"
                :disabled="creating"
                @click="goToStep(index)"
              >
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
                  :class="
                    index === step || isStepComplete(index)
                      ? 'border-primary bg-primary text-white'
                      : 'border-default bg-default text-muted'
                  "
                >
                  <UIcon v-if="index !== step && isStepComplete(index)" name="mdi:check" size="12" />
                  <template v-else>{{ index + 1 }}</template>
                </span>
                <span class="truncate">{{ item.label }}</span>
              </UButton>
            </li>
          </ol>
        </div>

        <div v-if="step === 0" class="space-y-5">
          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.tenant.choosePlan') }}</h3>
            <p class="mt-1 text-sm text-muted">{{ $t('common.tenant.choosePlanDescription') }}</p>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="plan in planOptions"
              :key="plan.value"
              type="button"
              class="group relative flex min-h-64 min-w-0 cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-[var(--topiqu-surface-radius)] border p-4 text-left whitespace-normal shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="planCardClass(plan.value, form.plan === plan.value)"
              :aria-pressed="form.plan === plan.value"
              @click="form.plan = plan.value"
            >
              <span class="absolute inset-x-0 top-0 h-1" :class="planAccentClass(plan.value)" aria-hidden="true" />
              <span
                class="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-35"
                :class="planGlowClass(plan.value)"
                aria-hidden="true"
              />

              <span class="relative flex w-full items-start justify-between gap-2">
                <span
                  class="flex size-11 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 dark:ring-white/10"
                  :class="planIconClass(plan.value)"
                >
                  <UIcon :name="plan.icon" size="24" />
                </span>
                <UIcon
                  v-if="form.plan === plan.value"
                  name="mdi:check-circle"
                  :class="planCheckClass(plan.value)"
                  size="21"
                />
              </span>
              <span class="relative mt-4 block w-full break-words text-sm font-bold leading-5 text-highlighted">{{
                plan.label
              }}</span>
              <span class="relative mt-1 block w-full break-words text-xs leading-5 text-muted">{{
                plan.description
              }}</span>
            </button>
          </div>

          <div v-if="form.plan !== 'BASIC'" class="rounded-xl border border-default bg-muted/40 p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="text-sm font-semibold text-highlighted">{{ $t('common.tenant.billingInterval') }}</div>
                <div class="text-xs text-muted">{{ $t('common.tenant.annualSavings') }}</div>
              </div>
              <div class="flex rounded-lg border border-default bg-default p-1">
                <UButton
                  v-for="interval in billingIntervals"
                  :key="interval"
                  type="button"
                  color="neutral"
                  size="sm"
                  :variant="form.interval === interval ? 'solid' : 'ghost'"
                  class="cursor-pointer"
                  @click="form.interval = interval"
                >
                  {{ intervalLabel(interval) }}
                </UButton>
              </div>
            </div>
          </div>

          <UAlert
            color="neutral"
            variant="soft"
            :icon="form.plan === 'BASIC' ? 'mdi:information-outline' : 'mdi:lock-outline'"
            :title="form.plan === 'BASIC' ? $t('common.tenant.basicTitle') : $t('common.tenant.checkoutTitle')"
            :description="
              form.plan === 'BASIC' ? $t('common.tenant.basicDescription') : $t('common.tenant.checkoutDescription')
            "
          />
        </div>

        <div v-else-if="step === 1" class="space-y-5">
          <UFormField :label="$t('common.tenant.language')">
            <div class="grid gap-3 sm:grid-cols-2">
              <UButton
                v-for="language in languageOptions"
                :key="language.value"
                type="button"
                color="neutral"
                variant="ghost"
                class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :class="
                  form.language === language.value
                    ? 'border-primary bg-primary/10 text-highlighted'
                    : 'border-default bg-default text-muted hover:border-primary/50 hover:bg-primary/5 hover:text-highlighted'
                "
                :aria-pressed="form.language === language.value"
                @click="form.language = language.value"
              >
                <svg
                  v-if="language.value === 'cs'"
                  viewBox="0 0 36 24"
                  class="h-6 w-9 shrink-0 rounded shadow-sm"
                  aria-hidden="true"
                >
                  <path fill="#fff" d="M0 0h36v12H0z" />
                  <path fill="#d7141a" d="M0 12h36v12H0z" />
                  <path fill="#11457e" d="m0 0 15 12L0 24z" />
                </svg>
                <svg v-else viewBox="0 0 60 36" class="h-6 w-9 shrink-0 rounded shadow-sm" aria-hidden="true">
                  <path fill="#012169" d="M0 0h60v36H0z" />
                  <path stroke="#fff" stroke-width="7" d="m0 0 60 36m0-36L0 36" />
                  <path stroke="#c8102e" stroke-width="3" d="m0 0 60 36m0-36L0 36" />
                  <path stroke="#fff" stroke-width="12" d="M30 0v36M0 18h60" />
                  <path stroke="#c8102e" stroke-width="7" d="M30 0v36M0 18h60" />
                </svg>
                <span>
                  <span class="block text-sm font-semibold">{{ language.label }}</span>
                  <span class="block text-xs text-muted">{{ language.code }}</span>
                </span>
                <UIcon
                  v-if="form.language === language.value"
                  name="mdi:check-circle"
                  class="ml-auto text-primary"
                  size="20"
                />
              </UButton>
            </div>
          </UFormField>

          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.tenant.theme') }}</h3>
            <p class="mt-1 text-sm text-muted">{{ $t('common.tenant.themeDescription') }}</p>
          </div>
          <div class="grid grid-cols-5 gap-3 sm:grid-cols-8">
            <UButton
              v-for="theme in themes"
              :key="theme"
              type="button"
              color="neutral"
              variant="ghost"
              class="relative mx-auto size-11 cursor-pointer rounded-xl border-2 shadow-sm transition-transform hover:scale-105 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="
                form.theme === theme
                  ? 'border-white ring-3 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
                  : 'border-transparent hover:border-neutral-300 dark:hover:border-neutral-600'
              "
              :style="{ backgroundColor: themeColors[theme] }"
              :aria-label="$t('common.actions.selectTheme', { theme })"
              :aria-pressed="form.theme === theme"
              @click="form.theme = theme"
            >
              <UIcon
                v-if="form.theme === theme"
                name="mdi:check-bold"
                size="20"
                class="pointer-events-none absolute inset-0 z-10 m-auto text-inverted drop-shadow-md"
              />
            </UButton>
          </div>
          <div class="flex items-center gap-3 rounded-xl border border-default bg-muted/50 p-4">
            <span class="size-9 shrink-0 rounded-lg" :style="{ backgroundColor: themeColors[form.theme] }" />
            <div>
              <div class="text-sm font-semibold text-highlighted">
                {{ form.name || $t('common.tenant.namePlaceholder') }}
              </div>
              <div class="text-xs text-muted">
                {{ languageOptions.find((item) => item.value === form.language)?.label }}
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="step === 2" class="space-y-5">
          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.tenant.chooseDomain') }}</h3>
            <p class="mt-1 text-sm text-muted">
              {{
                usesCustomDomain
                  ? $t('common.tenant.customDomainDescription')
                  : form.plan === 'BASIC'
                    ? $t('common.tenant.subdomainDescription')
                    : $t('common.tenant.paidSubdomainDescription')
              }}
            </p>
          </div>

          <UFormField v-if="form.plan !== 'BASIC'" :label="$t('common.tenant.domainType')">
            <div class="grid gap-3 sm:grid-cols-2">
              <UButton
                v-for="option in domainTypeOptions"
                :key="option.value"
                type="button"
                color="neutral"
                variant="ghost"
                class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :class="
                  form.domainType === option.value
                    ? 'border-primary bg-primary/10 text-highlighted'
                    : 'border-default bg-default text-muted hover:border-primary/50 hover:bg-primary/5 hover:text-highlighted'
                "
                :aria-pressed="form.domainType === option.value"
                @click="form.domainType = option.value"
              >
                <UIcon :name="option.icon" size="22" class="mt-0.5 shrink-0" />
                <span>
                  <span class="block text-sm font-semibold">{{ option.label }}</span>
                  <span class="mt-0.5 block text-xs leading-5 text-muted">{{ option.description }}</span>
                </span>
              </UButton>
            </div>
          </UFormField>

          <UFormField :label="$t('common.tenant.name')">
            <UInput v-model="form.name" autofocus :placeholder="$t('common.tenant.namePlaceholder')" class="w-full" />
          </UFormField>

          <UFormField :label="usesCustomDomain ? $t('common.tenant.customDomain') : $t('common.tenant.subdomain')">
            <UFieldGroup v-if="!usesCustomDomain" class="w-full">
              <UInput
                :modelValue="form.subdomain"
                class="min-w-0 flex-1"
                :placeholder="$t('common.tenant.subdomainPlaceholder')"
                @update:modelValue="setSubdomain"
              />
              <UBadge color="neutral" variant="outline" size="lg">.{{ baseDomain }}</UBadge>
            </UFieldGroup>
            <UInput
              v-else
              :modelValue="form.customDomain"
              class="w-full"
              :placeholder="$t('common.tenant.customDomainPlaceholder')"
              icon="mdi:web"
              @update:modelValue="setCustomDomain"
            />
            <template #help>
              <span v-if="availability === 'checking'" class="text-muted">{{ $t('common.tenant.checking') }}</span>
              <span v-else-if="availability === 'available'" class="inline-flex items-center gap-1 text-success">
                <UIcon name="mdi:check-circle" size="16" />
                {{ usesCustomDomain ? $t('common.tenant.customDomainAvailable') : $t('common.tenant.available') }}
              </span>
              <span v-else-if="availabilityReason" class="text-error">
                {{ $t(`common.tenant.domainReasons.${availabilityReason}`) }}
              </span>
            </template>
          </UFormField>

          <UAlert
            v-if="usesCustomDomain"
            color="neutral"
            variant="soft"
            icon="mdi:dns-outline"
            :title="$t('common.tenant.dnsTitle')"
            :description="$t('common.tenant.dnsDescription')"
          />
        </div>

        <div v-else class="space-y-5">
          <div>
            <h3 class="font-semibold text-highlighted">{{ $t('common.tenant.reviewTitle') }}</h3>
            <p class="mt-1 text-sm text-muted">{{ $t('common.tenant.reviewDescription') }}</p>
          </div>

          <dl class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default divide-y divide-default">
            <div v-for="row in summaryRows" :key="row.label" class="flex items-center gap-4 bg-default px-4 py-3">
              <UIcon :name="row.icon" size="20" class="shrink-0 text-muted" />
              <dt class="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{{ row.label }}</dt>
              <dd class="flex min-w-0 items-center gap-2 truncate font-semibold text-highlighted">
                <span
                  v-if="row.swatch"
                  class="size-5 shrink-0 rounded-full border border-default"
                  :style="{ backgroundColor: row.swatch }"
                />
                {{ row.value }}
              </dd>
            </div>
          </dl>

          <UAlert
            color="neutral"
            variant="soft"
            :icon="form.plan === 'BASIC' ? 'mdi:information-outline' : 'mdi:lock-outline'"
            :title="form.plan === 'BASIC' ? $t('common.tenant.basicTitle') : $t('common.tenant.checkoutTitle')"
            :description="
              form.plan === 'BASIC' ? $t('common.tenant.basicDescription') : $t('common.tenant.checkoutDescription')
            "
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton v-if="step === 0" color="neutral" variant="soft" :disabled="creating" @click="open = false">
          {{ $t('common.close') }}
        </UButton>
        <UButton v-else color="neutral" variant="soft" icon="mdi:arrow-left" :disabled="creating" @click="step--">
          {{ $t('common.actions.back') }}
        </UButton>

        <UButton v-if="step < steps.length - 1" trailingIcon="mdi:arrow-right" :disabled="!canContinue" @click="step++">
          {{ $t('common.actions.continue') }}
        </UButton>
        <UButton
          v-else
          :icon="form.plan === 'BASIC' ? 'mdi:plus' : 'mdi:credit-card-outline'"
          :loading="creating"
          :disabled="!canCreate"
          @click="createTenant"
        >
          {{ form.plan === 'BASIC' ? $t('common.tenant.createAction') : $t('common.tenant.createAndPay') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { BillingInterval, PlanPrice, PlanPricing, SubscribablePlan } from '~~/shared/types/planPricing'

import { ThemeSchema } from '~~/shared/zod/enums/Theme.schema'

import { themeColors, type ThemeKey } from '~/composables/theme'

type Availability = 'idle' | 'checking' | 'available' | 'unavailable'
type DomainReason = 'empty' | 'tooShort' | 'invalid' | 'reserved' | 'taken'
type SelectedPlan = 'BASIC' | SubscribablePlan

const open = defineModel<boolean>({ default: false })
const { locale } = useI18n()
const { getSession } = useAuth()
const toast = useToast()
const config = useRuntimeConfig()
const baseDomain = String(config.public.baseDomain || 'topiqu.com')
const themes = ThemeSchema.options
const billingIntervals: BillingInterval[] = ['month', 'year']
const step = shallowRef(0)
const form = reactive({
  name: '',
  subdomain: '',
  customDomain: '',
  language: (locale.value === 'cs' ? 'cs' : 'en') as 'cs' | 'en',
  theme: 'indigo' as ThemeKey,
  plan: 'BASIC' as SelectedPlan,
  interval: 'month' as BillingInterval,
  domainType: 'SUBDOMAIN' as 'SUBDOMAIN' | 'CUSTOM',
})
const subdomainTouched = shallowRef(false)
const availability = shallowRef<Availability>('idle')
const availabilityReason = shallowRef<DomainReason | null>(null)
const creating = shallowRef(false)

const steps = computed(() => [
  { id: 'plan', label: $t('common.tenant.steps.plan') },
  { id: 'appearance', label: $t('common.tenant.steps.appearance') },
  { id: 'details', label: $t('common.tenant.steps.details') },
  { id: 'review', label: $t('common.tenant.steps.review') },
])

const languageOptions = computed(() => [
  { label: $t('languages.cs'), code: 'CS', value: 'cs' as const },
  { label: $t('languages.en'), code: 'EN', value: 'en' as const },
])

const domainTypeOptions = computed(() => [
  {
    value: 'SUBDOMAIN' as const,
    label: $t('common.tenant.subdomain'),
    description: $t('common.tenant.paidSubdomainDescription'),
    icon: 'mdi:link-variant',
  },
  {
    value: 'CUSTOM' as const,
    label: $t('common.tenant.customDomain'),
    description: $t('common.tenant.paidCustomDomainDescription'),
    icon: 'mdi:web',
  },
])

const usesCustomDomain = computed(() => form.plan !== 'BASIC' && form.domainType === 'CUSTOM')
const domainType = computed(() => (usesCustomDomain.value ? 'CUSTOM' : 'SUBDOMAIN'))
const requestedDomain = computed(() => (usesCustomDomain.value ? form.customDomain : form.subdomain))
const selectedDomain = computed(() => (usesCustomDomain.value ? form.customDomain : `${form.subdomain}.${baseDomain}`))

const { data: planPricing, refresh: refreshPlanPricing } = await useLazyFetch<PlanPricing>('/api/stripe/plans', {
  immediate: false,
  default: () => ({ PRO: { month: null, year: null }, PREMIUM: { month: null, year: null } }),
})

const formatMinorAmount = (price: PlanPrice | null) => {
  if (!price) return $t('common.preferences.billing.priceUnavailable')
  const formatter = new Intl.NumberFormat(locale.value, { style: 'currency', currency: price.currency })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return $t(`common.tenant.price.${price.interval}`, { amount: formatter.format(price.amount / 10 ** digits) })
}

const planOptions = computed(() => [
  {
    value: 'BASIC' as const,
    label: `Basic · ${$t('common.tenant.free')}`,
    description: $t('common.tenant.basicDescription'),
    icon: 'mdi:feather',
  },
  ...(['PRO', 'PREMIUM'] as const).map((plan) => ({
    value: plan,
    label: `${plan} · ${formatMinorAmount(planPricing.value?.[plan]?.[form.interval] ?? null)}`,
    description: $t(`admin.upgrade.${plan === 'PRO' ? 'toPro' : 'toPremium'}.description`),
    icon: plan === 'PRO' ? 'mdi:rocket-launch' : 'mdi:crown',
  })),
])

const planCardClass = (plan: SelectedPlan, selected: boolean) => {
  if (plan === 'BASIC')
    return selected
      ? 'border-emerald-500 bg-emerald-50/90 shadow-emerald-200/60 dark:bg-emerald-950/40 dark:shadow-emerald-950/50'
      : 'border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/80 hover:shadow-emerald-200/50 dark:border-emerald-900 dark:bg-neutral-900 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:shadow-emerald-950/50'
  if (plan === 'PRO')
    return selected
      ? 'border-indigo-500 bg-indigo-50/90 shadow-indigo-200/60 dark:bg-indigo-950/40 dark:shadow-indigo-950/50'
      : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/80 hover:shadow-indigo-200/50 dark:border-indigo-900 dark:bg-neutral-900 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:shadow-indigo-950/50'
  return selected
    ? 'border-amber-500 bg-amber-50/90 shadow-amber-200/60 dark:bg-amber-950/40 dark:shadow-amber-950/50'
    : 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50/80 hover:shadow-amber-200/50 dark:border-amber-900 dark:bg-neutral-900 dark:hover:border-amber-600 dark:hover:bg-amber-950/30 dark:hover:shadow-amber-950/50'
}

const planAccentClass = (plan: SelectedPlan) => {
  if (plan === 'BASIC') return 'bg-gradient-to-r from-emerald-400 to-teal-500'
  if (plan === 'PRO') return 'bg-gradient-to-r from-indigo-500 to-violet-500'
  return 'bg-gradient-to-r from-amber-400 to-orange-500'
}

const planGlowClass = (plan: SelectedPlan) => {
  if (plan === 'BASIC') return 'bg-emerald-400'
  if (plan === 'PRO') return 'bg-indigo-500'
  return 'bg-amber-400'
}

const planIconClass = (plan: SelectedPlan) => {
  if (plan === 'BASIC') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
  if (plan === 'PRO') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
}

const planCheckClass = (plan: SelectedPlan) => {
  if (plan === 'BASIC') return 'text-emerald-600 dark:text-emerald-400'
  if (plan === 'PRO') return 'text-indigo-600 dark:text-indigo-400'
  return 'text-amber-600 dark:text-amber-400'
}

const intervalLabel = (interval: BillingInterval) =>
  $t(`common.preferences.billing.${interval === 'month' ? 'intervalMonthly' : 'intervalAnnual'}`)

const summaryRows = computed(() => [
  { label: $t('common.tenant.name'), value: form.name, icon: 'mdi:web' },
  {
    label: usesCustomDomain.value ? $t('common.tenant.customDomain') : $t('common.tenant.subdomain'),
    value: selectedDomain.value,
    icon: 'mdi:link',
  },
  {
    label: $t('common.tenant.language'),
    value: languageOptions.value.find((option) => option.value === form.language)?.label ?? form.language,
    icon: 'mdi:translate',
  },
  {
    label: $t('common.tenant.theme'),
    value: form.theme,
    icon: 'mdi:palette-outline',
    swatch: themeColors[form.theme],
  },
  { label: $t('common.tenant.steps.plan'), value: form.plan, icon: 'mdi:crown-outline' },
])

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)

watch(
  () => form.name,
  (name) => {
    if (!subdomainTouched.value) form.subdomain = slugify(name)
  },
)

watch(
  () => form.plan,
  (plan) => {
    if (plan === 'BASIC') form.domainType = 'SUBDOMAIN'
  },
)

const checkAvailability = useDebounceFn(async () => {
  const requested = requestedDomain.value
  const requestedType = domainType.value
  if (!requested) {
    availability.value = 'idle'
    availabilityReason.value = null
    return
  }

  availability.value = 'checking'
  availabilityReason.value = null
  try {
    const result = await $fetch<{ ok: boolean; reason?: DomainReason }>('/api/onboarding/check-domain', {
      query: { domain: requested, type: requestedType },
    })
    if (requestedDomain.value !== requested || domainType.value !== requestedType) return
    availability.value = result.ok ? 'available' : 'unavailable'
    availabilityReason.value = result.ok ? null : (result.reason ?? 'invalid')
  } catch {
    if (requestedDomain.value !== requested || domainType.value !== requestedType) return
    availability.value = 'unavailable'
    availabilityReason.value = 'invalid'
  }
}, 350)

watch(
  () => [requestedDomain.value, domainType.value],
  () => {
    availability.value = 'idle'
    availabilityReason.value = null
    checkAvailability()
  },
)

watch(open, (value) => {
  if (value) {
    refreshPlanPricing()
    return
  }
  step.value = 0
  form.name = ''
  form.subdomain = ''
  form.customDomain = ''
  form.language = locale.value === 'cs' ? 'cs' : 'en'
  form.theme = 'indigo'
  form.plan = 'BASIC'
  form.interval = 'month'
  form.domainType = 'SUBDOMAIN'
  subdomainTouched.value = false
  availability.value = 'idle'
  availabilityReason.value = null
})

const setSubdomain = (value: string | number) => {
  subdomainTouched.value = true
  form.subdomain = slugify(String(value))
}

const setCustomDomain = (value: string | number) => {
  form.customDomain = String(value)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]!
    .replace(/\.$/, '')
}

const detailsValid = computed(() => Boolean(form.name.trim()))
const domainValid = computed(() => Boolean(requestedDomain.value) && availability.value === 'available')
const isStepComplete = (index: number) => index < 2 || (index === 2 && detailsValid.value && domainValid.value)
const goToStep = (index: number) => {
  step.value = index
}
const canContinue = computed(() => {
  if (step.value === 2) return detailsValid.value && domainValid.value
  return true
})
const canCreate = computed(() => detailsValid.value && domainValid.value && !creating.value)

const createTenant = async () => {
  if (!canCreate.value) return
  creating.value = true
  let created = false
  try {
    await $fetch('/api/tenant', {
      method: 'POST',
      body: {
        name: form.name,
        subdomain: form.subdomain,
        domain: requestedDomain.value,
        domainType: domainType.value,
        selectedPlan: form.plan,
        language: form.language,
        theme: form.theme,
      },
    })
    created = true
    toast.add({ color: 'success', title: $t('common.tenant.created') })
    await getSession()

    if (form.plan !== 'BASIC') {
      const { url } = await $fetch<{ url: string | null }>('/api/stripe/subscribe', {
        method: 'POST',
        body: { plan: form.plan, interval: form.interval, origin: window.location.origin },
      })
      if (!url) throw new Error('Checkout URL missing')
      window.location.href = url
      return
    }

    window.location.reload()
  } catch (error: any) {
    if (created) {
      toast.add({ color: 'warning', title: $t('common.tenant.checkoutFailed') })
      window.location.reload()
      return
    }

    const code = error?.data?.data?.code
    const key =
      code === 'TENANT_LIMIT_REACHED'
        ? 'limitReached'
        : code === 'SUBDOMAIN_TAKEN'
          ? 'subdomainTaken'
          : code === 'DOMAIN_TAKEN'
            ? 'domainTaken'
            : code === 'NAME_TAKEN'
              ? 'nameTaken'
              : code === 'RATE_LIMITED'
                ? 'rateLimited'
                : 'failed'
    toast.add({ color: 'error', title: $t(`common.tenant.${key}`) })
    if (code === 'SUBDOMAIN_TAKEN' || code === 'DOMAIN_TAKEN') {
      availability.value = 'unavailable'
      availabilityReason.value = 'taken'
      step.value = 2
    }
  } finally {
    creating.value = false
  }
}
</script>
