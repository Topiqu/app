<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
        {{ $t('landing.onboarding.designFocus') }}
      </h3>
      <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
        {{ $t('landing.onboarding.designFocusDesc') }}
      </p>
    </div>

    <div class="space-y-8">
      <div>
        <FormLabel
          :text="$t('landing.onboarding.mainLanguage')"
          class="font-bold text-[#111] dark:text-white mb-3 block"
        />
        <div
          class="grid grid-cols-2 gap-4"
          role="radiogroup"
          :aria-label="$t('landing.onboarding.mainLanguage')"
        >
          <label
            v-for="opt in languageOptions"
            :key="opt.value"
            class="relative flex items-center p-5 cursor-pointer rounded-2xl border-[3px] transition-all duration-200"
            :class="
              form.language === opt.value
                ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[4px_4px_0_0_#F9A8D4] -translate-y-1'
                : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
            "
          >
            <input v-model="form.language" type="radio" :value="opt.value" class="sr-only" />
            <span
              class="text-4xl mr-4"
              :class="{ 'grayscale-0': form.language === opt.value, grayscale: form.language !== opt.value }"
              >{{ opt.flag }}</span
            >
            <span class="font-black text-lg text-current">{{ opt.label }}</span>
          </label>
        </div>
      </div>

      <div class="pt-2">
        <FormColorPicker
          v-model="form.theme"
          :label="$t('landing.onboarding.mainColor')"
          class="font-bold"
        />
      </div>

      <FormField
        v-model="form.focus"
        icon="mdi:target"
        :label="$t('landing.onboarding.siteFocus')"
        :placeholder="$t('landing.onboarding.siteFocusPlaceholder')"
        inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
      />
    </div>

    <div class="flex gap-4 mt-10">
      <Button
        type="button"
        variant="neutral"
        size="lg"
        class="w-1/3 bg-[#F0F0F0] hover:bg-[#E5E5E5] dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-[#111] dark:text-white border-none rounded-2xl py-5 text-lg font-black transition-colors"
        @click="goBack(1)"
      >
        {{ $t('common.actions.back') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        class="w-2/3 bg-[#111] hover:bg-[#222] dark:bg-white dark:hover:bg-[#F0F0F0] text-white dark:text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#F9A8D4] active:shadow-none active:translate-y-[6px] transition-all"
        icon="mdi:arrow-right"
        iconPosition="right"
      >
        <span class="font-black tracking-wide">{{ $t('landing.onboarding.continueToAccount') }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, goBack } = useOnboarding()

const languageOptions = computed(() => [
  { value: 'cs', flag: '🇨🇿', label: $t('landing.onboarding.langCz') },
  { value: 'en', flag: '🇬🇧', label: $t('landing.onboarding.langEn') },
])
</script>
