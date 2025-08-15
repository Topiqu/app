<template>
  <div class="bg-white px-6 py-8 rounded-2xl shadow-md border border-gray-200 space-y-6">
    <form v-if="mode === 'forgot'" class="space-y-5 text-sm" @submit.prevent="forgot">
      <p class="text-gray-500 text-center text-sm">Zadejte e-mail pro obnovu hesla</p>
      <div class="space-y-1.5">
        <label for="email" class="block font-semibold text-gray-700">Email</label>
        <div class="relative">
          <Icon name="mdi:envelope" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="w-full pl-11 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            placeholder="example@domain.tld"
            autocomplete="email"
            required
          />
        </div>
      </div>
      <button
        type="submit"
        class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
      >
        Odeslat kód
      </button>
      <div class="text-center">
        <button
          type="button"
          class="inline-flex items-center justify-center px-4 py-2 rounded-md bg-transparent hover:bg-black/5 border-none text-blue-600 hover:text-blue-700 text-sm font-medium transition"
          @click="emit('update:mode', 'login')"
        >
          Zpět na přihlášení
        </button>
      </div>
    </form>

    <form v-if="mode === 'reset'" class="space-y-5 text-sm" @submit.prevent="reset">
      <p class="text-gray-500 text-sm">Zadejte ověřovací kód a nové heslo</p>
      <div class="space-y-1.5">
        <label for="code" class="block font-semibold text-gray-500">Ověřovací kód</label>
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

      <div class="space-y-1.5">
        <label for="password" class="block font-semibold text-gray-500">Nové heslo</label>
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
            autocomplete="new-password"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="passwordConfirm" class="block font-semibold text-gray-700">Potvrzení nového hesla</label>
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
        Resetovat heslo
      </button>
      <button
        type="button"
        class="w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-sm font-medium transition"
        @click="emit('update:mode', 'login')"
      >
        Zpět na přihlášení
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
defineProps<{ mode: 'forgot' | 'reset' }>()
const emit = defineEmits<{ (e: 'update:mode', value: 'login' | 'reset'): void }>()
const toast = useToast()

const form = ref({ email: '', password: '', passwordConfirm: '', code: '' })

const forgot = async () => {
  try {
    await $fetch('/api/auth/forgot', {
      method: 'POST',
      body: { email: form.value.email },
    })
    emit('update:mode', 'reset')
    toast.success({ message: 'Ověřovací kód byl odeslán na váš e-mail' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nepodařilo se odeslat kód' })
  }
}

const reset = async () => {
  if (form.value.password !== form.value.passwordConfirm) {
    toast.error({ message: 'Hesla se neshodují' })
    return
  }
  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: {
        email: form.value.email,
        code: form.value.code,
        password: form.value.password,
      },
    })
    toast.success({ message: 'Heslo bylo úspěšně změněno' })
    emit('update:mode', 'login')
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Reset hesla selhal' })
  }
}
</script>
