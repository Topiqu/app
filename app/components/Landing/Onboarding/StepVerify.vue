<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight flex items-center gap-3">
        <Icon name="mdi:email-check-outline" class="w-7 h-7 text-[#7E22CE] dark:text-[#D8B4FE]" />
        {{ $t('landing.onboarding.verifyTitle') }}
      </h3>
      <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
        <i18n-t keypath="landing.onboarding.verifyDesc" tag="span">
          <template #email>
            <span class="font-black text-[#111] dark:text-white">{{ form.email }}</span>
          </template>
        </i18n-t>
      </p>
    </div>

    <div class="space-y-6">
      <div class="space-y-3">
        <FormLabel
          :text="$t('common.auth.verificationCode')"
          class="font-bold text-[#111] dark:text-white"
        />
        <input
          ref="inputRef"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="······"
          :aria-label="$t('common.auth.verificationCode')"
          :disabled="codeVerifying || !challenge"
          class="w-full bg-[#F0F0F0] dark:bg-[#27272A] border-transparent focus:bg-white dark:focus:bg-[#18181B] focus:ring-4 focus:ring-[#111] dark:focus:ring-white transition-all text-center text-3xl md:text-4xl font-black tracking-[0.5em] rounded-2xl py-5 disabled:opacity-60"
          @input="onCodeInput"
        />
        <p
          v-if="codeError"
          class="text-sm font-bold text-[#DC2626] dark:text-[#FCA5A5] flex items-center gap-2"
        >
          <Icon name="mdi:alert-circle" class="w-4 h-4 shrink-0" />
          {{ codeError }}
        </p>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span class="text-[#888] dark:text-[#71717A] font-bold">
          {{ $t('landing.onboarding.codeNotReceived') }}
        </span>
        <button
          type="button"
          :disabled="codeSending || resendCooldown > 0"
          class="font-black uppercase tracking-wide text-[#7E22CE] dark:text-[#D8B4FE] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
          @click="sendCode()"
        >
          <Icon
            :name="codeSending ? 'mdi:loading' : 'mdi:email-sync-outline'"
            :class="['w-4 h-4', codeSending ? 'animate-rotate' : '']"
          />
          {{
            resendCooldown > 0
              ? $t('landing.onboarding.resendCodeIn', { seconds: resendCooldown })
              : $t('landing.onboarding.resendCode')
          }}
        </button>
      </div>
    </div>

    <div class="flex gap-4 mt-10">
      <Button
        type="button"
        variant="neutral"
        size="lg"
        class="w-1/3 bg-[#F0F0F0] hover:bg-[#E5E5E5] dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-[#111] dark:text-white border-none rounded-2xl py-5 text-lg font-black transition-colors"
        @click="goBack(4)"
      >
        {{ $t('common.actions.back') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        :loading="codeVerifying"
        :disabled="!canAdvanceStep4 || codeVerifying"
        class="w-2/3 bg-[#111] hover:bg-[#222] dark:bg-white dark:hover:bg-[#F0F0F0] text-white dark:text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#F9A8D4] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        icon="mdi:check-bold"
        iconPosition="right"
      >
        <span class="font-black tracking-wide">{{ $t('landing.onboarding.verifyAndContinue') }}</span>
      </Button>
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
