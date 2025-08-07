<template>
  <div class="max-w-sm px-6">
    <div
      v-if="data?.user"
      class="bg-white px-6 py-8 rounded-2xl shadow-md text-center space-y-5 border border-gray-200"
    >
      <p class="text-green-600 text-lg font-semibold">Vítej, {{ data.user?.name }}!</p>
      <AuthLogout />
    </div>

    <div v-else-if="mode === 'forgot' || mode === 'reset'">
      <AuthForgot :mode="mode" @update:mode="mode = $event" />
    </div>

    <div v-else class="bg-white px-6 py-8 rounded-2xl shadow-md border border-gray-200 space-y-6">
      <div class="flex justify-center gap-3 text-sm font-medium">
        <button
          :class="[
            'px-4 py-2 rounded-lg transition font-semibold',
            mode === 'login' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          @click="mode = 'login'"
        >
          Přihlásit
        </button>
        <button
          :class="[
            'px-4 py-2 rounded-lg transition font-semibold',
            mode === 'register' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          ]"
          @click="mode = 'register'"
        >
          Registrace
        </button>
      </div>

      <form v-if="!verifyMode" class="space-y-5 text-sm" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-semibold text-gray-500">Email</label>
          <div class="relative">
            <Icon name="mdi:envelope" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
              autocomplete="email"
            />
          </div>
        </div>

        <div v-if="mode === 'register'" class="space-y-1.5">
          <label for="username" class="block text-sm font-semibold text-gray-500">Uživatelské jméno</label>
          <div class="relative">
            <Icon name="mdi:account" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
              minlength="3"
              maxlength="50"
              autocomplete="username"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <label for="password" class="block text-sm font-semibold text-gray-500">Heslo</label>
          <div class="relative">
            <Icon name="mdi:lock" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
              minlength="4"
              maxlength="124"
              autocomplete="current-password"
            />
          </div>
        </div>

        <div v-if="mode === 'register'" class="space-y-1.5">
          <label for="passwordConfirm" class="block text-sm font-semibold text-gray-500">Potvrzení hesla</label>
          <div class="relative">
            <Icon name="mdi:lock-check" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              id="passwordConfirm"
              v-model="form.passwordConfirm"
              type="password"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
              minlength="4"
              maxlength="124"
              autocomplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          {{ mode === 'register' ? 'Registrovat' : 'Přihlásit se' }}
        </button>

        <div v-if="mode === 'login'" class="text-center">
          <button
            type="button"
            class="inline-flex items-center justify-center px-4 py-2 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-sm font-medium transition"
            @click="mode = 'forgot'"
          >
            Zapomenuté heslo?
          </button>
        </div>
      </form>

      <form v-if="verifyMode" class="space-y-5 text-sm" @submit.prevent="verify">
        <p class="text-gray-500 text-sm">
          Zadejte ověřovací kód odeslaný na <span class="font-medium">{{ form.email }}</span>
        </p>
        <div class="space-y-1.5">
          <label for="code" class="block text-sm font-semibold text-gray-500">Ověřovací kód</label>
          <div class="relative">
            <Icon name="mdi:shield-check" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              id="code"
              v-model="form.code"
              type="text"
              class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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
import { useThemeStore } from '~~/stores/theme'
const theme = useThemeStore()
const { data, signIn } = useAuth()
const toast = useToast()

const init = { email: '', username: '', password: '', passwordConfirm: '', code: '' }
const form = ref<typeof init>(init)
const mode = shallowRef<'login' | 'register' | 'forgot' | 'reset'>('login')
const verifyMode = shallowRef<boolean>(false)

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
      theme.mode = user.theme // Nastavení tématu z uživatelských dat
      toast.success({ message: 'Přihlášení bylo úspěšné' })

      if (data.value?.user?.role === 'superadmin') navigateTo('/master')
      else if (data.value?.user?.role === 'admin') navigateTo('/admin')

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
</script>
