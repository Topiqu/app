<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-highlighted">
        {{ $t('common.preferences.title') }}
      </h1>

      <LazyClientPreferencesGuide
        hydrateOnInteraction
        :focus="form.focus"
        :audience="form.audience"
        :language="form.language"
        :keywords="form.keywords"
      >
        <UButton
          square
          variant="ghost"
          size="sm"
          color="neutral"
          icon="mdi:information-outline"
          :aria-label="$t('common.preferences.explanation')"
          :title="$t('common.preferences.explanation')"
        />
      </LazyClientPreferencesGuide>
    </header>

    <div class="flex flex-col md:flex-row gap-6 md:gap-10">
      <TabNav v-model="activeTab" :tabs="tabs" :label="$t('common.preferences.title')" />

      <div class="min-w-0 flex-1 space-y-8">
        <section v-show="activeTab === 'branding'">
          <FormClientBranding
            v-model:description="form.description"
            v-model:tagline="form.tagline"
            v-model:typographyPreset="form.typographyPreset"
            v-model:socials="form.socials"
            v-model:currentTheme="form.theme"
            :logoUrl="form.logoUrl"
            :faviconUrl="form.faviconUrl"
            :name="client?.name ?? ''"
            :domain="client?.domain ?? ''"
            @update:logoUrl="((form.logoUrl = $event.url), (form.optimizedUrl = $event.optimizedUrl))"
            @update:faviconUrl="form.faviconUrl = $event.url"
          />
        </section>

        <section v-show="activeTab === 'content'">
          <UAlert
            v-if="isBasic"
            class="mb-5"
            color="primary"
            variant="soft"
            icon="mdi:information-outline"
            :title="$t('common.preferences.softGate.contentTitle')"
            :description="$t('common.preferences.softGate.contentDescription')"
          >
            <template #actions>
              <UButton
                :to="localePath({ name: 'settings', query: { tab: 'billing' } })"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ $t('common.preferences.softGate.action') }}
              </UButton>
            </template>
          </UAlert>
          <LazyFormClientContent
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

        <FormClientIntegrationsCatalog
          v-show="activeTab === 'integrations'"
          :clientSiteId="client?.id ?? ''"
          :apiKey="form.apiKey"
          :apiVisible="apiVisible"
          :apiCopied="apiCopied"
          :allowGtag="form.allowGtag"
          :gtagId="form.gtagId"
          :gamNetworkCode="form.gamNetworkCode"
          :dirty="isDirty"
          :currentPlan="client?.plan ?? 'BASIC'"
          :linkedinMode="form.linkedinMode"
          :linkedinType="form.linkedinCompanyType"
          :linkedinBrandProfile="form.linkedinBrandProfile"
          @update:allowGtag="form.allowGtag = $event"
          @update:gtagId="form.gtagId = $event"
          @update:gamNetworkCode="form.gamNetworkCode = $event"
          @update:linkedinMode="form.linkedinMode = $event"
          @update:linkedinType="form.linkedinCompanyType = $event"
          @update:linkedinBrandProfile="form.linkedinBrandProfile = $event"
          @generateApiKey="generateApiKey"
          @toggleApi="apiVisible = !apiVisible"
          @copyApi="copyApi(form.apiKey)"
          @save="savePreferences"
        />

        <section v-show="activeTab === 'ai'">
          <UAlert
            v-if="isBasic"
            class="mb-5"
            color="primary"
            variant="soft"
            icon="mdi:information-outline"
            :title="$t('common.preferences.softGate.aiTitle')"
            :description="$t('common.preferences.softGate.aiDescription')"
          >
            <template #actions>
              <UButton
                :to="localePath({ name: 'settings', query: { tab: 'billing' } })"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ $t('common.preferences.softGate.action') }}
              </UButton>
            </template>
          </UAlert>
          <LazyFormClientAI
            :clientId="clientId ?? ''"
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
            :generationFrequency="form.generationFrequency"
            :language="form.language"
            :translationMode="form.translationMode"
            :translationLanguages="form.translationLanguages"
            :discloseAiContent="form.discloseAiContent"
            :features="features ?? []"
            :currency="client?.currency ?? 'EUR'"
            :plan="client?.plan ?? 'BASIC'"
            :billingPlan="client?.billingPlan ?? 'MONTHLY'"
            :setupOnly="isBasic"
            @toggle:feature="toggleFeature"
            @update:username="form.aiUser.username = $event"
            @update:bio="form.aiUser.bio = $event"
            @update:aiToneOfVoice="form.aiToneOfVoice = $event ?? ''"
            @update:aiControversyLevel="form.aiControversyLevel = $event ?? ''"
            @update:avatarUrl="((form.aiUser.avatarUrl = $event), (pristine.aiUser.avatarUrl = $event))"
            @update:autoRelease="form.autoRelease = $event"
            @update:generationFrequency="form.generationFrequency = $event"
            @update:translationMode="form.translationMode = $event"
            @update:translationLanguages="form.translationLanguages = $event"
            @update:discloseAiContent="form.discloseAiContent = $event"
          />
        </section>

        <section v-if="showBilling" v-show="activeTab === 'billing'">
          <FormClientBilling :client="client ?? null" :rate="rate" />
        </section>
        <section v-show="activeTab === 'members'"><LazySettingsMembers /></section>
      </div>
    </div>

    <UnsavedBar :dirty="isDirty" :loading="isSaving" @reset="resetForm" @save="savePreferences" />
  </div>
