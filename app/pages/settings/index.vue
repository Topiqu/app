<template>
  <main class="w-full max-w-5xl mx-auto mt-6 sm:mt-10 px-4 sm:px-6 pb-28 flex flex-col gap-6">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        {{ $t('common.preferences.title') }}
      </h1>

      <LazyClientHint v-if="!isBasic" v-slot="{ open: clientHintOpen }" hydrateOnInteraction>
        <Button
          square
          borderless
          size="sm"
          variant="neutral"
          icon="mdi:information-outline"
          :aria="$t('common.preferences.explanation')"
          :title="$t('common.preferences.explanation')"
          @click="clientHintOpen.value = true"
        />
      </LazyClientHint>
    </header>

    <div class="flex flex-col md:flex-row gap-6 md:gap-10">
      <SettingsNav v-model="activeTab" :tabs="tabs" />

      <div class="flex-1 min-w-0 space-y-8">
        <section v-show="activeTab === 'branding'">
          <LazyFormClientBranding
            :logoUrl="form.logoUrl"
            :description="form.description"
            :socials="form.socials"
            :name="client?.name ?? ''"
            :domain="client?.domain ?? ''"
            :currentTheme="form.theme"
            @update:logoUrl="((form.logoUrl = $event.url), (form.optimizedUrl = $event.optimizedUrl))"
            @update:description="form.description = $event"
            @update:socials="form.socials = $event"
            @update:currentTheme="form.theme = $event as typeof form.theme"
          />
        </section>

        <section v-if="!isBasic" v-show="activeTab === 'content'">
          <LazyFormClientContent
            :plan="client?.plan ?? 'BASIC'"
            :focus="form.focus"
            :audience="form.audience"
            :language="form.language"
            :keywords="form.keywords"
            @update:focus="form.focus = $event"
            @update:audience="form.audience = $event"
            @update:language="form.language = $event as typeof form.language"
            @update:keywords="form.keywords = $event"
          />
        </section>

        <div v-if="!isBasic" v-show="activeTab === 'integrations'" class="space-y-8">
          <section>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:google-analytics" class="w-5 h-5 text-orange-500" />
              {{ $t('common.preferences.external') }}
            </h3>

            <div
              class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm space-y-6"
            >
              <label class="flex items-center justify-between gap-4 cursor-pointer">
                <span class="font-medium">Google Analytics</span>
                <FormField
                  v-model="form.allowGtag"
                  type="checkbox"
                  aria-label="Enable Google Analytics"
                  class="w-auto"
                />
              </label>
              <Transition name="fade">
                <FormField
                  v-if="form.allowGtag"
                  v-model="form.gtagId"
                  label="Measurement ID"
                  placeholder="G-XXXXXXXXXX"
                  icon="mdi:tag-outline"
                />
              </Transition>

              <div v-if="isSuperadmin" class="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <label class="flex items-center justify-between gap-4 mb-3 cursor-pointer">
                  <span class="font-medium">Google Ads</span>
                  <FormField v-model="form.allowAds" type="checkbox" aria-label="Enable Google Ads" class="w-auto" />
                </label>
                <Transition name="fade">
                  <FormField
                    v-if="form.allowAds"
                    v-model="form.gamNetworkCode"
                    label="Network Code"
                    placeholder="XXXXXXXXXX"
                    icon="mdi:code-tags"
                  />
                </Transition>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="mdi:key-chain-variant" class="w-5 h-5 text-purple-500" />
              {{ $t('common.preferences.api.title') }}
            </h3>

            <div
              class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm"
            >
              <div v-if="!form.apiKey" class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-sm text-neutral-600 dark:text-neutral-400">
                  {{ $t('common.preferences.api.description') }}
                </div>
                <Button variant="neutral" class="shrink-0" @click="generateApiKey">
                  <Icon name="mdi:plus" class="mr-1.5 size-4" />
                  {{ $t('common.preferences.api.generate') }}
                </Button>
              </div>

              <div v-else class="space-y-3">
                <FormLabel
                  :text="$t('common.preferences.api.label')"
                  class="text-xs font-bold uppercase tracking-wider text-neutral-500"
                />

                <div class="relative">
                  <FormInput
                    :modelValue="form.apiKey"
                    :type="apiVisible ? 'text' : 'password'"
                    readonly
                    :inputClass="'font-mono pr-20!'"
                  />

                  <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      square
                      borderless
                      size="sm"
                      variant="neutral"
                      :icon="apiVisible ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
                      :aria="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                      :title="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                      @click="apiVisible = !apiVisible"
                    />
                    <Button
                      square
                      borderless
                      size="sm"
                      variant="neutral"
                      :icon="apiCopied ? 'mdi:check' : 'mdi:content-copy'"
                      :aria="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                      :title="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                      @click="copyApi(form.apiKey)"
                    />
                  </div>
                </div>

                <div class="flex items-start gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                  <Icon name="mdi:shield-alert-outline" class="size-4 shrink-0 mt-0.5" />
                  <p>{{ $t('common.preferences.api.warning') }}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <LazyFormClientLinkedIn
              :clientSiteId="client?.id ?? ''"
              :mode="form.linkedinMode"
              :type="form.linkedinCompanyType"
              :brandProfile="form.linkedinBrandProfile"
              @update:mode="form.linkedinMode = $event"
              @update:type="form.linkedinCompanyType = $event"
              @update:brandProfile="form.linkedinBrandProfile = $event"
            />
          </section>
        </div>

        <section v-if="hasAi" v-show="activeTab === 'ai'">
          <div
            class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm"
          >
            <LazyFormClientAI
              :username="form.aiUser.username"
              :bio="form.aiUser.bio"
              :avatarUrl="form.aiUser.avatarUrl"
              :aiToneOfVoice="form.aiToneOfVoice"
              :aiControversyLevel="form.aiControversyLevel"
              :aiEnabled="activeFeatures.includes('AI')"
              :sentimentEnabled="activeFeatures.includes('SENTIMENT')"
              :articleCronsEnabled="activeFeatures.includes('ARTICLE_CRONS')"
              :canEnableAi="allowedFeatures.AI ?? false"
              :canEnableSentiment="allowedFeatures.SENTIMENT ?? false"
              :canEnableArticleCrons="allowedFeatures.ARTICLE_CRONS ?? false"
              :autoRelease="form.autoRelease"
              :language="form.language"
              :translationMode="form.translationMode"
              :translationLanguages="form.translationLanguages"
              :discloseAiContent="form.discloseAiContent"
              :features="features ?? []"
              :currency="client?.currency ?? 'EUR'"
              :plan="client?.plan ?? 'BASIC'"
              :billingPlan="client?.billingPlan ?? 'MONTHLY'"
              @toggle:feature="toggleFeature"
              @update:username="form.aiUser.username = $event"
              @update:bio="form.aiUser.bio = $event"
              @update:aiToneOfVoice="form.aiToneOfVoice = $event ?? ''"
              @update:aiControversyLevel="form.aiControversyLevel = $event ?? ''"
              @update:avatarUrl="
                ((form.aiUser.avatarUrl = $event.avatarUrl),
                (form.aiUser.optimizedAvatarUrl = $event.optimizedImageUrl))
              "
              @update:autoRelease="form.autoRelease = $event"
              @update:translationMode="form.translationMode = $event"
              @update:translationLanguages="form.translationLanguages = $event"
              @update:discloseAiContent="form.discloseAiContent = $event"
            />
          </div>
        </section>

        <section v-if="showBilling" v-show="activeTab === 'billing'">
          <FormClientBilling :client="client ?? null" :rate="rate" />
        </section>
      </div>
    </div>

    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-header flex justify-center px-4 sm:px-6">
      <div class="w-full max-w-5xl flex justify-center sm:justify-end">
        <Transition
          enterActiveClass="transition duration-200 ease-out"
          enterFromClass="opacity-0 translate-y-2"
          enterToClass="opacity-100 translate-y-0"
          leaveActiveClass="transition duration-150 ease-in"
          leaveFromClass="opacity-100 translate-y-0"
          leaveToClass="opacity-0 translate-y-2"
        >
          <div
            v-if="isDirty"
            class="pointer-events-auto flex items-center gap-3 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur py-2 pl-4 pr-2 shadow-xl mr-14 sm:mr-16 xl:mr-0"
          >
            <span class="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span class="size-2 rounded-full bg-amber-500 animate-pulse" />
              {{ $t('common.preferences.unsaved') }}
            </span>
            <div class="flex items-center gap-1.5">
              <Button size="sm" variant="transparent" @click="resetForm">
                {{ $t('common.actions.reset') }}
              </Button>
              <Button size="sm" @click="savePreferences">
                {{ $t('common.actions.saveChanges') }}
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <ModalMini ref="discardDialog" />
  </main>
