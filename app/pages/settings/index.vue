<template>
  <main class="w-full max-w-5xl mx-auto pt-24 sm:pt-28 px-4 sm:px-6 pb-28 flex flex-col gap-6">
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

        <FormClientIntegrationsCatalog
          v-if="!isBasic"
          v-show="activeTab === 'integrations'"
          :clientSiteId="client?.id ?? ''"
          :apiKey="form.apiKey"
          :apiVisible="apiVisible"
          :apiCopied="apiCopied"
          :allowGtag="form.allowGtag"
          :gtagId="form.gtagId"
          :isSuperadmin="isSuperadmin"
          :allowAds="form.allowAds"
          :gamNetworkCode="form.gamNetworkCode"
          :dirty="isDirty"
          :linkedinMode="form.linkedinMode"
          :linkedinType="form.linkedinCompanyType"
          :linkedinBrandProfile="form.linkedinBrandProfile"
          @update:allowGtag="form.allowGtag = $event"
          @update:gtagId="form.gtagId = $event"
          @update:allowAds="form.allowAds = $event"
          @update:gamNetworkCode="form.gamNetworkCode = $event"
          @update:linkedinMode="form.linkedinMode = $event"
          @update:linkedinType="form.linkedinCompanyType = $event"
          @update:linkedinBrandProfile="form.linkedinBrandProfile = $event"
          @generateApiKey="generateApiKey"
          @toggleApi="apiVisible = !apiVisible"
          @copyApi="copyApi(form.apiKey)"
          @save="savePreferences"
        />

        <section v-if="hasAi" v-show="activeTab === 'ai'">
          <div
            class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 shadow-sm"
          >
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
              @update:avatarUrl="((form.aiUser.avatarUrl = $event), (pristine.aiUser.avatarUrl = $event))"
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
        <section v-show="activeTab === 'members'"><LazySettingsMembers /></section>
      </div>
    </div>

    <Teleport to="body">
      <div class="pointer-events-none fixed inset-x-0 bottom-4 z-header flex justify-center px-4 sm:px-6">
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
            class="pointer-events-auto flex items-center gap-3 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur py-2 pl-4 pr-2 shadow-xl"
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
    </Teleport>

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
const { data: tenantAccess } = await useFetch<{ role: 'OWNER' | 'MEMBER'; scopes: string[] }>('/api/tenant/access')
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
const can = (scope: string) =>
  isSuperadmin.value || tenantAccess.value?.role === 'OWNER' || tenantAccess.value?.scopes.includes(scope)

const tabs = computed<SettingsTab[]>(() => {
  const t: SettingsTab[] = []
  if (can('TENANT_SETTINGS'))
    t.push({ id: 'branding', labelKey: 'common.preferences.tabs.branding', icon: 'mdi:palette-outline' })
  t.push({ id: 'members', labelKey: 'common.preferences.tabs.members', icon: 'mdi:account-group-outline' })
  if (!isBasic.value && can('TENANT_SETTINGS')) {
    t.push({ id: 'content', labelKey: 'common.preferences.tabs.content', icon: 'mdi:text-box-outline' })
  }
  if (!isBasic.value && can('INTEGRATION_CONTROL'))
    t.push({ id: 'integrations', labelKey: 'common.preferences.tabs.integrations', icon: 'mdi:puzzle-outline' })
  if (hasAi.value && can('AI_USE'))
    t.push({ id: 'ai', labelKey: 'common.preferences.tabs.ai', icon: 'mdi:robot-outline' })
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
    toast.success({ message: enabled ? $t('common.messages.saveSuccess') : $t('common.messages.featureDisabled') })
  } catch {
    toast.error({ message: $t('common.messages.saveFailed') })
    await refresh()
  }
}

const savePreferences = async () => {
  if (!clientId.value) return toast.error({ message: $t('common.preferences.messages.noClientId') })
  try {
    const payload: Record<string, unknown> = {
      ...form.value,
      logoUrl: form.value.optimizedUrl || form.value.logoUrl,
      socials: form.value.socials.filter((s) => s.url.trim()),
      aiUser: client.value?.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
    }
    if (!can('INTEGRATION_CONTROL'))
      for (const field of [
        'socials',
        'linkedinMode',
        'linkedinCompanyType',
        'linkedinBrandProfile',
        'gtagId',
        'allowGtag',
      ])
        Reflect.deleteProperty(payload, field)
    await $fetch(`/api/clients/${clientId.value}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: payload,
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
