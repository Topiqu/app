<template>
  <div class="bg-white px-6 py-8 rounded-2xl shadow-md border border-gray-200 space-y-6">
    <form v-if="mode === 'forgot'" class="space-y-5 text-sm" @submit.prevent="forgot">
      <p class="text-gray-500 text-center text-sm">{{ $t('common.auth.forgotPasswordPrompt') }}</p>
      <div class="space-y-1.5">
        <label for="email" class="block font-semibold text-gray-700">{{ $t('profile.email') }}</label>
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
        {{ $t('common.auth.sendCode') }}
      </button>
      <div class="text-center">
        <button
          type="button"
          class="inline-flex items-center justify-center px-4 py-2 rounded-md bg-transparent hover:bg-black/5 border-none text-blue-600 hover:text-blue-700 text-sm font-medium transition"
          @click="emit('update:mode', 'login')"
        >
          {{ $t('common.auth.backToLogin') }}
        </button>
      </div>
    </form>

    <form v-if="mode === 'reset'" class="space-y-5 text-sm" @submit.prevent="reset">
      <p class="text-gray-500 text-sm">{{ $t('common.auth.resetPasswordPrompt') }}</p>
      <div class="space-y-1.5">
        <label for="code" class="block font-semibold text-gray-500">{{ $t('common.auth.verificationCode') }}</label>
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
            :placeholder="$t('common.auth.verificationCodePlaceholder')"
          />
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="password" class="block font-semibold text-gray-500">{{ $t('common.auth.newPassword') }}</label>
        <div class="relative">
          <Icon name="mdi:lock" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            id="password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="w-full pl-11 pr-10 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            required
            minlength="4"
            maxlength="124"
            placeholder="********"
            autocomplete="new-password"
          />
          <button
            type="button"
            class="absolute right-3 top-2.5 w-5 h-5 bg-transparent hover:bg-transparent border-none outline-none text-gray-400 hover:text-gray-600"
            @click="showPassword = !showPassword"
          >
            <Icon :name="showPassword ? 'mdi:eye-off' : 'mdi:eye'" />
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label for="passwordConfirm" class="block font-semibold text-gray-700">{{
          $t('common.auth.passwordConfirm')
        }}</label>
        <div class="relative">
          <Icon name="mdi:lock-check" class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input
            id="passwordConfirm"
            v-model="form.passwordConfirm"
            :type="showPasswordConfirm ? 'text' : 'password'"
            class="w-full pl-11 pr-10 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            required
            minlength="4"
            maxlength="124"
            placeholder="********"
            autocomplete="new-password"
          />
          <button
            type="button"
            class="absolute right-3 top-2.5 w-5 h-5 bg-transparent hover:bg-transparent border-none outline-none text-gray-400 hover:text-gray-600"
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
        {{ $t('common.auth.resetPassword') }}
      </button>
      <button
        type="button"
        class="w-full mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 text-sm font-medium transition"
        @click="emit('update:mode', 'login')"
      >
        {{ $t('common.auth.backToLogin') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
defineProps<{ mode: 'forgot' | 'reset' }>()
const emit = defineEmits<{ (e: 'update:mode', value: 'login' | 'reset'): void }>()
const toast = useToast()

const form = ref({ email: '', password: '', passwordConfirm: '', code: '' })
const showPassword = shallowRef(false)
const showPasswordConfirm = shallowRef(false)

const forgot = async () => {
  try {
    await $fetch('/api/auth/forgot', {
      method: 'POST',
      body: { email: form.value.email },
    })
    emit('update:mode', 'reset')
    toast.success({ message: $t('common.auth.verificationCodeSent') })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.auth.sendCodeFailed') })
  }
}

const reset = async () => {
  if (form.value.password !== form.value.passwordConfirm) {
    toast.error({ message: $t('common.auth.passwordsMismatch') })
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
    toast.success({ message: $t('common.auth.resetPasswordSuccess') })
    emit('update:mode', 'login')
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.auth.resetPasswordFailed') })
  }
}
</script>
