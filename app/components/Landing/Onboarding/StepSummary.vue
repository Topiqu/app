<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
        {{ $t('landing.onboarding.summary') }}
      </h3>
      <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
        {{ $t('landing.onboarding.summaryDesc') }}
      </p>
    </div>

    <div
      class="rounded-3xl border-[3px] border-[#E5E5E5] dark:border-[#3F3F46] divide-y-[3px] divide-[#E5E5E5] dark:divide-[#3F3F46] overflow-hidden"
    >
      <div
        v-for="row in summaryRows"
        :key="row.label"
        class="flex items-center gap-4 px-5 py-4 bg-[#FAFAFA] dark:bg-[#18181B]"
      >
        <Icon :name="row.icon" class="w-5 h-5 text-[#888] dark:text-[#71717A] shrink-0" />
        <span class="text-sm font-bold text-[#888] dark:text-[#71717A] uppercase tracking-wide w-40 shrink-0">
          {{ row.label }}
        </span>
        <span class="font-black text-[#111] dark:text-white truncate flex items-center gap-2">
          <span
            v-if="row.swatch"
            class="inline-block w-5 h-5 rounded-full border-2 border-[#E5E5E5] dark:border-[#3F3F46]"
            :style="{ backgroundColor: row.swatch }"
          ></span>
          {{ row.value }}
        </span>
      </div>
    </div>

    <label
      class="flex items-start gap-3 p-5 rounded-2xl cursor-pointer border-[3px] transition-colors"
      :class="
        form.acceptTos
          ? 'border-[#111] dark:border-white bg-[#F3E8FF] dark:bg-[#2E1065]'
          : 'border-[#E5E5E5] dark:border-[#3F3F46] hover:border-[#CCC] dark:hover:border-[#52525B]'
      "
    >
      <input v-model="form.acceptTos" type="checkbox" class="mt-1 w-5 h-5 accent-[#7E22CE] cursor-pointer" />
      <span class="text-sm font-bold text-[#111] dark:text-white leading-relaxed">
        <i18n-t keypath="landing.onboarding.acceptTos" tag="span">
          <template #tos>
            <NuxtLink
              :to="localePath('/tos')"
              target="_blank"
              class="underline text-[#7E22CE] dark:text-[#D8B4FE] hover:opacity-80"
              @click.stop
            >
              {{ $t('landing.onboarding.acceptTosLabel') }}
            </NuxtLink>
          </template>
          <template #privacy>
            <NuxtLink
              :to="localePath('/privacy')"
              target="_blank"
              class="underline text-[#7E22CE] dark:text-[#D8B4FE] hover:opacity-80"
              @click.stop
            >
              {{ $t('landing.onboarding.acceptPrivacyLabel') }}
            </NuxtLink>
          </template>
        </i18n-t>
      </span>
    </label>

    <div class="flex gap-4 mt-4">
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
        :loading="loading"
        :disabled="!form.acceptTos || loading"
        class="w-2/3 bg-[#67E8F9] hover:bg-[#22D3EE] text-[#111] border-none rounded-2xl !h-auto min-h-16 px-4 py-4 text-base md:text-lg shadow-[0_6px_0_0_#06B6D4] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0"
      >
        <div class="flex items-center justify-center gap-3 w-full min-w-0">
          <Icon name="mdi:rocket-launch" class="w-6 h-6 shrink-0" />
          <span class="font-black tracking-wide leading-tight text-center min-w-0">
            {{ $t('landing.onboarding.createAccount') }}
          </span>
        </div>
      </Button>
    </div>

    <div
      class="bg-[#F3E8FF] dark:bg-[#2E1065] rounded-2xl p-5 border-2 border-[#D8B4FE] dark:border-[#7E22CE]"
    >
      <p
        class="text-center text-[#7E22CE] dark:text-[#D8B4FE] font-black text-sm flex items-center justify-center gap-2 uppercase tracking-wide"
      >
        <Icon name="mdi:sparkles" class="w-5 h-5" />
        {{ $t('landing.onboarding.trialHintToken') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const localePath = useLocalePath()
const { form, loading, summaryRows, goBack } = useOnboarding()
</script>
