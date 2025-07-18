<template>
  <div class="max-w-xs mx-auto mt-16 px-4">
    <div
      v-if="data?.user"
      class="bg-white px-3 py-6 rounded-xl shadow text-center space-y-4 border border-gray-100"
    >
      <p class="text-green-600 text-base font-medium">
        Vítej, {{ data.user?.name }}!
      </p>
      <button
        class="w-full py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
        @click="handleLogout"
      >
        Odhlásit se
      </button>
    </div>

    <div
      v-else
      class="bg-white px-3 py-6 rounded-xl shadow border border-gray-100 space-y-5"
    >
      <div class="flex justify-center gap-2 text-sm font-medium">
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

      <form class="space-y-4 text-sm" @submit.prevent="submit">
        <div class="space-y-1">
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
              class="w-3/4 pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              minlength="3"
              maxlength="50"
              autocomplete="username"
            />
          </div>
          <p
            v-if="validation.errors.username"
            class="text-red-500 text-xs mt-1"
          >
            {{ validation.errors.username[0] }}
          </p>
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
              class="w-3/4 pl-9 pr-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-sm"
              required
              minlength="4"
              maxlength="124"
              autocomplete="current-password"
            />
          </div>
          <p
            v-if="validation.errors.password"
            class="text-red-500 text-xs mt-1"
          >
            {{ validation.errors.password[0] }}
          </p>
        </div>
        <button
          type="submit"
          class="w-full py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition"
        >
          {{ mode === 'register' ? 'Registrace' : 'Přihlásit se' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
const { data, signIn, signOut } = useAuth()
const toast = useToast()

const form = ref({ username: '', password: '' })
const mode = ref<'login' | 'register'>('login')

const validation = ref({
  isValid: true,
  errors: {} as Record<string, string[]>,
})

const validate = useDebounceFn(() => {
  const result = signInSchema.safeParse(form.value)
  validation.value = {
    isValid: result.success,
    errors: result.success ? {} : result.error.flatten().fieldErrors,
  }
}, 300)

watch(form, validate, { deep: true })
const submit = async () => {
  try {
    if (mode.value === 'register') {
      const res = await $fetch('/api/auth/register', {
        method: 'POST',
        body: form.value,
      })
      if (!res) {
        toast.error({ message: 'Neúspěšná registrace' })
        return
      }
    }

    const result = await signIn('credentials', {
      username: form.value.username,
      password: form.value.password,
      redirect: false,
    })

    if (result?.error) {
      toast.error({ message: 'Nepodařilo se vás přihlásit' })
    } else {
      toast.success({ message: 'Přihlášení bylo úspěšné' })
      if (data.value?.user?.role === 'superadmin') navigateTo('/superadmin')
      form.value = { username: '', password: '' }
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Něco se pokazilo' })
  }
}

const handleLogout = async () => {
  return (await signOut({ redirect: false }))
    ? toast.success({ message: 'Úspěšně odhlášeno' })
    : toast.error({ message: 'Nepodařilo se vás odhlásit' })
}
</script>
