<template>
  <UModal
    v-model:open="open"
    :title="$t('landing.onboarding.title')"
    :close="false"
    :ui="{ content: 'max-w-[50rem] overflow-hidden' }"
  >
    <template #content>
      <div class="max-h-[90vh] overflow-y-auto">
        <div class="p-8 md:p-12">
          <div class="flex justify-between items-start mb-8 gap-6">
            <h2
              id="onboarding-title"
              class="flex items-center gap-5 text-3xl font-black leading-tight text-highlighted md:text-4xl"
            >
              <UAvatar icon="i-mdi-rocket-launch" size="3xl" />
              {{ $t('landing.onboarding.title') }}
            </h2>
            <div class="flex items-center gap-3 shrink-0">
              <UBadge color="neutral" variant="soft" class="whitespace-nowrap">
                {{ $t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS }) }}
              </UBadge>
              <UButton
                square
                variant="ghost"
                size="sm"
                color="neutral"
                icon="i-mdi-close"
                :aria-label="$t('common.actions.close')"
                :title="$t('common.actions.close')"
                @click="open = false"
              />
            </div>
          </div>

          <UStepper
            v-model="step"
            :items="stepperItems"
            valueKey="value"
            disabled
            class="mb-12"
            :aria-label="$t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS })"
          />

          <UForm :state="form" @submit.prevent="handleSubmit">
            <UFormField
              :label="$t('landing.onboarding.honeypot')"
              class="absolute -left-[9999px] top-auto w-px h-px overflow-hidden"
              name="website"
            >
              <UInput
                v-model="form.website"
                type="text"
                name="website"
                aria-hidden="true"
                tabindex="-1"
                autocomplete="off"
              />
            </UFormField>
            <TurnstileWidget v-model="turnstileToken" />
            <div class="relative min-h-[680px]">
              <div>
                <LazyLandingOnboardingStepSite v-if="step === 1" key="step1" hydrateOnIdle />
                <LazyLandingOnboardingStepDesign v-else-if="step === 2" key="step2" hydrateOnIdle />
                <LazyLandingOnboardingStepAccount v-else-if="step === 3" key="step3" hydrateOnIdle />
                <LazyLandingOnboardingStepPlan v-else-if="step === 4" key="step4" hydrateOnIdle />
                <LazyLandingOnboardingStepVerify v-else-if="step === 5" key="step5" hydrateOnIdle />
                <LazyLandingOnboardingStepSummary v-else-if="step === 6" key="step6" hydrateOnIdle />
              </div>
            </div>
          </UForm>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { zxcvbn } from '@zxcvbn-ts/core'

import { onboardingKey, type DomainStatus, type OnboardingForm } from '~/composables/useOnboarding'

const TOTAL_STEPS = 6

const open = defineModel<boolean>('open')
const toast = useToast()
const { t: $t } = useI18n()

const step = shallowRef(1)
const stepperItems = computed(() =>
  Array.from({ length: TOTAL_STEPS }, (_, index) => ({
    value: index + 1,
    title: $t('landing.onboarding.stepLabel', { current: index + 1, total: TOTAL_STEPS }),
  })),
)
const loading = shallowRef(false)
const userEditedDomain = shallowRef(false)
let codeInputEl: HTMLInputElement | null = null
const registerCodeInput = (el: HTMLInputElement | null) => {
  codeInputEl = el
}

