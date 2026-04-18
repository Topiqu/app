<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="open = false"></div>

    <div
      class="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-800"
    >
      <div class="p-6 md:p-10">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Icon name="mdi:rocket-launch" class="text-indigo-500" />
            {{ $t('landing.onboarding.title', 'Vytvořte si vlastní blog') }}
          </h2>
          <Button
            @click="open = false"
            style="
              background: transparent !important;
              border: none !important;
              padding: 0 !important;
              box-shadow: none !important;
              color: currentColor !important;
            "
            class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
          >
            <Icon name="mdi:close" size="24" />
          </Button>
        </div>

        <div class="flex gap-3 mb-8 px-2">
          <div
            v-for="s in 3"
            :key="s"
            class="h-1.5 flex-1 rounded-full transition-all duration-500 ease-in-out relative overflow-hidden"
            :class="step >= s ? 'bg-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800'"
          >
            <div
              class="absolute inset-y-0 left-0 bg-indigo-500 rounded-full transition-all duration-500 ease-in-out"
              :style="{ width: step >= s ? (step > s ? '100%' : '50%') : '0%' }"
            ></div>
          </div>
        </div>

        <form @submit.prevent="step < 3 ? nextStep() : submit()">
          <!-- Step 1: Site Info -->
          <div v-if="step === 1" class="space-y-6 animate-fade-in">
            <div class="space-y-2">
              <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                {{ $t('landing.onboarding.siteInfo', 'Informace o webu') }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{
                  $t(
                    'landing.onboarding.siteInfoDesc',
                    'Začněme tím nejdůležitějším – jak se bude váš projekt jmenovat a kde ho najdeme.',
                  )
                }}
              </p>
            </div>

            <div
              class="space-y-6 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50"
            >
              <FormField
                v-model="form.siteName"
                required
                icon="mdi:web"
                :label="$t('landing.onboarding.siteName', 'Název webu')"
                :placeholder="$t('landing.onboarding.siteNamePlaceholder', 'Můj skvělý blog')"
                inputClass="w-full !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 focus:!ring-indigo-500/50 transition-shadow hover:shadow-sm"
              />

              <div class="space-y-3">
                <FormLabel :text="$t('landing.onboarding.domainType', 'Typ domény')" />
                <div class="grid grid-cols-2 gap-3">
                  <label
                    class="relative flex flex-col items-center justify-center p-4 cursor-pointer rounded-xl border-2 transition-all"
                    :class="
                      form.domainType === 'SUBDOMAIN'
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                    "
                  >
                    <input type="radio" v-model="form.domainType" value="SUBDOMAIN" class="sr-only" />
                    <Icon
                      name="mdi:subdomain"
                      size="24"
                      class="mb-2"
                      :class="form.domainType === 'SUBDOMAIN' ? 'text-indigo-500' : 'text-slate-400'"
                    />
                    <span class="text-sm font-semibold text-center leading-tight"
                      >{{ $t('landing.onboarding.subdomain', 'Subdoména') }}<br /><span
                        class="text-xs font-normal opacity-75"
                        >.topiqu.com</span
                      ></span
                    >
                  </label>
                  <label
                    class="relative flex flex-col items-center justify-center p-4 cursor-pointer rounded-xl border-2 transition-all"
                    :class="
                      form.domainType === 'CUSTOM'
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                    "
                  >
                    <input type="radio" v-model="form.domainType" value="CUSTOM" class="sr-only" />
                    <Icon
                      name="mdi:earth"
                      size="24"
                      class="mb-2"
                      :class="form.domainType === 'CUSTOM' ? 'text-indigo-500' : 'text-slate-400'"
                    />
                    <span class="text-sm font-semibold text-center leading-tight"
                      >{{ $t('landing.onboarding.customDomain', 'Vlastní doména') }}<br /><span
                        class="text-xs font-normal opacity-75"
                        >{{ $t('landing.onboarding.customDomainExample', 'vlastni.cz') }}</span
                      ></span
                    >
                  </label>
                </div>
              </div>

              <div class="animate-fade-in">
                <FormLabel
                  :text="
                    form.domainType === 'SUBDOMAIN'
                      ? $t('landing.onboarding.subdomain', 'Subdoména')
                      : $t('landing.onboarding.customDomain', 'Vlastní doména')
                  "
                />
                <div class="flex items-stretch group">
                  <FormField
                    v-model="form.domain"
                    @input="userEditedDomain = true"
                    required
                    icon="mdi:link"
                    :placeholder="
                      form.domainType === 'SUBDOMAIN'
                        ? $t('landing.onboarding.domainPlaceholder', 'my-awesome-site')
                        : 'blog.mycompany.com'
                    "
                    inputClass="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 shadow-sm w-full focus:!ring-indigo-500/50 transition-all"
                    class="w-full"
                    :class="{ 'rounded-r-none border-r-0 focus:z-20': form.domainType === 'SUBDOMAIN' }"
                  />
                  <div
                    v-if="form.domainType === 'SUBDOMAIN'"
                    class="flex items-center px-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-xl -ml-px text-slate-500 dark:text-slate-400 font-mono text-sm whitespace-nowrap z-10 group-focus-within:border-indigo-500/50 transition-colors"
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
              class="w-full mt-8 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300"
              icon="mdi:arrow-right"
              iconPosition="right"
            >
              {{ $t('common.actions.continue') }}
            </Button>
          </div>

          <!-- Step 2: Personalization -->
          <div v-if="step === 2" class="space-y-6 animate-fade-in">
            <div class="space-y-2">
              <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                {{ $t('landing.onboarding.designFocus', 'Design & Zaměření') }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{
                  $t(
                    'landing.onboarding.designFocusDesc',
                    'Přizpůsobte si platformu svému brandu a definujte hlavní téma.',
                  )
                }}
              </p>
            </div>

            <div
              class="space-y-6 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50"
            >
              <div class="space-y-6">
                <div>
                  <FormLabel :text="$t('landing.onboarding.mainLanguage', 'Hlavní jazyk obsahu')" />
                  <div class="grid grid-cols-2 gap-3">
                    <label
                      class="relative flex items-center p-3 cursor-pointer rounded-xl border-2 transition-all"
                      :class="
                        form.language === 'cs'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      "
                    >
                      <input type="radio" v-model="form.language" value="cs" class="sr-only" />
                      <span class="text-2xl mr-3">🇨🇿</span>
                      <span class="font-medium text-slate-700 dark:text-slate-200">{{
                        $t('landing.onboarding.langCz', 'Čeština')
                      }}</span>
                    </label>
                    <label
                      class="relative flex items-center p-3 cursor-pointer rounded-xl border-2 transition-all"
                      :class="
                        form.language === 'en'
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      "
                    >
                      <input type="radio" v-model="form.language" value="en" class="sr-only" />
                      <span class="text-2xl mr-3">🇬🇧</span>
                      <span class="font-medium text-slate-700 dark:text-slate-200">{{
                        $t('landing.onboarding.langEn', 'English')
                      }}</span>
                    </label>
                  </div>
                </div>

                <div>
                  <FormLabel :text="$t('landing.onboarding.mainColor', 'Hlavní barva brandu')" />
                  <div class="flex flex-wrap gap-3">
                    <label
                      v-for="color in ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'green', 'teal']"
                      :key="color"
                      class="relative cursor-pointer group"
                    >
                      <input type="radio" v-model="form.theme" :value="color" class="sr-only" />
                      <div
                        class="w-10 h-10 rounded-full border-2 transition-all duration-300"
                        :class="[
                          `bg-${color}-500`,
                          form.theme === color
                            ? 'border-white dark:border-slate-900 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-indigo-500 scale-110 shadow-md'
                            : 'border-transparent hover:scale-110',
                        ]"
                      ></div>
                    </label>
                  </div>
                </div>

                <FormField
                  v-model="form.focus"
                  icon="mdi:target"
                  :label="$t('landing.onboarding.siteFocus', 'Hlavní zaměření webu (volitelné)')"
                  :placeholder="
                    $t('landing.onboarding.siteFocusPlaceholder', 'např. Technologie, Životní styl, Firemní blog...')
                  "
                  inputClass="!bg-white w-full dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 focus:!ring-indigo-500/50"
                />
              </div>
            </div>

            <div class="flex gap-4 mt-8">
              <Button
                type="button"
                variant="neutral"
                size="lg"
                class="w-1/3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                @click="step = 1"
              >
                {{ $t('common.actions.back', 'Zpět') }}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                class="w-2/3 shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300"
                icon="mdi:arrow-right"
                iconPosition="right"
              >
                {{ $t('landing.onboarding.continueToAccount', 'Pokračovat k účtu') }}
              </Button>
            </div>
          </div>

          <!-- Step 3: User Info -->
          <div v-if="step === 3" class="space-y-6 animate-fade-in">
            <div class="space-y-2">
              <h3 class="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                {{ $t('landing.onboarding.adminInfo', 'Účet správce') }}
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{
                  $t(
                    'landing.onboarding.adminInfoDesc',
                    'Už jsme skoro u konce. Vytvořte si přístupové údaje do administrace.',
                  )
                }}
              </p>
            </div>

            <div
              class="space-y-5 bg-slate-50/50 dark:bg-slate-800/20 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50"
            >
              <FormField
                v-model="form.username"
                required
                icon="mdi:account"
                :label="$t('common.labels.username', 'Uživatelské jméno')"
                :placeholder="$t('landing.onboarding.usernamePlaceholder', 'admin')"
                inputClass="w-full !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 focus:!ring-indigo-500/50 transition-shadow hover:shadow-sm"
              />

              <FormField
                v-model="form.email"
                required
                type="email"
                icon="mdi:email"
                :label="$t('common.labels.email', 'Email')"
                :placeholder="$t('landing.onboarding.emailPlaceholder', 'admin@example.com')"
                inputClass="w-full !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 focus:!ring-indigo-500/50 transition-shadow hover:shadow-sm"
              />

              <FormField
                v-model="form.password"
                required
                type="password"
                icon="mdi:lock"
                :label="$t('common.labels.password', 'Heslo')"
                placeholder="••••••••"
                inputClass="w-full !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 focus:!ring-indigo-500/50 transition-shadow hover:shadow-sm"
              />
            </div>

            <div class="flex gap-4 mt-8">
              <Button
                type="button"
                variant="neutral"
                size="lg"
                class="w-1/3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                @click="step = 2"
              >
                {{ $t('common.actions.back', 'Zpět') }}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                class="w-2/3 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300"
                :loading="loading"
                icon="mdi:rocket-launch"
              >
                {{ $t('landing.onboarding.startTrial', 'Začít s plným přístupem') }}
              </Button>
            </div>
            <div
              class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-xl p-4 mt-6 border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm"
            >
              <p
                class="text-center text-sm text-indigo-800 dark:text-indigo-300 font-medium flex items-center justify-center gap-2"
              >
                <Icon name="mdi:sparkles" class="text-amber-500 animate-pulse" />
                <span>{{ $t('landing.onboarding.trialHintToken', 'Získáte rovnou 25 000 AI tokenů zdarma!') }}</span>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import slugify from 'slugify'

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
})

// Generate subdomain from siteName automatically if user hasn't typed their own
watchEffect(() => {
  if (form.domainType === 'SUBDOMAIN' && !userEditedDomain.value && form.siteName) {
    form.domain = slugify(form.siteName, { lower: true, strict: true })
  } else if (!form.siteName && !userEditedDomain.value) {
    form.domain = ''
  }
})

const nextStep = () => {
  if (step.value < 3) step.value++
}

const submit = async () => {
  if (!form.username || !form.email || !form.password) return

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
    toast.error({ message: error.data?.message || 'Nastala chyba' })
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
