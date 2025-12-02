<template>
  <Modal v-model="open" :title="$t('common.preferences.title')" :onClose="confirmClose" class="max-w-4xl">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #close>
      <LazyClientHint v-if="auth?.user?.plan !== 'BASIC'" v-slot="{ open: clientHintOpen }" hydrateOnInteraction>
        <button
          class="flex items-center justify-center p-2 rounded-full bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 border-none outline-none cursor-pointer"
          :title="$t('common.preferences.explanation')"
          @click="clientHintOpen.value = true"
        >
          <Icon name="mdi:information-outline" class="size-6 text-gray-600 dark:text-gray-300" />
        </button>
      </LazyClientHint>
    </template>

    <template #content>
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-16">
        {{ $t('common.loading') }}
      </div>

      <div v-else class="flex gap-8">
        <div class="flex-1 space-y-8 overflow-y-auto max-h-[70vh] pr-4">
          <LazyFormClientBranding
            :logoUrl="form.logoUrl"
            :description="form.description"
            :socials="form.socials"
            :name="client?.name ?? ''"
            :subdomain="client?.subdomain ?? ''"
            :currentTheme="form.theme"
            @update:logoUrl="form.logoUrl = $event"
            @update:description="form.description = $event"
            @update:socials="form.socials = $event"
            @update:currentTheme="form.theme = $event as typeof form.theme"
          />

          <LazyFormClientContent
            v-if="auth?.user?.plan !== 'BASIC'"
            :plan="auth?.user?.plan ?? 'BASIC'"
            :focus="form.focus"
            :audience="form.audience"
            :language="form.language"
            :keywords="form.keywords"
            @update:focus="form.focus = $event"
            @update:audience="form.audience = $event"
            @update:language="form.language = $event as typeof form.language"
            @update:keywords="form.keywords = $event"
          />

          <section v-if="auth?.user?.plan !== 'BASIC'">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:google-analytics" class="w-5 h-5 text-orange-500" />
              {{ $t('common.preferences.external') }}
            </h3>

            <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-6">
              <div class="flex items-center justify-between">
                <span class="font-medium">Google Analytics</span>
                <FormField v-model="form.allowGtag" type="checkbox" label="" class="cursor-pointer" />
              </div>
              <Transition name="fade">
                <FormField
                  v-if="form.allowGtag"
                  v-model="form.gtagId"
                  label="Measurement ID"
                  placeholder="G-XXXXXXXXXX"
                  icon="mdi:tag-outline"
                />
              </Transition>

              <div class="pt-4 border-t border-white/10">
                <div class="flex items-center justify-between mb-3">
                  <span class="font-medium">Google Ads</span>
                  <FormField v-model="form.allowAds" type="checkbox" label="" class="cursor-pointer" />
                </div>
                <Transition name="fade">
                  <FormField
                    v-if="form.allowAds"
                    v-model="form.gamNetworkCode"
                    label="Network Code"
                    placeholder="XXXXXXXXXX"
                    icon="mdi:code-tags"
                  />
                </Transition>
              </div>
            </div>
          </section>

          <section v-if="auth?.user?.plan !== 'BASIC' && client?.tokenLimit && client?.tokenLimit > 0">
            <div class="bg-white/5 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <LazyFormClientAI
                :username="form.aiUser.username"
                :bio="form.aiUser.bio"
                :avatarUrl="form.aiUser.avatarUrl"
                :aiEnabled="activeFeatures.includes('AI')"
                :sentimentEnabled="activeFeatures.includes('SENTIMENT')"
                :articleCronsEnabled="activeFeatures.includes('ARTICLE_CRONS')"
                :canEnableAi="allowedFeatures.AI"
                :canEnableSentiment="allowedFeatures.SENTIMENT"
                :canEnableArticleCrons="allowedFeatures.ARTICLE_CRONS"
                :features
                :currency="client?.currency ?? 'EUR'"
                @toggle:feature="toggleFeature"
                @update:username="form.aiUser.username = $event"
                @update:bio="form.aiUser.bio = $event"
                @update:avatarUrl="form.aiUser.avatarUrl = $event"
              />
            </div>
          </section>
        </div>

        <div v-if="showPricing" class="w-64 shrink-0">
          <div class="sticky top-6 space-y-4">
            <div
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
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
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
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
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
            >
              <div class="flex items-center gap-2 text-xs uppercase text-emerald-600 dark:text-emerald-400 mb-2">
                <Icon name="mdi:currency-usd-off" class="size-4" />
                {{ $t('common.preferences.savingsTitle') }}
              </div>
              <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatSavings }}
              </div>
            </div>

            <div
              class="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
            >
              <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
                {{ $t('common.preferences.monthlyTitle') }}
              </div>
              <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {{ formatPrice('monthly') }}
              </div>
              <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">
                /{{ $t('common.preferences.monthly') }}
              </div>
            </div>

            <div
              class="relative rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-5 shadow-lg"
            >
              <div class="text-neutral-600 dark:text-neutral-300 text-xs uppercase tracking-wider mb-1">
                {{ $t('common.preferences.annuallyTitle') }}
              </div>
              <div class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                {{ formatPrice('annual') }}
              </div>
              <div class="text-neutral-500 dark:text-neutral-400 text-xs mt-1">
                /{{ $t('common.preferences.annually') }}
              </div>
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
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end pt-6 border-t border-gray-300 dark:border-gray-600">
        <Button variant="neutral" @click="close">
          {{ $t('common.messages.deleteCancel') }}
        </Button>
        <Button @click="savePreferences">
          {{ $t('common.actions.saveChanges') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import type { ThemeSchema, LanguageSchema } from '~~/shared/zod/enums'
import type { SocialPlatform, ClientSite as _ClientSite } from '@prisma/client'

import Swal from 'sweetalert2'
import { cs, enUS } from 'date-fns/locale'
import { format, parseISO } from 'date-fns'

const toast = useToast()
const { data: auth } = useAuth()
const open = defineModel<boolean>()

const form = ref({
  focus: '',
  audience: '',
  language: 'en' as (typeof LanguageSchema.options)[number],
  theme: 'blue' as (typeof ThemeSchema.options)[number],
  keywords: [] as string[],
  description: '',
  logoUrl: '',
  socials: [] as { platform: SocialPlatform; url: string }[],
  aiUser: { username: '', bio: '', avatarUrl: '' },
  gtagId: '',
  gamNetworkCode: '',
  allowAds: false,
  allowGtag: false,
})

interface ClientSite
  extends Omit<_ClientSite, 'billingPlan' | 'nextBillingAt' | 'lastGeneratedAt' | 'lastTokenRefilled'> {
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT' | null
  nextBillingAt: string | null
  lastGeneratedAt: string | null
  lastTokenRefilled: string | null
  activeFeatures: string[] | null
  keywords: string[] | null
  allowedFeatures: {
    AI?: boolean
    SENTIMENT?: boolean
    ARTICLE_CRONS?: boolean
  } | null
  socials: { platform: SocialPlatform; url: string }[]
  aiUser: { username: string; bio: string; avatarUrl: string } | null
}

const { data: client, refresh, pending } = await useFetch<ClientSite>(`/api/clients/${auth.value?.user.clientSiteId}`)
const { data: features } = await useFetch(`/api/features`)
const rate = await useCurrencyRate(client.value?.currency ?? 'EUR')

const activeFeatures = computed(() => client.value?.activeFeatures ?? [])
const allowedFeatures = computed(
  () => client.value?.allowedFeatures ?? { AI: false, SENTIMENT: false, ARTICLE_CRONS: false },
)

const billingPlanText = computed(() => {
  if (!client.value) return ''
  if (client.value.billingPlan === 'PERMANENT') return $t('common.preferences.billing.permanent')
  if (client.value.billingPlan === 'ANNUAL') return $t('common.preferences.billing.annual')
  return $t('common.preferences.billing.monthly')
})

const validityText = computed(() => {
  if (!client.value) return ''
  if (client.value.billingPlan === 'PERMANENT') return $t('common.preferences.validity.permanent')
  if (!client.value.nextBillingAt) return $t('common.preferences.validity.unknown')
  const date = parseISO(client.value.nextBillingAt)
  const locale = client.value.language === 'cs' ? cs : enUS
  return $t('common.preferences.validity.until', { date: format(date, 'd. M. yyyy', { locale }) })
})

const nextBillingDate = computed(() => {
  if (!client.value?.nextBillingAt) return '–'
  const date = parseISO(client.value.nextBillingAt)
  const locale = client.value.language === 'cs' ? cs : enUS
  return format(date, 'd. M. yyyy', { locale })
})

const nextBillingAmountText = computed(() => {
  if (!client.value) return ''
  return client.value.billingPlan === 'ANNUAL'
    ? $t('common.preferences.nextBilling.annual')
    : $t('common.preferences.nextBilling.monthly')
})

const formatSavings = computed(() => {
  if (!client.value?.monthlyPayment) return ''

  const monthlyCzk = client.value.monthlyPayment
  const yearlyCzk = monthlyCzk * 12
  const savingsCzk = Math.round(yearlyCzk * 0.2)

  const savingsInClientCurrency = client.value.currency === 'CZK' ? savingsCzk : savingsCzk / rate

  return new Intl.NumberFormat(client.value.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client.value.currency ?? 'EUR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client.value.currency === 'CZK' ? 0 : 2,
  }).format(savingsInClientCurrency)
})

const formatPrice = (type: 'monthly' | 'annual') => {
  const monthlyCzk = client.value?.monthlyPayment ?? 0
  if (monthlyCzk === 0) return '–'

  let amountCzk = type === 'monthly' ? monthlyCzk : monthlyCzk * 12

  if (type === 'annual' && client.value?.billingPlan === 'ANNUAL') {
    amountCzk = Math.round(amountCzk * 0.8)
  }

  const finalAmount = client.value?.currency === 'CZK' ? amountCzk : amountCzk / rate

  return new Intl.NumberFormat(client.value?.language === 'cs' ? 'cs-CZ' : 'en-US', {
    style: 'currency',
    currency: client.value?.currency ?? 'EUR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: client.value?.currency === 'CZK' ? 0 : 2,
  }).format(finalAmount)
}

const showPricing = computed(() => client.value?.billingPlan !== 'PERMANENT')

watch(
  client,
  (c) => {
    if (!c) return
    form.value = {
      ...form.value,
      focus: c.focus ?? '',
      audience: c.audience ?? '',
      language: c.language,
      theme: c.theme,
      description: c.description ?? '',
      logoUrl: c.logoUrl ?? '',
      keywords: c.keywords ?? [],
      socials: c.socials ?? [],
      aiUser: {
        username: c.aiUser?.username ?? '',
        bio: c.aiUser?.bio ?? '',
        avatarUrl: c.aiUser?.avatarUrl ?? '',
      },
      gtagId: c.gtagId ?? '',
      gamNetworkCode: c.gamNetworkCode ?? '',
      allowAds: c.allowAds,
      allowGtag: c.allowGtag ?? false,
    }
  },
  { immediate: true },
)

const toggleFeature = async ({ code, enabled }: { code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }) => {
  if (!client.value?.id) return
  try {
    const res = await $fetch<{
      activeFeatures: string[]
      monthlyPayment: number
      annualPayment: number
    }>(`/api/clients/${client.value.id}/features`, {
      method: 'PATCH',
      body: { code, enabled },
    })
    client.value = {
      ...client.value!,
      activeFeatures: res.activeFeatures,
      monthlyPayment: res.monthlyPayment,
      annualPayment: res.annualPayment,
    }
    toast.success({ message: enabled ? $t('common.messages.featureEnabled') : $t('common.messages.featureDisabled') })
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
    await refresh()
  }
}

const savePreferences = async () => {
  if (!auth.value?.user.clientSiteId) return toast.error({ message: $t('common.preferences.messages.noClientId') })
  try {
    await $fetch(`/api/clients/${auth.value.user.clientSiteId}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...form.value,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: client.value?.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
      },
    })
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    await refresh()
    open.value = false
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
  }
}

const confirmClose = async () => {
  const changed =
    form.value.focus !== (client.value?.focus ?? '') ||
    form.value.audience !== (client.value?.audience ?? '') ||
    form.value.language !== client.value?.language ||
    form.value.theme !== client.value?.theme ||
    form.value.description !== (client.value?.description ?? '') ||
    form.value.logoUrl !== (client.value?.logoUrl ?? '') ||
    JSON.stringify(form.value.keywords) !== JSON.stringify(client.value?.keywords ?? []) ||
    JSON.stringify(form.value.socials) !== JSON.stringify(client.value?.socials ?? []) ||
    form.value.allowGtag !== (client.value?.allowGtag ?? false) ||
    (client.value?.tokenLimit &&
      client.value.tokenLimit > 0 &&
      (form.value.aiUser.username !== (client.value.aiUser?.username ?? '') ||
        form.value.aiUser.bio !== (client.value.aiUser?.bio ?? '') ||
        form.value.aiUser.avatarUrl !== (client.value.aiUser?.avatarUrl ?? '')))

  if (!changed) return (open.value = false)

  const r = await Swal.fire({
    title: $t('common.messages.closeConfirmTitle'),
    text: $t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.messages.closeConfirmButton'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}
</script>
