<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-highlighted tracking-tight">
        {{ $t('landing.onboarding.adminInfo') }}
      </h3>
      <p class="text-[1.05rem] text-muted font-medium leading-relaxed">
        {{ $t('landing.onboarding.adminInfoDesc') }}
      </p>
    </div>

    <div class="space-y-6">
      <UFormField :label="$t('common.labels.username')">
        <UInput
          v-model="form.username"
          required
          :placeholder="$t('landing.onboarding.usernamePlaceholder')"
          leadingIcon="i-mdi-account"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="$t('common.labels.email')">
        <UInput
          v-model="form.email"
          required
          type="email"
          :placeholder="$t('landing.onboarding.emailPlaceholder').replace(`{'@'}`, '@')"
          leadingIcon="i-mdi-email"
          class="w-full"
        />
      </UFormField>

      <UserPassword v-model="form.password" />
      <UserPassword v-model="form.passwordConfirm" isConfirm :isValid="form.password === form.passwordConfirm" />
    </div>

    <div class="flex gap-4 mt-10">
      <UButton type="button" color="neutral" variant="soft" size="lg" class="w-1/3" @click="goBack(2)">
        {{ $t('common.actions.back') }}
      </UButton>
      <UButton
        type="submit"
        color="primary"
        variant="solid"
        size="lg"
        :disabled="!canAdvanceStep3"
        class="w-2/3"
        trailingIcon="i-mdi-arrow-right"
      >
        {{ $t('landing.onboarding.continueToVerification') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, canAdvanceStep3, goBack } = useOnboarding()
</script>