</template>

<script setup lang="ts">
import equal from 'fast-deep-equal'

import type { TabItem } from '~/components/TabNav.vue'

import { buildClientSettingsForm, type ClientSite } from '~/utils/buildClientSettingsForm'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const toast = useToast()
const { data: auth } = useAuth()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { copy: copyApi, copied: apiCopied } = useClipboard({ legacy: true })
const confirm = useConfirm()
const apiVisible = shallowRef(false)
const isSaving = shallowRef(false)

const clientId = computed(() => auth.value?.user.clientSiteId)
const isSuperadmin = computed(() => auth.value?.user.role === 'superadmin')

const { data: client, refresh } = await useFetch<ClientSite>(() => `/api/clients/${clientId.value}`)
const { data: features } = await useFetch(`/api/features`, { watch: [clientId] })
const { data: tenantAccess } = await useFetch<{ role: 'OWNER' | 'MEMBER'; scopes: string[] }>('/api/tenant/access', {
  watch: [clientId],
})
const rate = await useCurrencyRate(client.value?.currency ?? 'EUR')

const form = ref(buildClientSettingsForm(client.value))
const pristine = ref(buildClientSettingsForm(client.value))
const isDirty = computed(() => !equal(form.value, pristine.value))

useSeoMeta({ title: () => `${client.value?.name ?? ''} - ${$t('common.preferences.title')}` })

const activeFeatures = computed(() => client.value?.activeFeatures ?? [])
const allowedFeatures = computed(
  () => client.value?.allowedFeatures ?? { AI: false, SENTIMENT: false, ARTICLE_CRONS: false },
)

const isBasic = computed(() => client.value?.plan === 'BASIC')
const showBilling = computed(() => client.value?.billingPlan !== 'PERMANENT')
const can = (scope: string) =>
  isSuperadmin.value || tenantAccess.value?.role === 'OWNER' || tenantAccess.value?.scopes.includes(scope)

const tabs = computed<TabItem[]>(() => {
  const t: TabItem[] = []
  if (can('TENANT_SETTINGS'))
    t.push({ id: 'branding', labelKey: 'common.preferences.tabs.branding', icon: 'mdi:palette-outline' })
  if (can('TENANT_SETTINGS')) {
    t.push({ id: 'content', labelKey: 'common.preferences.tabs.content', icon: 'mdi:text-box-outline' })
  }
  if (can('INTEGRATION_CONTROL')) {
    t.push({ id: 'integrations', labelKey: 'common.preferences.tabs.integrations', icon: 'mdi:puzzle-outline' })
  }
  if (can('AI_USE')) t.push({ id: 'ai', labelKey: 'common.preferences.tabs.ai', icon: 'mdi:robot-outline' })
  t.push({ id: 'members', labelKey: 'common.preferences.tabs.members', icon: 'mdi:account-group-outline' })
  if (showBilling.value && can('BILLING_CHANGE'))
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
    toast.add({
      color: 'success',
      title: enabled ? $t('common.messages.saveSuccess') : $t('common.messages.featureDisabled'),
    })
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.saveFailed') })
    await refresh()
  }
}

const savePreferences = async () => {
  if (!clientId.value) return toast.add({ color: 'error', title: $t('common.preferences.messages.noClientId') })
  isSaving.value = true
  try {
    await $fetch(`/api/clients/${clientId.value}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...form.value,
        logoUrl: form.value.logoUrl,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: form.value.aiUser,
      },
    })
    toast.add({ color: 'success', title: $t('common.messages.successGeneralTitle') })
    // The publication surface reads the tenant from its own cached entry, which this PATCH just made stale.
    await Promise.all([refresh(), refreshClientSite()])
    form.value = buildClientSettingsForm(client.value)
    pristine.value = buildClientSettingsForm(client.value)
  } catch (e: any) {
    toast.add({ color: 'error', title: $t('common.messages.saveFailed'), description: e?.data?.message })
  } finally {
    isSaving.value = false
  }
}

const resetForm = async () => {
  const confirmed = await confirm({
    title: $t('common.messages.discardChangesTitle'),
    message: $t('common.messages.discardChangesText'),
    icon: 'mdi:backup-restore',
    confirmText: $t('common.messages.discardConfirm'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (!confirmed) return
  form.value = structuredClone(toRaw(pristine.value))
}

const generateApiKey = async () => {
  if (!clientId.value) return
  if (form.value.apiKey) {
    const confirmed = await confirm({
      title: $t('common.preferences.api.regenerateTitle'),
      message: $t('common.preferences.api.regenerateWarning'),
      icon: 'mdi:key-remove',
      confirmText: $t('common.preferences.api.regenerateConfirm'),
      cancelText: $t('common.messages.deleteCancel'),
      variant: 'danger',
    })
    if (!confirmed) return
  }
  try {
    const res = await $fetch<{ apiKey: string }>(`/api/clients/${clientId.value}/api-key`, { method: 'POST' })
    form.value.apiKey = res.apiKey
    pristine.value.apiKey = res.apiKey
    toast.add({ color: 'success', title: $t('common.preferences.api.generateSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('common.preferences.api.generateFailed') })
  }
}
</script>
