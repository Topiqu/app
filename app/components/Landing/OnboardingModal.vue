<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <div class="absolute inset-0 bg-[#EBE9E4] dark:bg-[#0C0C0C] transition-opacity" @click="open = false"></div>

    <div
      class="relative bg-[#FAFAFA] dark:bg-[#18181B] rounded-[2.5rem] w-full max-w-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in-up"
    >
      <div class="p-8 md:p-12">
        <div class="flex justify-between items-start mb-12">
          <h2
            class="text-3xl md:text-4xl font-black text-[#111] dark:text-white tracking-tighter leading-tight flex items-center gap-5"
          >
            <div
              class="w-14 h-14 bg-[#D8B4FE] text-[#111] rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0_0_rgba(17,17,17,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] transform -rotate-3 transition-transform hover:rotate-0"
            >
              <Icon name="mdi:rocket-launch" class="w-7 h-7" />
            </div>
            {{ $t('landing.onboarding.title', 'Create your own blog') }}
          </h2>
          <Button
            style="
              background: transparent !important;
              border: none !important;
              padding: 0 !important;
              box-shadow: none !important;
              color: currentColor !important;
            "
            class="text-[#888] hover:text-[#111] dark:hover:text-white transition-colors cursor-pointer mt-1"
            @click="open = false"
          >
            <Icon name="mdi:close" size="32" />
          </Button>
        </div>

        <div class="flex gap-2 mb-12">
          <div
            v-for="s in 3"
            :key="s"
            class="h-3 flex-1 rounded-full transition-colors duration-500"
            :class="step >= s ? 'bg-[#111] dark:bg-white' : 'bg-[#E5E5E5] dark:bg-[#27272A]'"
          ></div>
        </div>

        <form @submit.prevent="handleSubmit">
          <Transition
            mode="out-in"
            enterActiveClass="transition-opacity duration-300 ease-out"
            enterFromClass="opacity-0"
            enterToClass="opacity-100"
            leaveActiveClass="transition-opacity duration-200 ease-in"
            leaveFromClass="opacity-100"
            leaveToClass="opacity-0"
          >
            <div v-if="step === 1" :key="'step1'" class="space-y-8">
              <div class="space-y-3">
                <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
                  {{ $t('landing.onboarding.siteInfo', 'Site info') }}
                </h3>
                <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
                  {{
                    $t(
                      'landing.onboarding.siteInfoDesc',
                      'Let’s start with the basics — what your project is called and where to find it.',
                    )
                  }}
                </p>
              </div>

              <div class="space-y-8">
                <FormField
                  v-model="form.siteName"
                  required
                  icon="mdi:web"
                  :label="$t('landing.onboarding.siteName', 'Site name')"
                  :placeholder="$t('landing.onboarding.siteNamePlaceholder', 'My awesome blog')"
                  inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
                />

                <div class="space-y-4">
                  <FormLabel
                    :text="$t('landing.onboarding.domainType', 'Domain type')"
                    class="font-bold text-[#111] dark:text-white"
                  />
                  <div class="grid grid-cols-2 gap-4">
                    <label
                      class="relative flex flex-col items-start p-6 cursor-pointer rounded-3xl border-[3px] transition-all duration-200"
                      :class="
                        form.domainType === 'SUBDOMAIN'
                          ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[6px_6px_0_0_#67E8F9] -translate-y-1'
                          : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
                      "
                    >
                      <input v-model="form.domainType" type="radio" value="SUBDOMAIN" class="sr-only" />
                      <Icon
                        name="mdi:subdomain"
                        size="32"
                        class="mb-4 transition-colors"
                        :class="form.domainType === 'SUBDOMAIN' ? 'text-[#67E8F9]' : 'text-[#888] dark:text-[#71717A]'"
                      />
                      <span class="text-xl font-black leading-tight block text-current">
                        {{ $t('landing.onboarding.subdomain', 'Subdomain') }}
                      </span>
                      <span class="text-sm font-bold opacity-70 block mt-1 text-current">.topiqu.com</span>
                    </label>

                    <label
                      class="relative flex flex-col items-start p-6 cursor-pointer rounded-3xl border-[3px] transition-all duration-200"
                      :class="
                        form.domainType === 'CUSTOM'
                          ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[6px_6px_0_0_#67E8F9] -translate-y-1'
                          : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
                      "
                    >
                      <input v-model="form.domainType" type="radio" value="CUSTOM" class="sr-only" />
                      <Icon
                        name="mdi:earth"
                        size="32"
                        class="mb-4 transition-colors"
                        :class="form.domainType === 'CUSTOM' ? 'text-[#67E8F9]' : 'text-[#888] dark:text-[#71717A]'"
                      />
                      <span class="text-xl font-black leading-tight block text-current">
                        {{ $t('landing.onboarding.customDomain', 'Custom domain') }}
                      </span>
                      <span class="text-sm font-bold opacity-70 block mt-1 text-current">{{
                        $t('landing.onboarding.customDomainExample', 'mysite.com')
                      }}</span>
                    </label>
                  </div>
                </div>

                <div class="space-y-2 transition-all duration-300">
                  <FormLabel
                    class="font-bold text-[#111] dark:text-white"
                    :text="
                      form.domainType === 'SUBDOMAIN'
                        ? $t('landing.onboarding.subdomain', 'Subdomain')
                        : $t('landing.onboarding.customDomain', 'Custom domain')
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
                          ? $t('landing.onboarding.domainPlaceholder', 'my-awesome-site')
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
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                class="w-full mt-10 bg-[#D8B4FE] hover:bg-[#C084FC] text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#A855F7] active:shadow-none active:translate-y-[6px] transition-all"
                icon="mdi:arrow-right"
                iconPosition="right"
              >
                <span class="font-black tracking-wide">{{ $t('common.actions.continue') }}</span>
              </Button>
            </div>

            <div v-else-if="step === 2" :key="'step2'" class="space-y-8">
              <div class="space-y-3">
                <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
                  {{ $t('landing.onboarding.designFocus', 'Design & Focus') }}
                </h3>
                <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
                  {{
                    $t(
                      'landing.onboarding.designFocusDesc',
                      'Customize the platform to your brand and define the main topic.',
                    )
                  }}
                </p>
              </div>

              <div class="space-y-8">
                <div>
                  <FormLabel
                    :text="$t('landing.onboarding.mainLanguage', 'Main content language')"
                    class="font-bold text-[#111] dark:text-white mb-3 block"
                  />
                  <div class="grid grid-cols-2 gap-4">
                    <label
                      class="relative flex items-center p-5 cursor-pointer rounded-2xl border-[3px] transition-all duration-200"
                      :class="
                        form.language === 'cs'
                          ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[4px_4px_0_0_#F9A8D4] -translate-y-1'
                          : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
                      "
                    >
                      <input v-model="form.language" type="radio" value="cs" class="sr-only" />
                      <span
                        class="text-4xl mr-4"
                        :class="{ 'grayscale-0': form.language === 'cs', grayscale: form.language !== 'cs' }"
                        >🇨🇿</span
                      >
                      <span class="font-black text-lg text-current">{{
                        $t('landing.onboarding.langCz', 'Czech')
                      }}</span>
                    </label>

                    <label
                      class="relative flex items-center p-5 cursor-pointer rounded-2xl border-[3px] transition-all duration-200"
                      :class="
                        form.language === 'en'
                          ? 'border-[#111] bg-[#111] text-white dark:border-white dark:bg-white dark:text-[#111] shadow-[4px_4px_0_0_#F9A8D4] -translate-y-1'
                          : 'border-[#E5E5E5] dark:border-[#3F3F46] bg-transparent text-[#555] dark:text-[#A1A1AA] hover:border-[#CCC] dark:hover:border-[#52525B]'
                      "
                    >
                      <input v-model="form.language" type="radio" value="en" class="sr-only" />
                      <span
                        class="text-4xl mr-4"
                        :class="{ 'grayscale-0': form.language === 'en', grayscale: form.language !== 'en' }"
                        >🇬🇧</span
                      >
                      <span class="font-black text-lg text-current">{{
                        $t('landing.onboarding.langEn', 'English')
                      }}</span>
                    </label>
                  </div>
                </div>

                <div class="pt-2">
                  <FormColorPicker
                    v-model="form.theme"
                    :label="$t('landing.onboarding.mainColor', 'Main brand color')"
                    class="font-bold"
                  />
                </div>

                <FormField
                  v-model="form.focus"
                  icon="mdi:target"
                  :label="$t('landing.onboarding.siteFocus', 'Main site focus (optional)')"
                  :placeholder="$t('landing.onboarding.siteFocusPlaceholder', 'e.g. Technology, Lifestyle...')"
                  inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
                />
              </div>

              <div class="flex gap-4 mt-10">
                <Button
                  type="button"
                  variant="neutral"
                  size="lg"
                  class="w-1/3 bg-[#F0F0F0] hover:bg-[#E5E5E5] dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-[#111] dark:text-white border-none rounded-2xl py-5 text-lg font-black transition-colors"
                  @click="step = 1"
                >
                  {{ $t('common.actions.back', 'Back') }}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  class="w-2/3 bg-[#111] hover:bg-[#222] dark:bg-white dark:hover:bg-[#F0F0F0] text-white dark:text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#F9A8D4] active:shadow-none active:translate-y-[6px] transition-all"
                  icon="mdi:arrow-right"
                  iconPosition="right"
                >
                  <span class="font-black tracking-wide">{{
                    $t('landing.onboarding.continueToAccount', 'Continue')
                  }}</span>
                </Button>
              </div>
            </div>

            <div v-else-if="step === 3" :key="'step3'" class="space-y-8">
              <div class="space-y-3">
                <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight">
                  {{ $t('landing.onboarding.adminInfo', 'Admin account') }}
                </h3>
                <p class="text-[1.05rem] text-[#555] dark:text-[#A1A1AA] font-medium leading-relaxed">
                  {{
                    $t(
                      'landing.onboarding.adminInfoDesc',
                      'Almost done. Create your admin credentials.',
                    )
                  }}
                </p>
              </div>

              <div class="space-y-6">
                <FormField
                  v-model="form.username"
                  required
                  icon="mdi:account"
                  :label="$t('common.labels.username', 'Username')"
                  :placeholder="$t('landing.onboarding.usernamePlaceholder', 'admin')"
                  inputClass="w-full !bg-[#F0F0F0] dark:!bg-[#27272A] !border-transparent focus:!bg-white dark:focus:!bg-[#18181B] focus:!ring-4 focus:!ring-[#111] dark:focus:!ring-white transition-all text-lg font-bold rounded-2xl py-4"
                />

                <FormField
                  v-model="form.email"
                  required
                  type="email"
                  icon="mdi:email"
                  :label="$t('common.labels.email', 'Email')"
                  :placeholder="$t('landing.onboarding.emailPlaceholder', 'admin@example.com').replace(`{'@'}`, '@')"
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
                  @click="step = 2"
                >
                  {{ $t('common.actions.back', 'Back') }}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  class="w-2/3 bg-[#67E8F9] hover:bg-[#22D3EE] text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#06B6D4] active:shadow-none active:translate-y-[6px] transition-all"
                  :loading="loading"
                >
                  <div class="flex items-center justify-center gap-3">
                    <Icon name="mdi:rocket-launch" class="w-6 h-6" />
                    <span class="font-black tracking-wide">{{
                      $t('landing.onboarding.startTrial', 'Start with full access')
                    }}</span>
                  </div>
                </Button>
              </div>

              <div
                class="bg-[#F3E8FF] dark:bg-[#2E1065] rounded-2xl p-5 mt-8 border-2 border-[#D8B4FE] dark:border-[#7E22CE]"
              >
                <p
                  class="text-center text-[#7E22CE] dark:text-[#D8B4FE] font-black text-sm flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                  <Icon name="mdi:sparkles" class="w-5 h-5" />
                  {{ $t('landing.onboarding.trialHintToken', 'You’ll get 25,000 AI tokens for free!') }}
                </p>
              </div>
            </div>
          </Transition>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { zxcvbn } from '@zxcvbn-ts/core'

const open = defineModel<boolean>()
const toast = useToast()

const step = shallowRef(1)
const loading = shallowRef(false)
const userEditedDomain = shallowRef(false)

const form = reactive({
  siteName: '',
  domain: '',
  domainType: 'SUBDOMAIN',
  language: 'en',
  theme: 'blue',
  focus: '',
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
})

watch(
  () => form.siteName,
  (newName) => {
    if (form.domainType === 'SUBDOMAIN' && !userEditedDomain.value) {
      form.domain = newName ? slugify(newName, { lower: true, strict: true }) : ''
    }
  },
)

watch(
  () => form.domainType,
  (newType) => {
    if (newType === 'SUBDOMAIN') {
      userEditedDomain.value = false
      form.domain = form.siteName ? slugify(form.siteName, { lower: true, strict: true }) : ''
    } else {
      form.domain = ''
    }
  },
)

const handleSubmit = () => {
  if (step.value < 3) {
    if (step.value === 1) {
      if (!form.siteName || !form.domain) return
    } else if (step.value === 2) {
      if (!form.focus) return
    }
    step.value++
  } else {
    submit()
  }
}

const submit = async () => {
  if (!form.username || !form.email || !form.password || form.password !== form.passwordConfirm) {
    toast.error({ message: $t('common.auth.passwordsMismatch', 'Passwords do not match') })
    return
  }
  if (zxcvbn(form.password).score < 3) {
    toast.error({ message: $t('common.passwordSuggestions.weak', 'Weak password') })
    return
  }

  loading.value = true
  try {
    const res = await $fetch('/api/onboarding/checkout', {
      method: 'POST',
      body: form,
    })

    if (res.url) {
      window.location.href = res.url
    }
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.errors.general', 'Something went wrong') })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.animate-fade-in-up {
  animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
</style>
