<template>
  <Modal v-model="open" :title="$t('common.preferences.title')" :onClose="confirmClose" class="max-w-4xl">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #close>
      <div class="flex items-center gap-1">
        <LazyClientHint v-if="client?.plan !== 'BASIC'" v-slot="{ open: clientHintOpen }" hydrateOnInteraction>
          <Button
            square
            borderless
            size="sm"
            variant="neutral"
            icon="mdi:information-outline"
            :aria="$t('common.preferences.explanation')"
            :title="$t('common.preferences.explanation')"
            @click="clientHintOpen.value = true"
          />
        </LazyClientHint>
      </div>
    </template>

    <template #content>
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-16">
        {{ $t('common.loading') }}
      </div>

      <div v-else class="flex gap-8">
        <div
          class="flex-1 space-y-8 overflow-y-auto max-h-[70vh] pr-4 [mask-image:linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)]"
        >
          <LazyFormClientBranding
            :logoUrl="form.logoUrl"
            :description="form.description"
            :socials="form.socials"
            :name="client?.name ?? ''"
            :domain="client?.domain ?? ''"
            :currentTheme="form.theme"
            @update:logoUrl="((form.logoUrl = $event.url), (form.optimizedUrl = $event.optimizedUrl))"
            @update:description="form.description = $event"
            @update:socials="form.socials = $event"
            @update:currentTheme="form.theme = $event as typeof form.theme"
          />

          <LazyFormClientContent
            v-if="client?.plan !== 'BASIC'"
            :plan="client?.plan ?? 'BASIC'"
            :focus="form.focus"
            :audience="form.audience"
            :language="form.language"
            :keywords="form.keywords"
            @update:focus="form.focus = $event"
            @update:audience="form.audience = $event"
            @update:language="form.language = $event as typeof form.language"
            @update:keywords="form.keywords = $event"
          />

          <section v-if="client?.plan !== 'BASIC'">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:google-analytics" class="w-5 h-5 text-orange-500" />
              {{ $t('common.preferences.external') }}
            </h3>

            <div
              class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm space-y-6"
            >
              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <span class="font-medium">Google Analytics</span>
                <FormField v-model="form.allowGtag" type="checkbox" aria-label="Enable Google Analytics" class="w-auto" />
              </label>
              <Transition name="fade">
                <FormField
                  v-if="form.allowGtag"
                  v-model="form.gtagId"
                  label="Measurement ID"
                  placeholder="G-XXXXXXXXXX"
                  icon="mdi:tag-outline"
                />
              </Transition>

              <div class="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <label class="flex items-center justify-between gap-4 mb-3 cursor-pointer">
                  <span class="font-medium">Google Ads</span>
                  <FormField v-model="form.allowAds" type="checkbox" aria-label="Enable Google Ads" class="w-auto" />
                </label>
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

          <section v-if="client?.plan !== 'BASIC'">
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:key-chain-variant" class="w-5 h-5 text-purple-500" />
              {{ $t('common.preferences.api.title') }}
            </h3>

            <div
              class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm"
            >
              <div v-if="!form.apiKey" class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-sm text-neutral-600 dark:text-neutral-400">
                  {{ $t('common.preferences.api.description') }}
                </div>
                <Button variant="neutral" class="shrink-0" @click="generateApiKey">
                  <Icon name="mdi:plus" class="mr-1.5 size-4" />
                  {{ $t('common.preferences.api.generate') }}
                </Button>
              </div>

              <div v-else class="space-y-3">
                <FormLabel :text="$t('common.preferences.api.label')" class="text-xs font-bold uppercase tracking-wider text-neutral-500" />

                <div class="relative">
                  <FormInput
                    :modelValue="form.apiKey"
                    :type="apiVisible ? 'text' : 'password'"
                    readonly
                    :inputClass="'font-mono pr-20!'"
                  />

                  <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      square
                      borderless
                      size="sm"
                      variant="neutral"
                      :icon="apiVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
                      :aria="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                      :title="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                      @click="apiVisible = !apiVisible"
                    />
                    <Button
                      square
                      borderless
                      size="sm"
                      variant="neutral"
                      :icon="apiCopied ? 'mdi:check' : 'mdi:content-copy'"
                      :aria="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                      :title="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                      @click="copyApi(form.apiKey)"
                    />
                  </div>
                </div>

                <div class="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <Icon name="mdi:shield-alert-outline" class="size-4 shrink-0 mt-0.5" />
                  <p>{{ $t('common.preferences.api.warning') }}</p>
                </div>
              </div>
            </div>
          </section>

          <section v-if="client?.plan !== 'BASIC'">
            <LazyFormClientLinkedIn
              :clientSiteId="client?.id ?? ''"
              :mode="form.linkedinMode"
              :type="form.linkedinCompanyType"
              :brandProfile="form.linkedinBrandProfile"
              @update:mode="form.linkedinMode = $event"
              @update:type="form.linkedinCompanyType = $event"
              @update:brandProfile="form.linkedinBrandProfile = $event"
            />
          </section>

          <section v-if="client?.plan !== 'BASIC' && client?.tokenLimit && client?.tokenLimit > 0">
            <div
              class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm"
            >
              <LazyFormClientAI
                :username="form.aiUser.username"
                :bio="form.aiUser.bio"
                :avatarUrl="form.aiUser.avatarUrl"
                :aiToneOfVoice="form.aiToneOfVoice"
                :aiControversyLevel="form.aiControversyLevel"
                :aiEnabled="activeFeatures.includes('AI')"
                :sentimentEnabled="activeFeatures.includes('SENTIMENT')"
                :articleCronsEnabled="activeFeatures.includes('ARTICLE_CRONS')"
                :canEnableAi="allowedFeatures.AI ?? false"
                :canEnableSentiment="allowedFeatures.SENTIMENT ?? false"
                :canEnableArticleCrons="allowedFeatures.ARTICLE_CRONS ?? false"
                :autoRelease="form.autoRelease"
                :language="form.language"
                :translationMode="form.translationMode"
                :translationLanguages="form.translationLanguages"
                :features="features ?? []"
                :currency="client?.currency ?? 'EUR'"
                :billingPlan="client?.billingPlan ?? 'MONTHLY'"
                @toggle:feature="toggleFeature"
                @update:username="form.aiUser.username = $event"
                @update:bio="form.aiUser.bio = $event"
                @update:aiToneOfVoice="form.aiToneOfVoice = $event ?? ''"
                @update:aiControversyLevel="form.aiControversyLevel = $event ?? ''"
                @update:avatarUrl="
                  ((form.aiUser.avatarUrl = $event.avatarUrl),
                  (form.aiUser.optimizedAvatarUrl = $event.optimizedImageUrl))
                "
                @update:autoRelease="form.autoRelease = $event"
                @update:translationMode="form.translationMode = $event"
                @update:translationLanguages="form.translationLanguages = $event"
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
  <ModalMini ref="discardDialog" />
