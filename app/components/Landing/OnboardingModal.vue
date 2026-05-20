<template>
  <div
    v-if="open"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    @click.self="open = false"
  >
    <div class="absolute inset-0 bg-[#EBE9E4] dark:bg-[#0C0C0C] transition-opacity" @click="open = false"></div>

    <div
      ref="panelRef"
      tabindex="-1"
      class="relative bg-[#FAFAFA] dark:bg-[#18181B] rounded-[2.5rem] w-full max-w-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto focus:outline-none"
    >
      <div class="p-8 md:p-12">
        <div class="flex justify-between items-start mb-8 gap-6">
          <h2
            id="onboarding-title"
            class="text-3xl md:text-4xl font-black text-[#111] dark:text-white tracking-tighter leading-tight flex items-center gap-5"
          >
            <div
              class="w-14 h-14 bg-[#D8B4FE] text-[#111] rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0_0_rgba(17,17,17,1)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,1)] transform -rotate-3 transition-transform hover:rotate-0"
            >
              <Icon name="mdi:rocket-launch" class="w-7 h-7" />
            </div>
            {{ $t('landing.onboarding.title') }}
          </h2>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-xs font-black uppercase tracking-widest text-[#888] dark:text-[#71717A] whitespace-nowrap">
              {{ $t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS }) }}
            </span>
            <Button
              square
              borderless
              size="sm"
              variant="transparent"
              icon="mdi:close"
              :aria="$t('common.actions.close')"
              :title="$t('common.actions.close')"
              class="text-[#888] hover:text-[#111] dark:hover:text-white"
              @click="open = false"
            />
          </div>
        </div>

        <div
          class="flex gap-2 mb-12"
          role="progressbar"
          :aria-valuenow="step"
          :aria-valuemin="1"
          :aria-valuemax="TOTAL_STEPS"
          :aria-label="$t('landing.onboarding.stepLabel', { current: step, total: TOTAL_STEPS })"
        >
          <div
            v-for="s in TOTAL_STEPS"
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
                  <div class="grid grid-cols-2 gap-4" role="radiogroup" :aria-label="$t('landing.onboarding.domainType')">
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
                        {{ $t('landing.onboarding.subdomain') }}
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
                        {{ $t('landing.onboarding.customDomain') }}
                      </span>
                      <span class="text-sm font-bold opacity-70 block mt-1 text-current">{{
                        $t('landing.onboarding.customDomainExample')
                      }}</span>
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
                    <Icon :name="domainStatusIcon" class="w-4 h-4 shrink-0" :class="{ 'animate-spin': domainStatus === 'checking' }" />
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

            <div v-else-if="step === 2" :key="'step2'" class="space-y-8">
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
                  <div class="grid grid-cols-2 gap-4" role="radiogroup" :aria-label="$t('landing.onboarding.mainLanguage')">
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
                      <span class="font-black text-lg text-current">{{ $t('landing.onboarding.langCz') }}</span>
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
                      <span class="font-black text-lg text-current">{{ $t('landing.onboarding.langEn') }}</span>
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
                  @click="step = 1"
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

            <div v-else-if="step === 3" :key="'step3'" class="space-y-8">
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
                  @click="step = 2"
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
                  <span class="font-black tracking-wide">{{ $t('landing.onboarding.continueToSummary') }}</span>
                </Button>
              </div>
            </div>

            <div v-else-if="step === 4" :key="'step4'" class="space-y-8">
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
                  @click="step = 3"
                >
                  {{ $t('common.actions.back') }}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  :loading="loading"
                  :disabled="!form.acceptTos || loading"
                  class="w-2/3 bg-[#67E8F9] hover:bg-[#22D3EE] text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#06B6D4] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0"
                >
                  <div class="flex items-center justify-center gap-3">
                    <Icon name="mdi:rocket-launch" class="w-6 h-6" />
                    <span class="font-black tracking-wide">{{ $t('landing.onboarding.createAccount') }}</span>
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
          </Transition>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'
import { zxcvbn } from '@zxcvbn-ts/core'

const TOTAL_STEPS = 4

const open = defineModel<boolean>()
const toast = useToast()
const { t: $t } = useI18n()
const localePath = useLocalePath()

const step = shallowRef(1)
const loading = shallowRef(false)
const userEditedDomain = shallowRef(false)
const panelRef = useTemplateRef<HTMLElement>('panelRef')

const isLocked = useScrollLock(import.meta.client ? document.body : null)
watch(open, (v) => {
  isLocked.value = !!v
})

onKeyStroke('Escape', () => {
  if (open.value) open.value = false
})

