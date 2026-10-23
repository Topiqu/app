<template>
  <div class="w-full">
    <UCard v-if="data?.user && !internalMode">
      <div class="text-center">
        <p class="text-lg font-semibold text-success">{{ $t('common.auth.welcome') }} {{ data.user?.name }}!</p>
        <AuthLogout />
      </div>
    </UCard>
    <div v-else-if="internalMode === 'forgot' || internalMode === 'reset'">
      <AuthForgot :mode="internalMode" @update:mode="internalMode = $event" />
    </div>
    <UCard v-else>
      <UTabs
        v-model="authTab"
        :items="authTabs"
        variant="link"
        class="mb-6 w-full"
        :ui="{ list: 'grid grid-cols-2', trigger: 'w-full justify-center text-center' }"
      />
      <UForm v-if="!verifyMode && internalMode !== 'totp'" :state="form" :schema="authSchema" @submit="submit">
        <div class="space-y-5 text-sm">
          <UFormField :label="$t('profile.email')" name="email">
            <UInput
              v-model="form.email"
              type="email"
              icon="mdi:envelope"
              class="w-full"
              placeholder="example@domain.tld"
              autocomplete="email"
              required
            />
          </UFormField>
          <UFormField v-if="internalMode === 'register'" :label="$t('profile.username')" name="username">
            <UInput
              v-model="form.username"
              type="text"
              icon="mdi:account"
              class="w-full"
              autocomplete="username"
              placeholder="Joe Doe"
              :maxlength="50"
              :minlength="3"
              required
            />
          </UFormField>
          <div class="space-y-1.5">
            <UFormField v-if="internalMode === 'login'" :label="$t('common.auth.password')" name="password">
              <UInput
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                icon="mdi:lock"
                class="w-full"
                autocomplete="current-password"
                placeholder="********"
                :maxlength="124"
                :minlength="4"
                required
              >
                <template #trailing>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="link"
                    size="sm"
                    :icon="showPassword ? 'mdi:eye-off' : 'mdi:eye'"
                    :aria-label="$t('common.actions.togglePassword')"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
            </UFormField>
            <UserPassword v-else v-model="form.password" :isValid="isPasswordFormValid" />
            <div v-if="internalMode === 'login'" class="inline-flex justify-end w-full">
              <UButton type="button" variant="link" size="sm" @click="internalMode = 'forgot'">
                {{ $t('common.auth.forgotPassword') }}
              </UButton>
            </div>
          </div>
          <div v-if="internalMode === 'register'" class="space-y-1.5">
            <UserPassword v-model="form.passwordConfirm" :isValid="isPasswordFormValid" isConfirm />
          </div>
          <UButton type="submit" :loading="submitting" :disabled="submitting" block>
            {{ internalMode === 'register' ? $t('common.auth.register') : $t('common.auth.login') }}
          </UButton>
          <USeparator :label="$t('common.auth.or')" />
          <div class="space-y-3 text-center">
            <UButton
              v-if="customAuthDomain"
              type="button"
              color="neutral"
              variant="outline"
              icon="mdi:account-arrow-right-outline"
              block
              @click="handleTopiquAuth"
              >{{ $t('common.auth.transfer.signIn') }}</UButton
            >
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              icon="mdi:google"
              block
              @click="handleSocialAuth('google')"
            >
              {{ $t('common.auth.signInWithGoogle') }}
            </UButton>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              icon="mdi:github"
              block
              @click="handleSocialAuth('github')"
            >
              {{ $t('common.auth.signInWithGithub') }}
            </UButton>
          </div>
        </div>
      </UForm>
      <UForm v-if="verifyMode" :state="form" :schema="verificationSchema" @submit="verify">
        <div class="space-y-5 text-sm">
          <p class="text-muted text-sm">
            {{ $t('common.auth.enterVerificationCode') }}
            <span class="font-medium">{{ form.email }}</span>
          </p>
          <UFormField :label="$t('common.auth.verificationCode')" name="code">
            <UPinInput v-model="verificationDigits" :length="EMAIL_VERIFICATION_CODE_LENGTH" type="text" otp />
          </UFormField>
          <UButton type="submit" :loading="submitting" :disabled="submitting || resendingVerification" block>
            {{ $t('common.auth.verify') }}
          </UButton>
          <UButton
            type="button"
            variant="outline"
            color="neutral"
            :loading="resendingVerification"
            :disabled="submitting || resendingVerification || verificationCooldown"
            block
            @click="resendVerification"
          >
            {{ $t('common.auth.resendCode') }}
          </UButton>
        </div>
      </UForm>
      <UForm v-if="internalMode === 'totp'" :state="form" :schema="totpSchema" @submit="verifyTotp">
        <div class="space-y-5 text-sm">
          <p class="text-muted text-sm">
            {{ $t('common.auth.enterTotpCode') }}
            <span class="font-medium">{{ form.email }}</span>
          </p>
          <UFormField :label="$t('common.auth.totpCode')" name="totpCode">
            <UPinInput v-model="totpDigits" :length="6" otp />
          </UFormField>
          <UButton type="submit" :loading="submitting" :disabled="submitting" block>
            {{ $t('common.auth.verifyTotp') }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { InternalApi } from 'nitropack'

import { z } from 'zod'

const props = defineProps<{
  mode?: 'login' | 'register' | 'forgot' | 'reset'
  redirectTo?: string
}>()

const toast = useToast()
const { data, getSession } = useAuth()
const localePath = useLocalePath()
const afterSignIn = () => {
  const role = data.value?.user.role ?? 'reader'
  if (props.redirectTo) return navigateTo(props.redirectTo)
  if (role === 'superadmin') return navigateTo(localePath({ name: 'master' }))
  if (role === 'admin') return navigateTo(localePath({ name: 'admin' }))
  return navigateTo(localePath({ name: 'uzivatel' }))
}

const init = {
  email: '',
  username: '',
  password: '',
  passwordConfirm: '',
  code: '',
  totpCode: '',
  totpChallenge: '',
  userId: '',
}
const form = ref<typeof init>(init)
const internalMode = shallowRef<'login' | 'register' | 'forgot' | 'reset' | 'totp'>('login')
const authTabs = computed(() => [
  { label: $t('common.auth.login'), value: 'login' },
  { label: $t('common.auth.register'), value: 'register' },
])
const authTab = computed({
  get: () => (internalMode.value === 'register' ? 'register' : 'login'),
  set: (value: string) => (internalMode.value = value === 'register' ? 'register' : 'login'),
})
const verifyMode = shallowRef<boolean>(false)
const showPassword = shallowRef(false)
const submitting = shallowRef(false)
const resendingVerification = shallowRef(false)
const { isPending: verificationCooldown, start: startVerificationCooldown } = useTimeoutFn(
  () => {},
  EMAIL_VERIFICATION_COOLDOWN_MS,
  { immediate: false },
)
let verificationController: AbortController | undefined
onScopeDispose(() => verificationController?.abort())
const authSchema = computed(() =>
  internalMode.value === 'register'
    ? signInSchema
        .extend({ passwordConfirm: z.string().min(4).max(124) })
        .refine((value) => value.password === value.passwordConfirm, { path: ['passwordConfirm'] })
    : signInSchema.pick({ email: true, password: true }),
)
const verificationSchema = z.object({ code: emailVerificationCodeSchema })
const totpSchema = z.object({ totpCode: z.string().length(6) })
const verificationDigits = computed<string[]>({
  get: () => form.value.code.split(''),
  set: (value) => (form.value.code = value.join('')),
})
const totpDigits = computed<string[]>({
  get: () => form.value.totpCode.split(''),
  set: (value) => (form.value.totpCode = value.join('')),
})

const credentialErrors: Record<string, string> = {
  email_not_verified: 'common.errors.emailNotVerified',
  rate_limited: 'common.errors.tooManyRequests',
}

const signInWithCredentials = async (
  credentials: { email: string; password: string; totp?: string },
  signal?: AbortSignal,
) => {
  try {
    await $fetch<unknown, '/api/auth/**:all'>('/api/auth/sign-in/credentials' as '/api/auth/**:all', {
      method: 'POST',
      body: credentials,
      signal,
    })
  } catch (e: any) {
    const key = credentialErrors[e?.data?.code] ?? 'common.errors.invalidCredentials'
    throw createError({ statusCode: e?.statusCode || 401, message: $t(key) })
  }
  if (!signal?.aborted) await getSession()
}

const isPasswordFormValid = computed(() => {
  return internalMode.value === 'register'
    ? !!(form.value.password && form.value.password === form.value.passwordConfirm)
    : true
})

watch(
  () => props.mode,
  (newMode) => {
    if (newMode && ['login', 'register', 'forgot', 'reset'].includes(newMode)) {
      internalMode.value = newMode
    }
  },
  { immediate: true },
)

const submit = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    if (internalMode.value === 'register') {
      if (!isPasswordFormValid.value) return toast.add({ color: 'error', title: $t('common.auth.passwordsMismatch') })
      const res = await $fetch<InternalApi['/api/auth/register']['post'], '/api/auth/register'>('/api/auth/register', {
        method: 'POST',
        body: {
          username: form.value.username,
          email: form.value.email,
          password: form.value.password,
        },
      })
      if (!res) return toast.add({ color: 'error', title: $t('common.auth.registerFailed') })
      verifyMode.value = true
      startVerificationCooldown()
      toast.add({ color: 'success', title: $t('common.auth.verificationRequested'), description: form.value.email })
    } else {
      const totpData = await $fetch<InternalApi['/api/users/totp']['post'], '/api/users/totp'>('/api/users/totp', {
        method: 'POST',
        body: {
          email: form.value.email,
          password: form.value.password,
        },
      })
      form.value.userId = totpData.id
      if (totpData.requiresTotp && totpData.challenge) {
        form.value.totpChallenge = totpData.challenge
        internalMode.value = 'totp'
      } else {
        await signInWithCredentials({
          email: form.value.email,
          password: form.value.password,
        })
        toast.add({ color: 'success', title: $t('common.auth.loginSuccess') })
        afterSignIn()
        form.value = init
      }
    }
  } catch (e: any) {
    if (e?.data?.data?.code === 'email_not_verified') verifyMode.value = true
    toast.add({ color: 'error', title: fetchErrorMessage(e, $t('common.messages.operationFailed')) })
  } finally {
    submitting.value = false
  }
}

