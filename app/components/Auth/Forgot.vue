<template>
  <UCard>
    <UForm v-if="mode === 'forgot'" :state="form" :schema="forgotSchema" @submit="forgot">
      <div class="space-y-5 text-sm">
        <p class="text-center text-sm text-muted">{{ $t('common.auth.forgotPasswordPrompt') }}</p>
        <UFormField :label="$t('profile.email')" name="email">
          <UInput
            v-model="form.email"
            type="email"
            icon="i-mdi-envelope"
            class="w-full"
            placeholder="example@domain.tld"
            autocomplete="email"
            required
          />
        </UFormField>
        <UButton type="submit" :loading="submitting" :disabled="submitting" block>
          {{ $t('common.auth.sendCode') }}
        </UButton>
        <div class="text-center">
          <UButton type="button" color="neutral" variant="link" @click="emit('update:mode', 'login')">
            {{ $t('common.auth.backToLogin') }}
          </UButton>
        </div>
      </div>
    </UForm>

    <UForm v-if="mode === 'reset'" :state="form" :schema="resetSchema" @submit="reset">
      <div class="space-y-5 text-sm">
        <p class="text-sm text-muted">{{ $t('common.auth.resetPasswordPrompt') }}</p>
        <UFormField :label="$t('common.auth.verificationCode')" name="code">
          <UPinInput v-model="verificationDigits" :length="8" otp />
        </UFormField>

        <UFormField :label="$t('common.auth.newPassword')" name="password">
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="w-full"
            icon="i-mdi-lock"
            :trailingIcon="showPassword ? 'i-mdi-eye-off' : 'i-mdi-eye'"
            required
            :minlength="4"
            :maxlength="124"
            placeholder="********"
            autocomplete="new-password"
            @click:trailing="showPassword = !showPassword"
          />
        </UFormField>

        <UFormField :label="$t('common.auth.passwordConfirm')" name="passwordConfirm">
          <UInput
            v-model="form.passwordConfirm"
            :type="showPasswordConfirm ? 'text' : 'password'"
            class="w-full"
            icon="i-mdi-lock-check"
            :trailingIcon="showPasswordConfirm ? 'i-mdi-eye-off' : 'i-mdi-eye'"
            required
            :minlength="4"
            :maxlength="124"
            placeholder="********"
            autocomplete="new-password"
            @click:trailing="showPasswordConfirm = !showPasswordConfirm"
          />
        </UFormField>

        <UButton type="submit" :loading="submitting" :disabled="submitting" block>
          {{ $t('common.auth.resetPassword') }}
        </UButton>
        <UButton type="button" color="neutral" variant="outline" block @click="emit('update:mode', 'login')">
          {{ $t('common.auth.backToLogin') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>

<script setup lang="ts">
import { z } from 'zod'

defineProps<{ mode: 'forgot' | 'reset' }>()
const emit = defineEmits<{ (e: 'update:mode', value: 'login' | 'reset'): void }>()
const toast = useToast()

const form = ref({ email: '', password: '', passwordConfirm: '', code: '' })
const showPassword = shallowRef(false)
const showPasswordConfirm = shallowRef(false)
const submitting = shallowRef(false)
const forgotSchema = z.object({ email: z.email() })
const resetSchema = z
  .object({
    email: z.email(),
    code: z.string().length(8),
    password: z.string().min(4).max(124),
    passwordConfirm: z.string().min(4).max(124),
  })
  .refine((value) => value.password === value.passwordConfirm, { path: ['passwordConfirm'] })
const verificationDigits = computed<string[]>({
  get: () => form.value.code.split(''),
  set: (value) => (form.value.code = value.join('')),
})

const forgot = async () => {
  if (submitting.value) return
  submitting.value = true
  try {
    await $fetch('/api/auth/forgot', {
      method: 'POST',
      body: { email: form.value.email },
    })
    emit('update:mode', 'reset')
    toast.add({ color: 'success', title: $t('common.auth.verificationCodeSent') })
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('common.auth.sendCodeFailed') })
  } finally {
    submitting.value = false
  }
}

const reset = async () => {
  if (submitting.value) return
  if (form.value.password !== form.value.passwordConfirm) {
    toast.add({ color: 'error', title: $t('common.auth.passwordsMismatch') })
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/auth/reset', {
      method: 'POST',
      body: {
        email: form.value.email,
        code: form.value.code,
        password: form.value.password,
      },
    })
    toast.add({ color: 'success', title: $t('common.auth.resetPasswordSuccess') })
    emit('update:mode', 'login')
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('common.auth.resetPasswordFailed') })
  } finally {
    submitting.value = false
  }
}
</script>