const challenge = shallowRef<string | null>(null)
const verifiedToken = shallowRef<string | null>(null)
const turnstileToken = shallowRef('')
const code = shallowRef('')
const codeSending = shallowRef(false)
const codeVerifying = shallowRef(false)
const codeError = shallowRef('')
const resendCooldown = shallowRef(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const startResendCooldown = (seconds = 60) => {
  resendCooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}
onScopeDispose(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

const onCodeInput = (ev: Event) => {
  const target = ev.target as HTMLInputElement
  const digitsOnly = target.value.replace(/\D/g, '').slice(0, 6)
  if (digitsOnly !== target.value) target.value = digitsOnly
  code.value = digitsOnly
  if (codeError.value) codeError.value = ''
}

const form = shallowReactive<OnboardingForm>({
  siteName: '',
  domain: '',
  domainType: 'SUBDOMAIN',
  language: 'en',
  theme: 'blue',
  focus: '',
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
  acceptTos: false,
  website: '',
  selectedPlan: null,
})

const domainStatus = shallowRef<DomainStatus>('idle')

const fullDomainPreview = computed(() => (form.domainType === 'SUBDOMAIN' ? `${form.domain}.topiqu.com` : form.domain))

watch(
  () => form.siteName,
  (newName) => {
    if (form.domainType === 'SUBDOMAIN' && !userEditedDomain.value) {
      form.domain = newName ? slugify(newName, { lower: true, strict: true }) : ''
    }
  },
)

watch(
  () => form.domainType,
  (newType) => {
    if (newType === 'SUBDOMAIN') {
      userEditedDomain.value = false
      form.domain = form.siteName ? slugify(form.siteName, { lower: true, strict: true }) : ''
    } else {
      form.domain = ''
    }
  },
)

const runDomainCheck = useDebounceFn(async (domain: string, type: string) => {
  if (form.domain !== domain || form.domainType !== type) return
  if (!domain) {
    domainStatus.value = 'idle'
    return
  }
  try {
    const res = await $fetch<{ ok: boolean; reason?: DomainStatus }>('/api/onboarding/check-domain', {
      query: { domain, type },
    })
    if (form.domain !== domain || form.domainType !== type) return
    domainStatus.value = res.ok ? 'available' : ((res.reason as DomainStatus) ?? 'invalid')
  } catch {
    domainStatus.value = 'idle'
  }
}, 350)

watch(
  () => [form.domain, form.domainType] as const,
  ([d, type]) => {
    if (!d) {
      domainStatus.value = 'idle'
      return
    }
    domainStatus.value = 'checking'
    runDomainCheck(d, type)
  },
)

const DOMAIN_STATUS_ICON: Record<DomainStatus, string> = {
  idle: 'i-mdi-alert-circle',
  checking: 'i-mdi-loading',
  available: 'i-mdi-check-circle',
  taken: 'i-mdi-alert-circle',
  invalid: 'i-mdi-alert-circle',
  tooShort: 'i-mdi-alert-circle',
  reserved: 'i-mdi-alert-circle',
  empty: 'i-mdi-alert-circle',
}

const DOMAIN_STATUS_COLOR = {
  available: 'success',
  checking: 'neutral',
  error: 'error',
} as const

const domainStatusIcon = computed(() => DOMAIN_STATUS_ICON[domainStatus.value])
const domainStatusColor = computed(() => {
  if (domainStatus.value === 'available') return DOMAIN_STATUS_COLOR.available
  if (domainStatus.value === 'checking') return DOMAIN_STATUS_COLOR.checking
  return DOMAIN_STATUS_COLOR.error
})

const summaryRows = computed(() => [
  { label: $t('landing.onboarding.summarySite'), value: form.siteName, icon: 'i-mdi-web' },
  { label: $t('landing.onboarding.summaryDomain'), value: fullDomainPreview.value, icon: 'i-mdi-link' },
  {
    label: $t('landing.onboarding.summaryLanguage'),
    value: form.language === 'cs' ? `🇨🇿 ${$t('landing.onboarding.langCz')}` : `🇬🇧 ${$t('landing.onboarding.langEn')}`,
    icon: 'i-mdi-translate',
  },
  {
    label: $t('landing.onboarding.summaryColor'),
    value: form.theme,
    icon: 'i-mdi-palette',
    swatch: form.theme,
  },
  {
    label: $t('landing.onboarding.summaryFocus'),
    value: form.focus || $t('landing.onboarding.focusNotSet'),
    icon: 'i-mdi-target',
  },
  { label: $t('landing.onboarding.summaryAdmin'), value: form.username, icon: 'i-mdi-account' },
  { label: $t('landing.onboarding.summaryEmail'), value: form.email, icon: 'i-mdi-email' },
  {
    label: $t('landing.onboarding.summaryPlan'),
    value: form.selectedPlan
      ? $t(`landing.pricing.plans.${form.selectedPlan.toLowerCase()}.name`)
      : $t('landing.onboarding.planFreeAfterTrial'),
    icon: 'i-mdi-crown-outline',
  },
])

const canAdvanceStep1 = computed(() => !!form.siteName && !!form.domain && domainStatus.value === 'available')

const canAdvanceStep3 = computed(
  () => !!form.username && !!form.email && !!form.password && form.password === form.passwordConfirm,
)

const canAdvanceStep4 = computed(() => !!challenge.value && code.value.length === 6)

watch(
  () => form.email,
  () => {
    challenge.value = null
    verifiedToken.value = null
    code.value = ''
    codeError.value = ''
  },
)

const sendCode = async () => {
  if (codeSending.value || resendCooldown.value > 0) return
  if (!form.email) return
  codeSending.value = true
  codeError.value = ''
  try {
    const res = await $fetch<{ challenge: string }>('/api/onboarding/send-code', {
      method: 'POST',
      body: {
        email: form.email,
        language: form.language,
        website: form.website,
        turnstileToken: turnstileToken.value,
      },
    })
    challenge.value = res.challenge
    code.value = ''
    verifiedToken.value = null
    startResendCooldown(60)
    toast.add({ color: 'success', title: $t('common.auth.verificationCodeSent') })
    nextTick(() => codeInputEl?.focus())
  } catch (error: any) {
    toast.add({ color: 'error', title: error.data?.message || $t('common.auth.sendCodeFailed') })
  } finally {
    codeSending.value = false
  }
}

const verifyCode = async () => {
  if (codeVerifying.value) return
  if (!challenge.value || code.value.length !== 6) return
  codeVerifying.value = true
  codeError.value = ''
  try {
    const res = await $fetch<{ verifiedToken: string }>('/api/onboarding/verify-code', {
      method: 'POST',
      body: { email: form.email, code: code.value, challenge: challenge.value },
    })
    verifiedToken.value = res.verifiedToken
    step.value = 6
  } catch (error: any) {
    const reason = error.data?.data?.reason
    if (reason === 'expired') {
      codeError.value = $t('common.auth.codeExpired')
      challenge.value = null
    } else if (reason === 'mismatch') {
      codeError.value = $t('common.auth.codeMismatch')
    } else {
      codeError.value = error.data?.message || $t('common.auth.verifyFailed')
    }
  } finally {
    codeVerifying.value = false
  }
}

watch(step, (newStep, oldStep) => {
  if (newStep === 5 && oldStep !== 5 && !challenge.value && !verifiedToken.value) {
    sendCode()
  }
})

watch(open, (v) => {
  if (v) {
    preloadStep(step.value)
    preloadStep(step.value + 1)
  }
})

const STEP_COMPONENTS = [
  'LandingOnboardingStepSite',
  'LandingOnboardingStepDesign',
  'LandingOnboardingStepAccount',
  'LandingOnboardingStepPlan',
  'LandingOnboardingStepVerify',
  'LandingOnboardingStepSummary',
] as const

const preloadStep = (n: number) => {
  const name = STEP_COMPONENTS[n - 1]
  if (name) preloadComponents(name)
}

const goTo = (n: number) => () => {
  step.value = n
  preloadStep(n + 1)
}

const stepFlow = {
  1: { canAdvance: canAdvanceStep1, next: goTo(2) },
  2: { next: goTo(3) },
  3: { canAdvance: canAdvanceStep3, next: goTo(4) },
  4: { next: goTo(5) },
  5: { canAdvance: canAdvanceStep4, next: () => verifyCode() },
  6: { next: () => submit() },
} satisfies Record<number, { canAdvance?: { value: boolean }; next: () => void | Promise<void> }>

const handleSubmit = () => {
  const current = stepFlow[step.value as keyof typeof stepFlow]
  if (!current || ('canAdvance' in current && !current.canAdvance.value)) return
  current.next()
}

const submit = async () => {
  if (!form.acceptTos) {
    toast.add({ color: 'error', title: $t('landing.onboarding.tosRequired') })
    return
  }
  if (!form.username || !form.email || !form.password || form.password !== form.passwordConfirm) {
    toast.add({ color: 'error', title: $t('common.auth.passwordsMismatch') })
    return
  }
  if (zxcvbn(form.password).score < 3) {
    toast.add({ color: 'error', title: $t('common.passwordSuggestions.weak') })
    return
  }
  if (!verifiedToken.value) {
    toast.add({ color: 'error', title: $t('common.auth.verifyFailed') })
    step.value = 5
    return
  }

  loading.value = true
  try {
    const res = await $fetch<{ url?: string }>('/api/onboarding/checkout', {
      method: 'POST',
      body: {
        siteName: form.siteName,
        domain: form.domain,
        domainType: form.domainType,
        language: form.language,
        theme: form.theme,
        focus: form.focus,
        username: form.username,
        email: form.email,
        password: form.password,
        verifiedToken: verifiedToken.value,
        selectedPlan: form.selectedPlan,
      },
    })

    if (res.url) {
      window.location.href = res.url
    }
  } catch (error: any) {
    toast.add({ color: 'error', title: error.data?.message || $t('common.errors.general') })
  } finally {
    loading.value = false
  }
}

provide(onboardingKey, {
  form,
  step,
  totalSteps: TOTAL_STEPS,
  loading,
  userEditedDomain,
  domainStatus,
  domainStatusIcon,
  domainStatusColor,
  fullDomainPreview,
  challenge,
  verifiedToken,
  code,
  codeSending,
  codeVerifying,
  codeError,
  resendCooldown,
  canAdvanceStep1,
  canAdvanceStep3,
  canAdvanceStep4,
  summaryRows,
  close: () => {
    open.value = false
  },
  goBack: (to: number) => {
    step.value = to
  },
  onCodeInput,
  sendCode,
  registerCodeInput,
})
</script>
