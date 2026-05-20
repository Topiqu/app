<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
        {{ $t('landing.onboarding.siteInfo') }}
      </h3>
      <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
        {{ $t('landing.onboarding.siteInfoDesc') }}
      </p>
    </div>

    <div class="space-y-8">
      <FormField
        v-model="form.siteName"
        required
        icon="mdi:web"
        :label="$t('landing.onboarding.siteName')"
        :placeholder="$t('landing.onboarding.siteNamePlaceholder')"
        inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
      />

      <div class="space-y-4">
        <FormLabel
          :text="$t('landing.onboarding.domainType')"
          class="font-bold text-[#111] dark:text-white"
        />
        <div
          class="grid grid-cols-2 gap-4"
          role="radiogroup"
          :aria-label="$t('landing.onboarding.domainType')"
        >
          <label
            v-for="opt in domainOptions"
            :key="opt.value"
            class="relative flex flex-col items-start p-6 cursor-pointer rounded-3xl border-[3px] transition-all duration-200"
            :class="
              form.domainType === opt.value
                ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[6px_6px_0_0_#67E8F9] -translate-y-1'
                : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
            "
          >
            <input v-model="form.domainType" type="radio" :value="opt.value" class="sr-only" />
            <Icon
              :name="opt.icon"
              size="32"
              class="mb-4 transition-colors"
              :class="form.domainType === opt.value ? 'text-[#67E8F9]' : 'text-[#888] dark:text-[#71717A]'"
            />
            <span class="text-xl font-black leading-tight block text-current">{{ opt.title }}</span>
            <span class="text-sm font-bold opacity-70 block mt-1 text-current">{{ opt.subtitle }}</span>
          </label>
        </div>
      </div>

      <div class="space-y-2 transition-all duration-300">
        <FormLabel
          class="font-bold text-[#111] dark:text-white"
          :text="
            form.domainType === 'SUBDOMAIN'
              ? $t('landing.onboarding.subdomain')
              : $t('landing.onboarding.customDomain')
          "
        />
        <div
          class="flex items-stretch rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-[#111] dark:focus-within:ring-white transition-all"
        >
          <FormField
            v-model="form.domain"
            required
            icon="mdi:link"
            :placeholder="
              form.domainType === 'SUBDOMAIN'
                ? $t('landing.onboarding.domainPlaceholder')
                : 'blog.mycompany.com'
            "
            inputClass="!bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent !ring-0 w-full text-lg font-bold py-4"
            class="w-full"
            :class="{ 'rounded-r-none': form.domainType === 'SUBDOMAIN' }"
            @input="userEditedDomain = true"
          />
          <div
            v-if="form.domainType === 'SUBDOMAIN'"
            class="flex items-center px-6 bg-[#E5E5E5] dark:bg-[#3F3F46] text-[#111] dark:text-white font-mono text-base font-black whitespace-nowrap"
          >
            .topiqu.com
          </div>
        </div>
        <div
          v-if="form.domain && domainStatus !== 'idle'"
          role="status"
          aria-live="polite"
          class="flex items-center gap-2 text-sm font-bold pt-1"
          :class="domainStatusColor"
        >
          <Icon
            :name="domainStatusIcon"
            class="w-4 h-4 shrink-0"
            :class="{ 'animate-spin': domainStatus === 'checking' }"
          />
          <span>{{ $t(`landing.onboarding.domainStatus.${domainStatus}`) }}</span>
        </div>
      </div>
    </div>

    <Button
      type="submit"
      variant="primary"
      size="lg"
      :disabled="!canAdvanceStep1"
      class="w-full mt-10 bg-[#D8B4FE] hover:bg-[#C084FC] text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#A855F7] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:shadow-[0_6px_0_0_#A855F7]"
      icon="mdi:arrow-right"
      iconPosition="right"
    >
      <span class="font-black tracking-wide">{{ $t('common.actions.continue') }}</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, userEditedDomain, domainStatus, domainStatusIcon, domainStatusColor, canAdvanceStep1 } =
  useOnboarding()

const domainOptions = computed(() => [
  {
    value: 'SUBDOMAIN',
    icon: 'mdi:subdomain',
    title: $t('landing.onboarding.subdomain'),
    subtitle: '.topiqu.com',
  },
  {
    value: 'CUSTOM',
    icon: 'mdi:earth',
    title: $t('landing.onboarding.customDomain'),
    subtitle: $t('landing.onboarding.customDomainExample'),
  },
])
</script>
