<template>
  <div
    v-if="open"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    @click.self="open = false"
  >
    <div
      class="absolute inset-0 bg-[#EBE9E4] dark:bg-[#0C0C0C] transition-opacity"
      @click="open = false"
    ></div>

    <div
      ref="panelRef"
      tabindex="-1"
      class="relative bg-[#FAFAFA] dark:bg-[#18181B] rounded-[2.5rem] w-full max-w-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto focus:outline-none"
    >
      <div class="p-8 md:p-12">
        <div class="flex justify-between items-start mb-8 gap-6">
          <h2
            id="onboarding-title"
            class="text-3xl md:text-4xl font-black text-[#111] dark:text-white tracking-tighter leading-tight flex items-center gap-5"
          >
            <div
              class="w-14 h-14 bg-[#D8B4FE] text-[#111] rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0_0_rgba(17,17,17,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] transform -rotate-3 transition-transform hover:rotate-0"
            >
              <Icon name="mdi:rocket-launch" class="w-7 h-7" />
            </div>
            {{ $t('landing.onboarding.title') }}
          </h2>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-xs font-black uppercase tracking-widest text-[#888] dark:text-[#71717A] whitespace-nowrap">
              {{ $t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS }) }}
            </span>
            <Button
              square
              borderless
              size="sm"
              variant="transparent"
              icon="mdi:close"
              :aria="$t('common.actions.close')"
              :title="$t('common.actions.close')"
              class="text-[#888] hover:text-[#111] dark:hover:text-white"
              @click="open = false"
            />
          </div>
        </div>

        <div
          class="flex gap-2 mb-12"
          role="progressbar"
          :aria-valuenow="step"
          :aria-valuemin="1"
          :aria-valuemax="TOTAL_STEPS"
          :aria-label="$t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS })"
        >
          <div
            v-for="s in TOTAL_STEPS"
            :key="s"
            class="h-3 flex-1 rounded-full transition-colors duration-500"
            :class="step >= s ? 'bg-[#111] dark:bg-white' : 'bg-[#E5E5E5] dark:bg-[#27272A]'"
          ></div>
        </div>

        <form @submit.prevent="handleSubmit">
          <Transition
            mode="out-in"
            enterActiveClass="transition-opacity duration-300 ease-out"
            enterFromClass="opacity-0"
            enterToClass="opacity-100"
            leaveActiveClass="transition-opacity duration-200 ease-in"
            leaveFromClass="opacity-100"
            leaveToClass="opacity-0"
          >
            <LandingOnboardingStepSite v-if="step === 1" key="step1" />
            <LandingOnboardingStepDesign v-else-if="step === 2" key="step2" />
            <LandingOnboardingStepAccount v-else-if="step === 3" key="step3" />
            <LandingOnboardingStepVerify v-else-if="step === 4" key="step4" />
            <LandingOnboardingStepSummary v-else-if="step === 5" key="step5" />
          </Transition>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { zxcvbn } from '@zxcvbn-ts/core'

import { onboardingKey, type DomainStatus, type OnboardingForm } from '~/composables/useOnboarding'

const TOTAL_STEPS = 5

const open = defineModel<boolean>()
const toast = useToast()
const { t: $t } = useI18n()

const step = shallowRef(1)
const loading = shallowRef(false)
const userEditedDomain = shallowRef(false)
const panelRef = useTemplateRef<HTMLElement>('panelRef')
let codeInputEl: HTMLInputElement | null = null
const registerCodeInput = (el: HTMLInputElement | null) => {
  codeInputEl = el
}

const challenge = shallowRef<string | null>(null)
const verifiedToken = shallowRef<string | null>(null)
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

const form = reactive<OnboardingForm>({
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
})

const domainStatus = shallowRef<DomainStatus>('idle')

const fullDomainPreview = computed(() =>
  form.domainType === 'SUBDOMAIN' ? `${form.domain}.topiqu.com` : form.domain,
)

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
    domainStatus.value = res.ok ? 'available' : (res.reason as DomainStatus) ?? 'invalid'
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