</template>

<script setup lang="ts">
import type { ThemeSchema, LanguageSchema } from '~~/shared/zod/enums'
import type { SocialPlatform, ClientSite as _ClientSite } from '@prisma/client'

import { cs, enUS } from 'date-fns/locale'
import { format, parseISO } from 'date-fns'

const toast = useToast()
const { data: auth } = useAuth()
const open = defineModel<boolean>()
const discardDialog = useTemplateRef<ModalMiniRef>('discardDialog')
const { copy: copyApi, copied: apiCopied } = useClipboard({ legacy: true })
const apiVisible = shallowRef(false)

const form = ref({
  focus: '',
  audience: '',
  language: 'en' as (typeof LanguageSchema.options)[number],
  theme: 'blue' as (typeof ThemeSchema.options)[number],
  keywords: [] as string[],
  description: '',
  logoUrl: '',
  optimizedUrl: '',
  socials: [] as { platform: SocialPlatform; url: string }[],
  aiUser: { username: '', bio: '', avatarUrl: '', optimizedAvatarUrl: '' },
  aiToneOfVoice: '',
  aiControversyLevel: '',
  gtagId: '',
  gamNetworkCode: '',
  allowAds: false,
  apiKey: '',
  autoRelease: false,
  translationMode: 'OFF' as 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID',
  translationLanguages: [] as string[],
  allowGtag: false,
  linkedinMode: 'HitL' as 'HitL' | 'FullAuto',
  linkedinBrandProfile: { tone: '', audience: '', doList: [] as string[], dontList: [] as string[] },
  linkedinCompanyType: 'pages' as 'pages' | 'personal',
})

