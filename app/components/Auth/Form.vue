<template>
  <div class="w-xs sm:w-sm md:w-md px-6">
    <div
      v-if="data?.user"
      class="bg-white dark:bg-gray-900 px-6 py-8 rounded-2xl shadow-md text-center space-y-5 border border-gray-200 dark:border-gray-700"
    >
      <p class="text-green-600 dark:text-green-400 text-lg font-semibold">Vítej, {{ data.user?.name }}!</p>
      <AuthLogout />
    </div>

    <div v-else-if="mode === 'forgot' || mode === 'reset'">
      <AuthForgot :mode="mode" @update:mode="mode = $event" />
    </div>

    <div
      v-else
      class="bg-white dark:bg-gray-900 px-6 py-8 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-6"
    >
      <div class="flex justify-between items-center gap-2 text-sm font-medium">
        <button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            mode === 'login'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
          @click="mode = 'login'"
        >
          Přihlásit
        </button>
        <button
          :class="[
            'w-full px-4 py-2 rounded-lg transition font-semibold',
            mode === 'register'
              ? 'bg-blue-600 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
          ]"
          @click="mode = 'register'"
        >
          Registrace
        </button>
      </div>

      <form v-if="!verifyMode" class="space-y-5 text-sm" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">Email</label>
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

        <div v-if="mode === 'register'" class="space-y-1.5">
          <label for="username" class="block text-sm font-semibold text-gray-500 dark:text-gray-400"
            >Uživatelské jméno</label
          >
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
          <label for="password" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">Heslo</label>
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
        </div>

        <div v-if="mode === 'register'" class="space-y-1.5">
          <label for="passwordConfirm" class="block text-sm font-semibold text-gray-500 dark:text-gray-400"
            >Potvrzení hesla</label
          >
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
          {{ mode === 'register' ? 'Registrovat' : 'Přihlásit se' }}
        </button>

        <div class="text-center">
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
            Přihlásit se přes Google
          </button>
        </div>

        <div v-if="mode === 'login'" class="text-center">
          <button
            type="button"
            class="inline-flex items-center justify-center px-4 py-2 rounded-md bg-transparent hover:bg-black/5 dark:hover:bg-white/5 border-none text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 text-sm font-medium transition"
            @click="mode = 'forgot'"
          >
            Zapomenuté heslo?
          </button>
        </div>
      </form>

      <form v-if="verifyMode" class="space-y-5 text-sm" @submit.prevent="verify">
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Zadejte ověřovací kód odeslaný na <span class="font-medium">{{ form.email }}</span>
        </p>
        <div class="space-y-1.5">
          <label for="code" class="block text-sm font-semibold text-gray-500 dark:text-gray-400">Ověřovací kód</label>
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
              placeholder="8místný kód"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          Ověřit
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const toast = useToast()
const theme = useThemeStore()
const { data, signIn } = useAuth()

const init = { email: '', username: '', password: '', passwordConfirm: '', code: '' }
const form = ref<typeof init>(init)
const mode = shallowRef<'login' | 'register' | 'forgot' | 'reset'>('login')
const verifyMode = shallowRef<boolean>(false)
const showPassword = shallowRef(false)
const showPasswordConfirm = shallowRef(false)

const submit = async () => {
  try {
    if (mode.value === 'register') {
      if (form.value.password !== form.value.passwordConfirm) return toast.error({ message: 'Hesla se neshodují' })

      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          username: form.value.username,
          email: form.value.email,
          password: form.value.password,
        },
      })
      if (!res) return toast.error({ message: 'Registrace selhala' })

      verifyMode.value = true
      toast.success({ message: 'Ověřovací kód byl odeslán na váš e-mail' })
    } else {
      const result = await signIn('credentials', {
        email: form.value.email,
        password: form.value.password,
        redirect: false,
      })

      if (result?.error) return toast.error({ message: 'Nepodařilo se vás přihlásit' })

      await $fetch(`/api/users/${data.value?.user.id}`, {
        method: 'PATCH',
        body: { lastLogin: Date.now() },
      })
      const user = await $fetch(`/api/users/${data.value?.user.id}`)
      theme.mode = user.theme
      toast.success({ message: 'Přihlášení bylo úspěšné' })

      if (data.value?.user?.role === 'superadmin') navigateTo('/master')
      else if (data.value?.user?.role === 'admin') navigateTo('/admin')
      else navigateTo('uzivatel/')

      form.value = init
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Něco se pokazilo' })
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

    toast.success({ message: 'E-mail byl ověřen.' })
    navigateTo('/')
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Ověření selhalo' })
  }
}

const signInWithGoogle = async () => {
  try {
    const result = await signIn('google', { redirect: false })
    if (result?.error) return toast.error({ message: 'Přihlášení přes Google selhalo' })

    await $fetch(`/api/users/${data.value?.user.id}`, {
      method: 'PATCH',
      body: { lastLogin: Date.now() },
    })
    const user = await $fetch(`/api/users/${data.value?.user.id}`)
    theme.mode = user.theme
    toast.success({ message: 'Přihlášení přes Google bylo úspěšné' })

    if (data.value?.user?.role === 'superadmin') navigateTo('/master')
    else if (data.value?.user?.role === 'admin') navigateTo('/admin')
    else navigateTo('uzivatel/')

    form.value = init
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Něco se pokazilo' })
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
