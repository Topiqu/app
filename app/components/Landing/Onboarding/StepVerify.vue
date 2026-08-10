<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-highlighted tracking-tight flex items-center gap-3">
        <UIcon name="i-mdi-email-check-outline" size="28" />
        {{ $t('landing.onboarding.verifyTitle') }}
      </h3>
      <p class="text-[1.05rem] text-muted font-medium leading-relaxed">
        <i18n-t keypath="landing.onboarding.verifyDesc" tag="span">
          <template #email>
            <span class="font-bold text-highlighted">{{ form.email }}</span>
          </template>
        </i18n-t>
      </p>
    </div>

    <div class="space-y-6">
      <div class="space-y-3">
        <UFormField :label="$t('common.auth.verificationCode')" :error="codeError || undefined">
          <UInput
            ref="inputRef"
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="······"
            :aria-label="$t('common.auth.verificationCode')"
            :disabled="codeVerifying || !challenge"
            class="w-full"
            @input="onCodeInput"
          />
        </UFormField>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span class="text-muted font-medium">
          {{ $t('landing.onboarding.codeNotReceived') }}
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          type="button"
          :disabled="codeSending || resendCooldown > 0"
          :loading="codeSending"
          icon="i-mdi-email-sync-outline"
          @click="sendCode()"
        >
          {{
            resendCooldown > 0
              ? $t('landing.onboarding.resendCodeIn', { seconds: resendCooldown })
              : $t('landing.onboarding.resendCode')
          }}
        </UButton>
      </div>
    </div>

    <div class="flex gap-4 mt-10">
      <UButton type="button" color="neutral" variant="soft" size="lg" class="w-1/3" @click="goBack(4)">
        {{ $t('common.actions.back') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        variant="solid"
        size="lg"
        :loading="codeVerifying"
        :disabled="!canAdvanceStep4 || codeVerifying"
        class="w-2/3"
        trailingIcon="i-mdi-check-bold"
      >
        {{ $t('landing.onboarding.verifyAndContinue') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  form,
  code,
  codeError,
  codeSending,
  codeVerifying,
  resendCooldown,
  challenge,
  canAdvanceStep4,
  onCodeInput,
  sendCode,
  goBack,
  registerCodeInput,
} = useOnboarding()

const inputRef = useTemplateRef<HTMLInputElement>('inputRef')

onMounted(() => registerCodeInput(inputRef.value))
onBeforeUnmount(() => registerCodeInput(null))
</script>