const resendVerification = async () => {
  if (submitting.value || resendingVerification.value || verificationCooldown.value) return
  const requestedEmail = form.value.email
  const controller = new AbortController()
  verificationController = controller
  resendingVerification.value = true
  try {
    const response = await $fetch('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: requestedEmail },
      signal: controller.signal,
    })
    if (controller.signal.aborted || form.value.email !== requestedEmail) return
    startVerificationCooldown()
    toast.add({ color: 'success', title: response.message })
  } catch (error) {
    if (!controller.signal.aborted && form.value.email === requestedEmail)
      toast.add({ color: 'error', title: fetchErrorMessage(error, $t('common.auth.sendCodeFailed')) })
  } finally {
    if (verificationController === controller) {
      verificationController = undefined
      resendingVerification.value = false
    }
  }
}

const verify = async () => {
  if (!form.value.code || submitting.value || resendingVerification.value) return
  const requestedEmail = form.value.email
  const password = form.value.password
  const controller = new AbortController()
  verificationController = controller
  submitting.value = true
  try {
    await $fetch<unknown, '/api/auth/verify'>('/api/auth/verify', {
      method: 'POST',
      body: { email: requestedEmail, code: form.value.code },
      signal: controller.signal,
    })
    if (controller.signal.aborted || form.value.email !== requestedEmail) return
    await signInWithCredentials({ email: requestedEmail, password }, controller.signal)
    if (controller.signal.aborted || form.value.email !== requestedEmail) return
    toast.add({ color: 'success', title: $t('common.auth.verifySuccess') })
    afterSignIn()
  } catch (error) {
    if (!controller.signal.aborted && form.value.email === requestedEmail)
      toast.add({ color: 'error', title: fetchErrorMessage(error, $t('common.auth.verifyFailed')) })
  } finally {
    if (verificationController === controller) {
      verificationController = undefined
      submitting.value = false
    }
  }
}

