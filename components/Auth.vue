<template>
  <div class="max-w-md mx-auto mt-10">
    <div v-if="data?.user" class="space-y-4 text-center">
      <p class="text-green-600">
        Welcome, {{ data.user?.name || data.user?.email }}!
      </p>
      <button
        class="px-4 py-2 bg-red-500 text-white rounded"
        @click="handleLogout"
      >
        Logout
      </button>
    </div>

    <div v-else>
      <div class="flex justify-center mb-4 space-x-2">
        <button
          class="px-3 py-1 rounded"
          :class="{
            'bg-blue-500 text-white': mode === 'login',
            'bg-gray-200 text-black': mode !== 'login',
          }"
          @click="mode = 'login'"
        >
          Login
        </button>
        <button
          class="px-3 py-1 rounded"
          :class="{
            'bg-blue-500 text-white': mode === 'register',
            'bg-gray-200 text-black': mode !== 'register',
          }"
          @click="mode = 'register'"
        >
          Register
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="username" class="block text-sm">Username</label>
          <input
            id="username"
            v-model="form.username"
            type="text"
            class="w-full border rounded px-2 py-1"
            required
            minlength="3"
            maxlength="50"
          />
          <p v-if="validation.errors.username" class="text-red-500 text-sm">
            {{ validation.errors.username[0] }}
          </p>
        </div>
        <div>
          <label for="password" class="block text-sm">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            class="w-full border rounded px-2 py-1"
            required
            minlength="4"
            maxlength="124"
          />
          <p v-if="validation.errors.password" class="text-red-500 text-sm">
            {{ validation.errors.password[0] }}
          </p>
        </div>
        <button
          type="submit"
          class="px-4 py-2 bg-blue-500 text-white rounded w-full"
        >
          {{ mode === 'register' ? 'Register' : 'Login' }}
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
      toast.error({ message: result.error })
    } else {
      toast.success({ message: 'Přihlášení bylo úspěšné' })
      form.value = { username: '', password: '' }
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Something went wrong' })
  }
}

const handleLogout = async () => {
  return (await signOut({ redirect: false }))
    ? toast.success({ message: 'Úspěšně odhlášeno' })
    : toast.error({ message: 'Nepodařilo se vás odhlásit' })
}
</script>
