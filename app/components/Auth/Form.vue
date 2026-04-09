<template>
  <div class="w-xs sm:w-sm md:w-md px-6">
    <div
      v-if="data?.user && !internalMode"
      class="bg-white dark:bg-gray-900 px-6 py-8 rounded-2xl shadow-md text-center space-y-5 border border-gray-200 dark:border-gray-700"
    >
      <p class="text-green-600 dark:text-green-400 text-lg font-semibold">
        {{ $t('common.auth.welcome') }} {{ data.user?.name }}!
      </p>
      <AuthLogout />
    </div>
    <div v-else-if="internalMode === 'forgot' || internalMode === 'reset'">
      <AuthForgot :mode="internalMode" @update:mode="internalMode = $event" />
    </div>
    <div
      v-else
      class="bg-white dark:bg-gray-900 px-6 py-8 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-6"
    >
      <div class="flex justify-between items-center gap-2 text-sm font-medium">
        <Button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            internalMode === 'login'
              ? 'bg-blue-600! text-white! shadow'
              : 'bg-gray-100! dark:bg-gray-800! text-gray-500! dark:text-gray-400! hover:bg-gray-200! dark:hover:bg-gray-700!',
          ]"
          @click="internalMode = 'login'"
        >
          {{ $t('common.auth.login') }}
        </Button>
        <Button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            internalMode === 'register'
              ? 'bg-blue-600! text-white! shadow'
              : 'bg-gray-100! dark:bg-gray-800! text-gray-500! dark:text-gray-400! hover:bg-gray-200! dark:hover:bg-gray-700!',
          ]"
          @click="internalMode = 'register'"
        >
          {{ $t('common.auth.register') }}
        </Button>
      </div>
      <form v-if="!verifyMode && internalMode !== 'totp'" class="space-y-5 text-sm" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('profile.email') }}
          </label>
          <div class="relative">
            <Icon name="mdi:envelope" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="example@domain.tld"
              autocomplete="email"
              required
            />
          </div>
        </div>
        <div v-if="internalMode === 'register'" class="space-y-1.5">
          <label for="username" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('profile.username') }}
          </label>
          <div class="relative">
            <Icon name="mdi:account" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autocomplete="username"
              placeholder="Joe Doe"
              maxlength="50"
              minlength="3"
              required
            />
          </div>
        </div>
        <div class="space-y-1.5">
          <div v-if="internalMode === 'login'" class="relative">
            <Icon name="mdi:lock" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full pl-11 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autocomplete="current-password"
              placeholder="********"
              maxlength="124"
              minlength="4"
              required
            />
            <button
              type="button"
              class="absolute right-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500 bg-transparent hover:bg-transparent border-none outline-none hover:text-gray-600 dark:hover:text-gray-400"
              @click="showPassword = !showPassword"
            >
              <Icon :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'" />
            </button>
          </div>
          <UserPassword v-else v-model="form.password" :isValid="isPasswordFormValid" />
          <div v-if="internalMode === 'login'" class="inline-flex justify-end w-full">
            <button
              type="button"
              class="text-xs p-1 text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700 dark:hover:text-blue-500 transition bg-transparent border-none"
              @click="internalMode = 'forgot'"
            >
              {{ $t('common.auth.forgotPassword') }}
            </button>
          </div>
        </div>
        <div v-if="internalMode === 'register'" class="space-y-1.5">
          <UserPassword v-model="form.passwordConfirm" :isValid="isPasswordFormValid" isConfirm />
        </div>
        <Button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {{ internalMode === 'register' ? $t('common.auth.register') : $t('common.auth.login') }}
        </Button>
        <div class="flex items-center my-4">
          <hr class="flex-grow border-gray-300 dark:border-gray-700" />
          <span class="mx-2 text-xs text-gray-400 dark:text-gray-500">{{ $t('common.auth.or') }}</span>
          <hr class="flex-grow border-gray-300 dark:border-gray-700" />
        </div>
        <div class="space-y-3 text-center">
          <Button
            type="button"
            variant="neutral"
            class="inline-flex items-center cursor-pointer justify-center w-full px-4 py-2 rounded-md bg-white! dark:bg-[#131314]! border border-[#747775] dark:border-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3] text-sm font-roboto font-medium transition hover:bg-gray-50! dark:hover:bg-gray-800!"
            @click="handleSocialAuth('google')"
          >
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google logo"
              class="w-5 h-5 mr-2"
            />
            {{ $t('common.auth.signInWithGoogle') }}
          </Button>
          <Button
            type="button"
            class="inline-flex items-center cursor-pointer justify-center w-full px-4 py-2 rounded-md bg-[#24292e]! dark:bg-[#24292e]! border border-[#747775] dark:border-[#8E918F] text-white dark:text-white text-sm font-roboto font-medium transition hover:bg-[#2f363d]! dark:hover:bg-[#2f363d]!"
            @click="handleSocialAuth('github')"
          >
            <img src="https://simpleicons.org/icons/github.svg" alt="GitHub logo" class="w-5 h-5 mr-2" />
            {{ $t('common.auth.signInWithGithub') }}
          </Button>
        </div>
      </form>
      <form v-if="verifyMode" class="space-y-5 text-sm" @submit.prevent="verify">
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          {{ $t('common.auth.enterVerificationCode') }}
          <span class="font-medium">{{ form.email }}</span>
        </p>
        <div class="space-y-1.5">
          <label for="code" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('common.auth.verificationCode') }}
          </label>
          <div class="relative">
            <Icon name="mdi:shield-check" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="code"
              v-model="form.code"
              type="text"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
              minlength="8"
              maxlength="8"
              :placeholder="$t('common.auth.verificationCodePlaceholder')"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {{ $t('common.auth.verify') }}
        </button>
      </form>
      <form v-if="internalMode === 'totp'" class="space-y-5 text-sm" @submit.prevent="verifyTotp">
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          {{ $t('common.auth.enterTotpCode') }}
          <span class="font-medium">{{ form.email }}</span>
        </p>
        <div class="space-y-1.5">
          <label for="totpCode" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('common.auth.totpCode') }}
          </label>
          <div class="relative">
            <Icon name="mdi:shield-lock" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="totpCode"
              v-model="form.totpCode"
              type="text"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
              minlength="6"
              maxlength="6"
              :placeholder="$t('common.auth.totpCodePlaceholder')"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {{ $t('common.auth.verifyTotp') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  mode?: 'login' | 'register' | 'forgot' | 'reset'
}>()

const toast = useToast()
const theme = useThemeStore()
const { data, signIn } = useAuth()
const { setLocale } = useI18n()
const localePath = useLocalePath()

const init = {
  email: '',
  username: '',
  password: '',
  passwordConfirm: '',
  code: '',
  totpCode: '',
  totpSecret: '',
  userId: '',
}
const form = ref<typeof init>(init)
const internalMode = shallowRef<'login' | 'register' | 'forgot' | 'reset' | 'totp'>('login')
const verifyMode = shallowRef<boolean>(false)
const showPassword = shallowRef(false)

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
  try {
    if (internalMode.value === 'register') {
      if (!isPasswordFormValid.value) return toast.error({ message: $t('common.auth.passwordsMismatch') })
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          username: form.value.username,
          email: form.value.email,
          password: form.value.password,
        },
      })
      if (!res) return toast.error({ message: $t('common.auth.registerFailed') })
      verifyMode.value = true
      toast.success({ message: $t('common.auth.verificationCodeSent') })
    } else {
      const totpData = await $fetch('/api/users/totp', {
        method: 'POST',
        body: {
          email: form.value.email,
          password: form.value.password,
        },
      })
      form.value.userId = totpData.id
      if (totpData.totpSecret) {
        form.value.totpSecret = totpData.totpSecret
        internalMode.value = 'totp'
      } else {
        await signIn('credentials', {
          email: form.value.email,
          password: form.value.password,
          redirect: false,
        })
        const user = await $fetch(`/api/users/${totpData.id}` as `/api/users/:id`)
        await $fetch(`/api/users/${totpData.id}` as `/api/users/:id`, {
          method: 'PATCH',
          body: { lastLogin: Date.now() },
        })
        setLocale(user.language)
        theme.mode = user.theme
        toast.success({ message: $t('common.auth.loginSuccess') })
        if (user.role === 'superadmin') navigateTo('/master')
        else if (user.role === 'admin') navigateTo('/admin')
        else navigateTo(localePath('uzivatel/'))
        form.value = init
      }
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
  }
}

