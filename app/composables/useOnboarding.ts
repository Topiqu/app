import type { InjectionKey, Ref } from 'vue'

export type DomainStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'invalid'
  | 'tooShort'
  | 'reserved'
  | 'empty'

export interface OnboardingForm {
  siteName: string
  domain: string
  domainType: string
  language: string
  theme: string
  focus: string
  username: string
  email: string
  password: string
  passwordConfirm: string
  acceptTos: boolean
}

export interface OnboardingContext {
  form: OnboardingForm
  step: Ref<number>
  totalSteps: number
  loading: Ref<boolean>
  userEditedDomain: Ref<boolean>

  domainStatus: Ref<DomainStatus>
  domainStatusIcon: Ref<string>
  domainStatusColor: Ref<string>
  fullDomainPreview: Ref<string>

  challenge: Ref<string | null>
  verifiedToken: Ref<string | null>
  code: Ref<string>
  codeSending: Ref<boolean>
  codeVerifying: Ref<boolean>
  codeError: Ref<string>
  resendCooldown: Ref<number>

  canAdvanceStep1: Ref<boolean>
  canAdvanceStep3: Ref<boolean>
  canAdvanceStep4: Ref<boolean>

  summaryRows: Ref<Array<{ label: string; value: string; icon: string; swatch?: string }>>

  close: () => void
  goBack: (to: number) => void
  onCodeInput: (e: Event) => void
  sendCode: () => Promise<void>
  registerCodeInput: (el: HTMLInputElement | null) => void
}

export const onboardingKey: InjectionKey<OnboardingContext> = Symbol('onboarding')

export const useOnboarding = (): OnboardingContext => {
  const ctx = inject(onboardingKey)
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingModal')
  return ctx
}