const domainStatusIcon = computed(() => {
  switch (domainStatus.value) {
    case 'checking':
      return 'mdi:loading'
    case 'available':
      return 'mdi:check-circle'
    default:
      return 'mdi:alert-circle'
  }
})

const domainStatusColor = computed(() => {
  switch (domainStatus.value) {
    case 'available':
      return 'text-[#16A34A] dark:text-[#86EFAC]'
    case 'checking':
      return 'text-[#888] dark:text-[#71717A]'
    default:
      return 'text-[#DC2626] dark:text-[#FCA5A5]'
  }
})

const summaryRows = computed(() => [
  { label: $t('landing.onboarding.summarySite'), value: form.siteName, icon: 'mdi:web' },
  { label: $t('landing.onboarding.summaryDomain'), value: fullDomainPreview.value, icon: 'mdi:link' },
  {
    label: $t('landing.onboarding.summaryLanguage'),
    value:
      form.language === 'cs'
        ? `🇨🇿 ${$t('landing.onboarding.langCz')}`
        : `🇬🇧 ${$t('landing.onboarding.langEn')}`,
    icon: 'mdi:translate',
  },
  {
    label: $t('landing.onboarding.summaryColor'),
    value: form.theme,
    icon: 'mdi:palette',
    swatch: form.theme,
  },
  {
    label: $t('landing.onboarding.summaryFocus'),
    value: form.focus || $t('landing.onboarding.focusNotSet'),
    icon: 'mdi:target',
  },
  { label: $t('landing.onboarding.summaryAdmin'), value: form.username, icon: 'mdi:account' },
  { label: $t('landing.onboarding.summaryEmail'), value: form.email, icon: 'mdi:email' },
])

const canAdvanceStep1 = computed(
  () => !!form.siteName && !!form.domain && domainStatus.value === 'available',
)

const canAdvanceStep3 = computed(
  () =>
    !!form.username &&
    !!form.email &&
    !!form.password &&
    form.password === form.passwordConfirm,
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
      body: { email: form.email, language: form.language },
    })
    challenge.value = res.challenge
    code.value = ''
    verifiedToken.value = null
    startResendCooldown(60)
    toast.success({ message: $t('common.auth.verificationCodeSent') })
    nextTick(() => codeInputEl?.focus())
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.auth.sendCodeFailed') })
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
    step.value = 5
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
  if (newStep === 4 && oldStep !== 4 && !challenge.value && !verifiedToken.value) {
    sendCode()
  }
})

const isLocked = useScrollLock(import.meta.client ? document.body : null)
watch(open, (v) => {
  isLocked.value = !!v
})

onKeyStroke('Escape', () => {
  if (open.value) open.value = false
})

watch([open, step], async ([isOpen]) => {
  if (!isOpen) return
  await nextTick()
  const firstInput = panelRef.value?.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea, select, [contenteditable="true"]',
  )
  firstInput?.focus()
})

const handleSubmit = () => {
  if (step.value === 1) {
    if (!canAdvanceStep1.value) return
    step.value = 2
    return
  }
  if (step.value === 2) {
    step.value = 3
    return
  }
  if (step.value === 3) {
    if (!canAdvanceStep3.value) return
    step.value = 4
    return
  }
  if (step.value === 4) {
    if (!canAdvanceStep4.value) return
    verifyCode()
    return
  }
  submit()
}

const submit = async () => {
  if (!form.acceptTos) {
    toast.error({ message: $t('landing.onboarding.tosRequired') })
    return
  }
  if (!form.username || !form.email || !form.password || form.password !== form.passwordConfirm) {
    toast.error({ message: $t('common.auth.passwordsMismatch') })
    return
  }
  if (zxcvbn(form.password).score < 3) {
    toast.error({ message: $t('common.passwordSuggestions.weak') })
    return
  }
  if (!verifiedToken.value) {
    toast.error({ message: $t('common.auth.verifyFailed') })
    step.value = 4
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
      },
    })

    if (res.url) {
      window.location.href = res.url
    }
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.errors.general') })
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

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