</template>

<script setup lang="ts">
import equal from 'fast-deep-equal'

import type { SettingsTab } from '~/components/Settings/Nav.vue'

import { buildClientSettingsForm, type ClientSite } from '~/utils/buildClientSettingsForm'

definePageMeta({ middleware: 'admin' })

const toast = useToast()
const { data: auth } = useAuth()
const route = useRoute()
const router = useRouter()
const { copy: copyApi, copied: apiCopied } = useClipboard({ legacy: true })
const discardDialog = useTemplateRef<ModalMiniRef>('discardDialog')
const apiVisible = shallowRef(false)

const clientId = computed(() => auth.value?.user.clientSiteId)
const isSuperadmin = computed(() => auth.value?.user.role === 'superadmin')

const { data: client, refresh } = await useFetch<ClientSite>(`/api/clients/${auth.value?.user.clientSiteId}`)
const { data: features } = await useFetch(`/api/features`)
const rate = await useCurrencyRate(client.value?.currency ?? 'EUR')

const form = ref(buildClientSettingsForm(client.value))
const pristine = ref(buildClientSettingsForm(client.value))
const isDirty = computed(() => !equal(form.value, pristine.value))

useSeoMeta({ title: () => `${client.value?.name ?? ''} — ${$t('common.preferences.title')}` })

