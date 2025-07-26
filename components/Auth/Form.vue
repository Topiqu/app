<template>
  <div class="max-w-xs mx-auto mt-16 px-4">
    <div
      v-if="data?.user"
      class="bg-white px-3 py-6 rounded-xl shadow text-center space-y-4 border border-gray-100"
    >
      <p class="text-green-600 text-base font-medium">
        Vítej, {{ data.user?.name }}!
      </p>
      <AuthLogout />
    </div>

    <div
      v-else
      class="bg-white px-3 py-6 rounded-xl shadow border border-gray-100 space-y-5"
    >
      <div
        v-if="!verifyMode"
        class="flex justify-center gap-2 text-sm font-medium"
      >
        <button
          :class="[
            'px-2 py-1.5 rounded-md transition',
            mode === 'login'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          ]"
          @click="mode = 'login'"
        >
          Přihlásit
        </button>
        <button
          :class="[
            'px-2 py-1.5 rounded-md transition',
            mode === 'register'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          ]"
          @click="mode = 'register'"
        >
          Registrace
        </button>
      </div>

      <form
        v-if="!verifyMode"
        class="space-y-4 text-sm"
        @submit.prevent="submit"
      >
        <div class="space-y-1">
          <label for="email" class="block font-medium">Email</label>
          <div class="relative">
            <Icon
              name="mdi:envelope"
              class="absolute left-2 top-2.5 w-5 h-5 text-gray-400"
            />
            <input
              id="email"
              v-model="form.email"
              type="email"
              class="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              autocomplete="email"
            />
          </div>
        </div>
        <div v-if="mode === 'register'" class="space-y-1">
          <label for="username" class="block font-medium"
            >Uživatelské jméno</label
          >
          <div class="relative">
            <Icon
              name="mdi:account"
              class="absolute left-2 top-2.5 w-5 h-5 text-gray-400"
            />
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              minlength="3"
              maxlength="50"
              autocomplete="username"
            />
          </div>
        </div>
        <div class="space-y-1">
          <label for="password" class="block font-medium">Heslo</label>
          <div class="relative">
            <Icon
              name="mdi:lock"
              class="absolute left-2 top-2.5 w-5 h-5 text-gray-400"
            />
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              minlength="4"
              maxlength="124"
              autocomplete="current-password"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
        >
          {{ mode === 'register' ? 'Registrovat' : 'Přihlásit se' }}
        </button>
      </form>

      <form v-else class="space-y-4 text-sm" @submit.prevent="verify">
        <p class="text-gray-600">
          Zadejte ověřovací kód odeslaný na {{ form.email }}
        </p>
        <div class="space-y-1">
          <label for="code" class="block font-medium">Ověřovací kód</label>
          <div class="relative">
            <Icon
              name="mdi:shield-check"
              class="absolute left-2 top-2.5 w-5 h-5 text-gray-400"
            />
            <input
              id="code"
              v-model="form.code"
              type="text"
              class="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              minlength="8"
              maxlength="8"
              placeholder="8místný kód"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
        >
          Ověřit
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const { data, signIn } = useAuth()
const toast = useToast()

const form = ref({ email: '', username: '', password: '', code: '' })
const mode = ref<'login' | 'register'>('login')
const verifyMode = ref(false)

const submit = async () => {
  try {
    if (mode.value === 'register') {
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: {
          username: form.value.username,
          email: form.value.email,
          password: form.value.password,
        },
      })
      if (res) {
        verifyMode.value = true
        toast.success({ message: 'Ověřovací kód byl odeslán na váš e-mail' })
      }
    } else {
      const result = await signIn('credentials', {
        email: form.value.email,
        password: form.value.password,
        redirect: false,
      })
      if (result?.error) {
        toast.error({ message: 'Nepodařilo se vás přihlásit' })
      } else {
        toast.success({ message: 'Přihlášení bylo úspěšné' })
        if (data.value?.user?.role === 'superadmin') {
          navigateTo('/master')
        } else if (data.value?.user?.role === 'admin') {
          navigateTo('/admin')
        }
        form.value = { email: '', username: '', password: '', code: '' }
      }
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
