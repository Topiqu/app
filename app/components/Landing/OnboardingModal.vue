<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="open = false"></div>

    <div
      class="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-800"
    >
      <div class="p-8">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-3xl font-black text-slate-900 dark:text-white">
            {{ $t('landing.onboarding.title', 'Vytvořte si vlastní blog') }}
          </h2>
          <button @click="open = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <Icon name="mdi:close" size="24" />
          </button>
        </div>

        <div class="flex gap-4 mb-8">
          <div
            v-for="s in 2"
            :key="s"
            class="h-2 flex-1 rounded-full"
            :class="step >= s ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-800'"
          ></div>
        </div>

        <form @submit.prevent="nextStep">
          <!-- Step 1: Site Info -->
          <div v-show="step === 1" class="space-y-6">
            <h3 class="text-xl font-bold text-slate-800 dark:text-slate-200">
              {{ $t('landing.onboarding.siteInfo', 'Informace o webu') }}
            </h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('landing.onboarding.siteName', 'Název webu')
                }}</label>
                <FormInput
                  v-model="form.siteName"
                  required
                  icon="mdi:web"
                  :placeholder="$t('landing.onboarding.siteNamePlaceholder', 'Můj skvělý blog')"
                  inputClass="!bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('landing.onboarding.subdomain', 'Subdoména')
                }}</label>
                <div class="flex items-center gap-2">
                  <FormInput
                    v-model="form.subdomain"
                    required
                    icon="mdi:link"
                    pattern="^[a-z0-9-]+$"
                    :placeholder="$t('landing.onboarding.subdomainPlaceholder', 'muj-blog')"
                    inputClass="!bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800"
                  />
                  <span class="text-slate-500 font-mono text-sm whitespace-nowrap">.topiqu.com</span>
                </div>
                <p class="text-xs text-slate-500 mt-1.5">
                  {{ $t('landing.onboarding.subdomainHint', 'Pouze malá písmena, čísla a pomlčky.') }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('landing.onboarding.language', 'Jazyk webu')
                }}</label>
                <FormSelect
                  v-model="form.language"
                  :items="[
                    { label: 'Čeština', value: 'cs' },
                    { label: 'English', value: 'en' },
                  ]"
                  :showValue="false"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              class="w-full mt-8"
              icon="mdi:arrow-right"
              iconPosition="right"
            >
              {{ $t('common.actions.continue') }}
            </Button>
          </div>

          <!-- Step 2: User Info -->
          <div v-show="step === 2" class="space-y-6">
            <h3 class="text-xl font-bold text-slate-800 dark:text-slate-200">
              {{ $t('landing.onboarding.adminInfo', 'Účet správce') }}
            </h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('common.labels.username', 'Uživatelské jméno')
                }}</label>
                <FormInput
                  v-model="form.username"
                  required
                  icon="mdi:account"
                  placeholder="admin"
                  inputClass="!bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('common.labels.email', 'Email')
                }}</label>
                <FormInput
                  v-model="form.email"
                  required
                  type="email"
                  icon="mdi:email"
                  placeholder="admin@example.com"
                  inputClass="!bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{{
                  $t('common.labels.password', 'Heslo')
                }}</label>
                <FormInput
                  v-model="form.password"
                  required
                  type="password"
                  icon="mdi:lock"
                  placeholder="••••••••"
                  inputClass="!bg-slate-50 dark:!bg-slate-950 !border-slate-200 dark:!border-slate-800"
                />
              </div>
            </div>

            <div class="flex gap-4 mt-8">
              <Button type="button" variant="neutral" size="lg" class="w-1/3" @click="step = 1">
                {{ $t('common.actions.back', 'Zpět') }}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                class="w-2/3"
                :loading="loading"
                @click="submit"
                icon="mdi:credit-card-outline"
              >
                {{ $t('landing.onboarding.startTrial', 'Začít 14-denní Trial') }}
              </Button>
            </div>
            <p class="text-center text-xs text-slate-500 mt-4">
              {{ $t('landing.onboarding.trialHint', 'Budete přesměrováni na Stripe. Získáte 25 000 tokenů zdarma.') }}
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const open = defineModel<boolean>()
const toast = useToast()

const step = shallowRef(1)
const loading = shallowRef(false)

const form = reactive({
  siteName: '',
  subdomain: '',
  language: 'cs',
  username: '',
  email: '',
  password: '',
})

const nextStep = () => {
  step.value = 2
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
</style>
