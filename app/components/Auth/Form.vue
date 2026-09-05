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
            <UPinInput v-model="verificationDigits" :length="8" otp />
          </UFormField>
          <UButton type="submit" :loading="submitting" :disabled="submitting" block>
            {{ $t('common.auth.verify') }}
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
import { z } from 'zod'
import { signInSchema } from '~~/shared/utils/auth'

const props = defineProps<{
  mode?: 'login' | 'register' | 'forgot' | 'reset'
  redirectTo?: string
}>()

const toast = useToast()
const theme = useThemeStore()
const { data, signIn } = useAuth()
const { setLocale } = useI18n()
const localePath = useLocalePath()
const afterSignIn = (role: string) => {
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
const authSchema = computed(() =>
  internalMode.value === 'register'
    ? signInSchema
        .extend({ passwordConfirm: z.string().min(4).max(124) })
        .refine((value) => value.password === value.passwordConfirm, { path: ['passwordConfirm'] })
    : signInSchema.pick({ email: true, password: true }),
)
const verificationSchema = z.object({ code: z.string().length(8) })
const totpSchema = z.object({ totpCode: z.string().length(6) })
const verificationDigits = computed<string[]>({
  get: () => form.value.code.split(''),
  set: (value) => (form.value.code = value.join('')),
})
const totpDigits = computed<string[]>({
  get: () => form.value.totpCode.split(''),
  set: (value) => (form.value.totpCode = value.join('')),
})

const signInWithCredentials = async (credentials: Record<string, string>) => {
  const result = await signIn('credentials', { ...credentials, redirect: false })
  if (result?.error)
    throw createError({ statusCode: result.status || 401, message: $t('common.errors.invalidCredentials') })
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
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          username: form.value.username,
          email: form.value.email,
          password: form.value.password,
        },
      })
      if (!res) return toast.add({ color: 'error', title: $t('common.auth.registerFailed') })
      verifyMode.value = true
      toast.add({ color: 'success', title: $t('common.auth.verificationCodeSent') })
    } else {
      const totpData = await $fetch('/api/users/totp', {
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
        const user = await $fetch(`/api/users/${totpData.id}` as `/api/users/:id`)
        setLocale(user.language)
        theme.mode = user.theme
        toast.add({ color: 'success', title: $t('common.auth.loginSuccess') })
        afterSignIn(user.role)
        form.value = init
      }
    }
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('common.messages.operationFailed') })
  } finally {
    submitting.value = false
  }
}

const verify = async () => {
  if (!form.value.code || submitting.value) return
  submitting.value = true
  try {
    await $fetch('/api/auth/verify', {
      method: 'POST',
      body: { email: form.value.email, code: form.value.code },
    })
    await signInWithCredentials({
      email: form.value.email,
      password: form.value.password,
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`)
    setLocale(user.language)
    theme.mode = user.theme
    toast.add({ color: 'success', title: $t('common.auth.verifySuccess') })
    afterSignIn(user.role)
  } catch (e: any) {
    toast.add({ color: 'error', title: e.message || $t('common.auth.verifyFailed') })
  } finally {
    submitting.value = false
  }
}

const verifyTotp = async () => {
  if (!form.value.totpCode || submitting.value) return
  submitting.value = true
  try {
    const token = form.value.totpCode.replace(/\s/g, '')
    const res = await $fetch('/api/users/verify-totp', {
      method: 'POST',
      body: { token, challenge: form.value.totpChallenge },
    })
    if (!res.isValid) throw createError({ statusCode: 400, message: 'Neplatný TOTP kód' })
    await signInWithCredentials({
      email: form.value.email,
      password: form.value.password,
      totp: token,
    })
    const user = await $fetch(`/api/users/${form.value.userId}` as `/api/users/:id`)
    setLocale(user.language)
    theme.mode = user.theme
    afterSignIn(user.role)
    form.value = init
    internalMode.value = 'login'
  } catch (e: any) {
    toast.add({ color: 'error', title: e.message || $t('common.auth.totpFailed') })
  } finally {
    submitting.value = false
  }
}

const handleSocialAuth = async (provider: 'google' | 'github') => {
  try {
    const mainDomain = import.meta.dev ? 'localhost' : 'app.topiqu.com'
    const isMainDomain = window.location.hostname === mainDomain
    const finalRedirectUrl = resolveAuthRedirect(window.location.href, props.redirectTo)

    if (!isMainDomain) {
      const authBaseUrl = import.meta.dev ? 'http://localhost:3000' : 'https://app.topiqu.com'
      const authUrl = `${authBaseUrl}${localePath({ name: 'oauth-start' })}?provider=${provider}&callbackUrl=${encodeURIComponent(finalRedirectUrl)}`
      window.location.href = authUrl
      return
    }

    const result = await signIn(provider, {
      callbackUrl: finalRedirectUrl,
      external: true,
    })

    if (result?.error) {
      const errorKey = provider === 'google' ? 'common.auth.googleSignInFailed' : 'common.auth.githubSignInFailed'
      return toast.add({ color: 'error', title: $t(errorKey) })
    }

    const user = await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`)
    setLocale(user.language)
    theme.mode = user.theme
    form.value = init
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('common.messages.operationFailed') })
  }
}
</script>