const verifyTotp = async () => {
  if (!form.value.totpCode || submitting.value) return
  submitting.value = true
  try {
    const token = form.value.totpCode.replace(/\s/g, '')
    const res = await $fetch<InternalApi['/api/users/verify-totp']['post'], '/api/users/verify-totp'>(
      '/api/users/verify-totp',
      {
        method: 'POST',
        body: { token, challenge: form.value.totpChallenge },
      },
    )
    if (!res.isValid) throw createError({ statusCode: 400, message: 'Neplatný TOTP kód' })
    await signInWithCredentials({
      email: form.value.email,
      password: form.value.password,
      totp: token,
    })
    afterSignIn()
    form.value = init
    internalMode.value = 'login'
  } catch (e: any) {
    toast.add({ color: 'error', title: e.message || $t('common.auth.totpFailed') })
  } finally {
    submitting.value = false
  }
}

const authHost = useRequestURL().hostname
const customAuthDomain =
  !isManagedDomain(authHost) && authHost !== 'localhost' && authHost !== '127.0.0.1' && !authHost.endsWith('.localhost')
const { locale } = useI18n()
const startAuthTransfer = async (provider?: 'google' | 'github') => {
  const result = await $fetch<InternalApi['/api/auth/transfer/start']['post'], '/api/auth/transfer/start'>(
    '/api/auth/transfer/start',
    {
      method: 'POST',
      body: {
        returnTo: resolveAuthRedirect(window.location.href, props.redirectTo),
        locale: locale.value,
        provider,
      },
    },
  )
  window.location.assign(result.url)
}
const handleTopiquAuth = async () => {
  try {
    await startAuthTransfer()
  } catch {
    toast.add({ color: 'error', title: $t('common.auth.transfer.failed') })
  }
}
const handleSocialAuth = async (provider: 'google' | 'github') => {
  try {
    if (customAuthDomain) return await startAuthTransfer(provider)
    const mainDomain = import.meta.dev ? 'localhost' : 'app.topiqu.com'
    const isMainDomain = window.location.hostname === mainDomain
    const finalRedirectUrl = resolveAuthRedirect(window.location.href, props.redirectTo)

    if (!isMainDomain) {
      const authBaseUrl = import.meta.dev ? 'http://localhost:3000' : 'https://app.topiqu.com'
      const authUrl = `${authBaseUrl}${localePath({ name: 'oauth-start' })}?provider=${provider}&callbackUrl=${encodeURIComponent(finalRedirectUrl)}`
      window.location.href = authUrl
      return
    }

    const { url } = await $fetch<{ url: string }, '/api/auth/**:all'>(
      '/api/auth/sign-in/social' as '/api/auth/**:all',
      {
        method: 'POST',
        body: { provider, callbackURL: finalRedirectUrl },
      },
    )
    window.location.href = url
  } catch {
    const errorKey = provider === 'google' ? 'common.auth.googleSignInFailed' : 'common.auth.githubSignInFailed'
    toast.add({ color: 'error', title: $t(errorKey) })
  }
}
</script>