const verify = async () => {
  if (!form.value.code) return
  try {
    await $fetch('/api/auth/verify', {
      method: 'POST',
      body: { email: form.value.email, code: form.value.code },
    })
    await signIn('credentials', {
      email: form.value.email,
      password: form.value.password,
      redirect: false,
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`)
    await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    setLocale(user.language)
    theme.mode = user.theme
    toast.success({ message: $t('common.auth.verifySuccess') })
    navigateTo(localePath('/'))
  } catch (e: any) {
    toast.error({ message: e.message || $t('common.auth.verifyFailed') })
  }
}

const verifyTotp = async () => {
  if (!form.value.totpCode) return
  try {
    const token = form.value.totpCode.replace(/\s/g, '')
    const res = await $fetch('/api/users/verify-totp', {
      method: 'POST',
      body: { token, secret: form.value.totpSecret },
    })
    if (!res.isValid) throw createError({ statusCode: 400, message: 'Neplatný TOTP kód' })
    await signIn('credentials', {
      email: form.value.email,
      password: form.value.password,
      redirect: false,
    })
    const user = await $fetch(`/api/users/${form.value.userId}` as `/api/users/:id`)
    await $fetch(`/api/users/${form.value.userId}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    setLocale(user.language)
    theme.mode = user.theme
    if (user.role === 'superadmin') navigateTo('/master')
    else if (user.role === 'admin') navigateTo('/admin')
    else navigateTo(localePath('uzivatel/'))
    form.value = init
    internalMode.value = 'login'
  } catch (e: any) {
    toast.error({ message: e.message || $t('common.auth.totpFailed') })
  }
}

const handleSocialAuth = async (provider: 'google' | 'github') => {
  try {
    const mainDomain = import.meta.dev ? 'localhost' : 'topiqu.com'
    const isMainDomain = window.location.hostname === mainDomain
    const finalRedirectUrl = window.location.href

    if (!isMainDomain) {
      const authBaseUrl = import.meta.dev ? 'http://localhost:3000' : 'https://topiqu.com'
      const authUrl = `${authBaseUrl}${localePath('/oauth-start')}?provider=${provider}&callbackUrl=${encodeURIComponent(finalRedirectUrl)}`
      window.location.href = authUrl
      return
    }

    const result = await signIn(provider, {
      callbackUrl: finalRedirectUrl,
      external: true,
    })

    if (result?.error) {
      const errorKey = provider === 'google' ? 'common.auth.googleSignInFailed' : 'common.auth.githubSignInFailed'
      return toast.error({ message: $t(errorKey) })
    }

    const user = await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`)
    await $fetch(`/api/users/${data.value?.user.id}` as `/api/users/:id`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    setLocale(user.language)
    theme.mode = user.theme
    form.value = init
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
  }
}
</script>

<style>
@font-face {
  font-family: 'Roboto';
  src: url('https://fonts.googleapis.com/css2?family=Roboto:wght@500&display=swap');
  font-weight: 500;
  font-style: normal;
}
</style>
