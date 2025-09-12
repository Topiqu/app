<template>
  <div class="w-xs sm:w-sm md:w-md px-6">
    <div
      v-if="data?.user"
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
        <button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            internalMode === 'login'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
          @click="internalMode = 'login'"
        >
          {{ $t('common.auth.login') }}
        </button>
        <button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            internalMode === 'register'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
          @click="internalMode = 'register'"
        >
          {{ $t('common.auth.register') }}
        </button>
      </div>
      <form v-if="!verifyMode" class="space-y-5 text-sm" @submit.prevent="submit">
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
          <label for="password" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('common.auth.password') }}
          </label>
          <div class="relative">
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
          <div v-if="internalMode === 'login'" class="inline-flex justify-end w-full">
            <button
              type="button"
              class="text-xs p-1 text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700 dark:hover:text-blue-500 transition"
              @click="internalMode = 'forgot'"
            >
              {{ $t('common.auth.forgotPassword') }}
            </button>
          </div>
        </div>
        <div v-if="internalMode === 'register'" class="space-y-1.5">
          <label for="passwordConfirm" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">
            {{ $t('common.auth.passwordConfirm') }}
          </label>
          <div class="relative">
            <Icon name="mdi:lock-check" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              id="passwordConfirm"
              v-model="form.passwordConfirm"
              :type="showPasswordConfirm ? 'text' : 'password'"
              class="w-full pl-11 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              autocomplete="new-password"
              placeholder="********"
              maxlength="124"
              minlength="4"
              required
            />
            <button
              type="button"
              class="absolute right-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500 bg-transparent hover:bg-transparent border-none outline-none hover:text-gray-600 dark:hover:text-gray-400"
              @click="showPasswordConfirm = !showPasswordConfirm"
            >
              <Icon :name="showPasswordConfirm ? 'mdi:eye-off' : 'mdi:eye'" />
            </button>
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {{ internalMode === 'register' ? $t('common.auth.register') : $t('common.auth.login') }}
        </button>
        <div class="flex items-center my-4">
          <hr class="flex-grow border-gray-300 dark:border-gray-700" />
          <span class="mx-2 text-xs text-gray-400 dark:text-gray-500">{{ $t('common.auth.or') }}</span>
          <hr class="flex-grow border-gray-300 dark:border-gray-700" />
        </div>
        <div class="space-y-3 text-center">
          <button
            type="button"
            class="inline-flex items-center cursor-pointer justify-center w-full px-4 py-2 rounded-md bg-white dark:bg-[#131314] border border-[#747775] dark:border-[#8E918F] text-[#1F1F1F] dark:text-[#E3E3E3] text-sm font-roboto font-medium transition hover:bg-gray-50 dark:hover:bg-gray-800"
            @click="signInWithGoogle"
          >
            <img
              src="https://developers.google.com/identity/images/g-logo.png"
              alt="Google logo"
              class="w-5 h-5 mr-2"
            />
            {{ $t('common.auth.signInWithGoogle') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center cursor-pointer justify-center w-full px-4 py-2 rounded-md bg-[#24292e] dark:bg-[#24292e] border border-[#747775] dark:border-[#8E918F] text-white dark:text-white text-sm font-roboto font-medium transition hover:bg-[#2f363d] dark:hover:bg-[#2f363d]"
            @click="signInWithGithub"
          >
            <img src="https://simpleicons.org/icons/github.svg" alt="GitHub logo" class="w-5 h-5 mr-2" />
            {{ $t('common.auth.signInWithGithub') }}
          </button>
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

const init = { email: '', username: '', password: '', passwordConfirm: '', code: '' }
const form = ref<typeof init>(init)
const internalMode = shallowRef<'login' | 'register' | 'forgot' | 'reset'>('login')
const verifyMode = shallowRef<boolean>(false)
const showPassword = shallowRef(false)
const showPasswordConfirm = shallowRef(false)

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
      if (form.value.password !== form.value.passwordConfirm)
        return toast.error({ message: $t('common.auth.passwordsMismatch') })
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
      const result = await signIn('credentials', {
        email: form.value.email,
        password: form.value.password,
        redirect: false,
      })
      if (result?.error) return toast.error({ message: $t('common.auth.loginFailed') })
      await $fetch(`/api/users/${data.value?.user.id}`, {
        method: 'PATCH',
        body: { lastLogin: Date.now() },
      })
      const user = await $fetch(`/api/users/${data.value?.user.id}`)
      setLocale(user.language)
      theme.mode = user.theme
      toast.success({ message: $t('common.auth.loginSuccess') })
      if (data.value?.user?.role === 'superadmin') navigateTo('/master')
      else if (data.value?.user?.role === 'admin') navigateTo('/admin')
      else navigateTo('uzivatel/')
      form.value = init
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
      redirect: true,
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}`)
    setLocale(user.language)
    theme.mode = user.theme
    toast.success({ message: $t('common.auth.verifySuccess') })
    navigateTo('/')
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.auth.verifyFailed') })
  }
}

const signInWithGoogle = async () => {
  try {
    const result = await signIn('google', { redirect: false })
    if (result?.error) return toast.error({ message: $t('common.auth.googleSignInFailed') })
    await $fetch(`/api/users/${data.value?.user.id}`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}`)
    setLocale(user.language)
    theme.mode = user.theme
    if (data.value?.user?.role === 'superadmin') navigateTo('/master')
    else if (data.value?.user?.role === 'admin') navigateTo('/admin')
    else navigateTo('uzivatel/')
    form.value = init
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
  }
}

const signInWithGithub = async () => {
  try {
    const result = await signIn('github', { redirect: false })
    if (result?.error) return toast.error({ message: $t('common.auth.githubSignInFailed') })
    await $fetch(`/api/users/${data.value?.user.id}`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}`)
    setLocale(user.language)
    theme.mode = user.theme
    if (data.value?.user?.role === 'superadmin') navigateTo('/master')
    else if (data.value?.user?.role === 'admin') navigateTo('/admin')
    else navigateTo('uzivatel/')
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