interface ClientSite extends Omit<
  _ClientSite,
  'billingPlan' | 'nextBillingAt' | 'lastGeneratedAt' | 'lastTokenRefilled'
> {
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
  apiKey: string | null
  aiUser: { username: string; bio: string; avatarUrl: string } | null
  aiToneOfVoice: string | null
  aiControversyLevel: string | null
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
      apiKey: c.apiKey ?? '',
      aiUser: {
        username: c.aiUser?.username ?? '',
        bio: c.aiUser?.bio ?? '',
        avatarUrl: c.aiUser?.avatarUrl ?? '',
        optimizedAvatarUrl: '',
      },
      aiToneOfVoice: c.aiToneOfVoice ?? '',
      aiControversyLevel: c.aiControversyLevel ?? '',
      gtagId: c.gtagId ?? '',
      gamNetworkCode: c.gamNetworkCode ?? '',
      autoRelease: c.autoRelease ?? false,
      translationMode: c.translationMode ?? 'OFF',
      translationLanguages: c.translationLanguages ?? [],
      allowAds: c.allowAds,
      allowGtag: c.allowGtag ?? false,
      // Default to picking the first linkedin company if there's an array now, or use the object directly if backend hasn't been updated yet
      linkedinMode: ((c as any).linkedinCompanies?.[0] || (c as any).linkedinCompany)?.mode ?? 'HitL',
      linkedinBrandProfile: ((c as any).linkedinCompanies?.[0] || (c as any).linkedinCompany)?.brandProfile ?? {
        tone: '',
        audience: '',
        doList: [],
        dontList: [],
      },
      linkedinCompanyType: ((c as any).linkedinCompanies?.[0] || (c as any).linkedinCompany)?.type ?? 'pages',
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
    toast.success({ message: enabled ? $t('common.messages.saveSuccess') : $t('common.messages.featureDisabled') })
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
        linkedinMode: form.value.linkedinMode,
        linkedinBrandProfile: form.value.linkedinBrandProfile,
        // The type is used by the backend to find/create the specific company record
        linkedinCompanyType: form.value.linkedinCompanyType,
        logoUrl: form.value.optimizedUrl || form.value.logoUrl,
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
    form.value.aiToneOfVoice !== (client.value?.aiToneOfVoice ?? '') ||
    form.value.aiControversyLevel !== (client.value?.aiControversyLevel ?? '') ||
    (client.value?.tokenLimit &&
      client.value.tokenLimit > 0 &&
      (form.value.aiUser.username !== (client.value.aiUser?.username ?? '') ||
        form.value.aiUser.bio !== (client.value.aiUser?.bio ?? '') ||
        form.value.aiUser.avatarUrl !== (client.value.aiUser?.avatarUrl ?? '')))

  if (!changed) return (open.value = false)

  const r = await discardDialog.value?.ask({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('common.messages.closeConfirmText'),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (r === 'ok') open.value = false
}
const generateApiKey = async () => {
  if (!auth.value?.user.clientSiteId) return

  try {
    const res = await $fetch<{ apiKey: string }>(`/api/clients/${auth.value.user.clientSiteId}/api-key`, {
      method: 'POST',
    })

    form.value.apiKey = res.apiKey
    toast.success({ message: 'API Key successfully generated' })
  } catch {
    toast.error({ message: 'Failed to generate API Key' })
  }
}
</script>