const activeFeatures = computed(() => client.value?.activeFeatures ?? [])
const allowedFeatures = computed(
  () => client.value?.allowedFeatures ?? { AI: false, SENTIMENT: false, ARTICLE_CRONS: false },
)

const isBasic = computed(() => client.value?.plan === 'BASIC')
const hasAi = computed(() => !isBasic.value && (client.value?.tokenLimit ?? 0) > 0)
const showBilling = computed(() => client.value?.billingPlan !== 'PERMANENT')

const tabs = computed<SettingsTab[]>(() => {
  const t: SettingsTab[] = [
    { id: 'branding', labelKey: 'common.preferences.tabs.branding', icon: 'mdi:palette-outline' },
  ]
  if (!isBasic.value) {
    t.push({ id: 'content', labelKey: 'common.preferences.tabs.content', icon: 'mdi:text-box-outline' })
    t.push({ id: 'integrations', labelKey: 'common.preferences.tabs.integrations', icon: 'mdi:puzzle-outline' })
  }
  if (hasAi.value) t.push({ id: 'ai', labelKey: 'common.preferences.tabs.ai', icon: 'mdi:robot-outline' })
  if (showBilling.value)
    t.push({ id: 'billing', labelKey: 'common.preferences.tabs.billing', icon: 'mdi:credit-card-outline' })
  return t
})

const activeTab = computed<string>({
  get() {
    const q = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
    return tabs.value.some((t) => t.id === q) ? (q as string) : (tabs.value[0]?.id ?? 'branding')
  },
  set(v) {
    router.replace({ query: { ...route.query, tab: v } })
  },
})

const toggleFeature = async ({ code, enabled }: { code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }) => {
  if (!client.value?.id) return
  try {
    const res = await $fetch<{ activeFeatures: string[]; monthlyPayment: number; annualPayment: number }>(
      `/api/clients/${client.value.id}/features`,
      { method: 'PATCH', body: { code, enabled } },
    )
    client.value = {
      ...client.value,
      activeFeatures: res.activeFeatures,
      monthlyPayment: res.monthlyPayment,
      annualPayment: res.annualPayment,
    }
    toast.success({ message: enabled ? $t('common.messages.saveSuccess') : $t('common.messages.featureDisabled') })
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
    await refresh()
  }
}

const savePreferences = async () => {
  if (!clientId.value) return toast.error({ message: $t('common.preferences.messages.noClientId') })
  try {
    await $fetch(`/api/clients/${clientId.value}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...form.value,
        logoUrl: form.value.optimizedUrl || form.value.logoUrl,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: client.value?.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
      },
    })
    toast.success({ message: $t('common.messages.successGeneralTitle') })
    await refresh()
    form.value = buildClientSettingsForm(client.value)
    pristine.value = buildClientSettingsForm(client.value)
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
  }
}

const resetForm = async () => {
  const r = await discardDialog.value?.ask({
    title: $t('common.messages.discardChangesTitle'),
    message: $t('common.messages.discardChangesText'),
    icon: 'mdi:backup-restore',
    confirmText: $t('common.messages.discardConfirm'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (r !== 'ok') return
  form.value = structuredClone(toRaw(pristine.value))
}

const generateApiKey = async () => {
  if (!clientId.value) return
  try {
    const res = await $fetch<{ apiKey: string }>(`/api/clients/${clientId.value}/api-key`, { method: 'POST' })
    form.value.apiKey = res.apiKey
    pristine.value.apiKey = res.apiKey
    toast.success({ message: 'API Key successfully generated' })
  } catch {
    toast.error({ message: 'Failed to generate API Key' })
  }
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value) return true
  const r = await discardDialog.value?.ask({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('common.messages.closeConfirmText'),
    icon: 'mdi:alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  return r === 'ok'
})
</script>
