<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
        {{ $t('landing.onboarding.adminInfo') }}
      </h3>
      <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
        {{ $t('landing.onboarding.adminInfoDesc') }}
      </p>
    </div>

    <div class="space-y-6">
      <FormField
        v-model="form.username"
        required
        icon="mdi:account"
        :label="$t('common.labels.username')"
        :placeholder="$t('landing.onboarding.usernamePlaceholder')"
        inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
      />

      <FormField
        v-model="form.email"
        required
        type="email"
        icon="mdi:email"
        :label="$t('common.labels.email')"
        :placeholder="$t('landing.onboarding.emailPlaceholder').replace(`{'@'}`, '@')"
        inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
      />

      <UserPassword v-model="form.password" />
      <UserPassword
        v-model="form.passwordConfirm"
        isConfirm
        :isValid="form.password === form.passwordConfirm"
      />
    </div>

    <div class="flex gap-4 mt-10">
      <Button
        type="button"
        variant="neutral"
        size="lg"
        class="w-1/3 bg-[#F0F0F0] hover:bg-[#E5E5E5] dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-[#111] dark:text-white border-none rounded-2xl py-5 text-lg font-black transition-colors"
        @click="goBack(2)"
      >
        {{ $t('common.actions.back') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        :disabled="!canAdvanceStep3"
        class="w-2/3 bg-[#111] hover:bg-[#222] dark:bg-white dark:hover:bg-[#F0F0F0] text-white dark:text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#F9A8D4] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        icon="mdi:arrow-right"
        iconPosition="right"
      >
        <span class="font-black tracking-wide">{{ $t('landing.onboarding.continueToVerification') }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, canAdvanceStep3, goBack } = useOnboarding()
</script>