watch([open, step], async ([isOpen]) => {
  if (!isOpen) return
  await nextTick()
  const firstInput = panelRef.value?.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea, select, [contenteditable="true"]',
  )
  firstInput?.focus()
})

type DomainStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'tooShort' | 'reserved' | 'empty'
const domainStatus = shallowRef<DomainStatus>('idle')

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
  acceptTos: false,
})

const fullDomainPreview = computed(() =>
  form.domainType === 'SUBDOMAIN' ? `${form.domain}.topiqu.com` : form.domain,
)

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

const runDomainCheck = useDebounceFn(async (domain: string, type: string) => {
  if (form.domain !== domain || form.domainType !== type) return
  if (!domain) {
    domainStatus.value = 'idle'
    return
  }
  try {
    const res = await $fetch<{ ok: boolean; reason?: DomainStatus }>('/api/onboarding/check-domain', {
      query: { domain, type },
    })
    if (form.domain !== domain || form.domainType !== type) return
    domainStatus.value = res.ok ? 'available' : (res.reason as DomainStatus) ?? 'invalid'
  } catch {
    domainStatus.value = 'idle'
  }
}, 350)

watch(
  () => [form.domain, form.domainType] as const,
  ([d, type]) => {
    if (!d) {
      domainStatus.value = 'idle'
      return
    }
    domainStatus.value = 'checking'
    runDomainCheck(d, type)
  },
  { immediate: false },
)

const domainStatusIcon = computed(() => {
  switch (domainStatus.value) {
    case 'checking':
      return 'mdi:loading'
    case 'available':
      return 'mdi:check-circle'
    default:
      return 'mdi:alert-circle'
  }
})

const domainStatusColor = computed(() => {
  switch (domainStatus.value) {
    case 'available':
      return 'text-[#16A34A] dark:text-[#86EFAC]'
    case 'checking':
      return 'text-[#888] dark:text-[#71717A]'
    default:
      return 'text-[#DC2626] dark:text-[#FCA5A5]'
  }
})

const summaryRows = computed(() => [
  { label: $t('landing.onboarding.summarySite'), value: form.siteName, icon: 'mdi:web' },
  { label: $t('landing.onboarding.summaryDomain'), value: fullDomainPreview.value, icon: 'mdi:link' },
  {
    label: $t('landing.onboarding.summaryLanguage'),
    value: form.language === 'cs' ? `🇨🇿 ${$t('landing.onboarding.langCz')}` : `🇬🇧 ${$t('landing.onboarding.langEn')}`,
    icon: 'mdi:translate',
  },
  {
    label: $t('landing.onboarding.summaryColor'),
    value: form.theme,
    icon: 'mdi:palette',
    swatch: form.theme,
  },
  {
    label: $t('landing.onboarding.summaryFocus'),
    value: form.focus || $t('landing.onboarding.focusNotSet'),
    icon: 'mdi:target',
  },
  { label: $t('landing.onboarding.summaryAdmin'), value: form.username, icon: 'mdi:account' },
  { label: $t('landing.onboarding.summaryEmail'), value: form.email, icon: 'mdi:email' },
])

const canAdvanceStep1 = computed(
  () => !!form.siteName && !!form.domain && domainStatus.value === 'available',
)

const canAdvanceStep3 = computed(
  () =>
    !!form.username &&
    !!form.email &&
    !!form.password &&
    form.password === form.passwordConfirm,
)

const handleSubmit = () => {
  if (step.value === 1) {
    if (!canAdvanceStep1.value) return
    step.value = 2
    return
  }
  if (step.value === 2) {
    step.value = 3
    return
  }
  if (step.value === 3) {
    if (!canAdvanceStep3.value) return
    step.value = 4
    return
  }
  submit()
}

const submit = async () => {
  if (!form.acceptTos) {
    toast.error({ message: $t('landing.onboarding.tosRequired') })
    return
  }
  if (!form.username || !form.email || !form.password || form.password !== form.passwordConfirm) {
    toast.error({ message: $t('common.auth.passwordsMismatch') })
    return
  }
  if (zxcvbn(form.password).score < 3) {
    toast.error({ message: $t('common.passwordSuggestions.weak') })
    return
  }

  loading.value = true
  try {
    const res = await $fetch<{ url?: string }>('/api/onboarding/checkout', {
      method: 'POST',
      body: {
        siteName: form.siteName,
        domain: form.domain,
        domainType: form.domainType,
        language: form.language,
        theme: form.theme,
        focus: form.focus,
        username: form.username,
        email: form.email,
        password: form.password,
      },
    })

    if (res.url) {
      window.location.href = res.url
    }
  } catch (error: any) {
    toast.error({ message: error.data?.message || $t('common.errors.general') })
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
