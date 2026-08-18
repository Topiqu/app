<template>
  <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-highlighted">
        {{ $t('common.preferences.title') }}
      </h1>

      <LazyClientHint v-if="!isBasic" hydrateOnInteraction>
        <UButton
          square
          variant="ghost"
          size="sm"
          color="neutral"
          icon="i-mdi-information-outline"
          :aria-label="$t('common.preferences.explanation')"
          :title="$t('common.preferences.explanation')"
        />
      </LazyClientHint>
    </header>

    <div class="flex flex-col md:flex-row gap-6 md:gap-10">
      <SettingsNav v-model="activeTab" :tabs="tabs" />

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
              <UIcon size="20" name="i-mdi-google-analytics" class="text-orange-500" />
              {{ $t('common.preferences.external') }}
            </h3>

            <UCard>
              <div class="space-y-6">
                <UFormField :label="$t('common.preferences.integrations.analytics')" :ui="{ label: 'sr-only' }">
                  <UCheckbox v-model="form.allowGtag" :label="$t('common.preferences.integrations.analytics')" />
                </UFormField>
                <UFormField v-if="form.allowGtag" :label="$t('common.preferences.integrations.measurementId')">
                  <UInput v-model="form.gtagId" placeholder="G-XXXXXXXXXX" leadingIcon="i-mdi-tag-outline" />
                </UFormField>

                <div v-if="isSuperadmin" class="pt-4 border-t border-default">
                  <UFormField :label="$t('common.preferences.integrations.ads')" :ui="{ label: 'sr-only' }">
                    <UCheckbox v-model="form.allowAds" :label="$t('common.preferences.integrations.ads')" />
                  </UFormField>
                  <UFormField v-if="form.allowAds" :label="$t('common.preferences.integrations.networkCode')">
                    <UInput v-model="form.gamNetworkCode" placeholder="XXXXXXXXXX" leadingIcon="i-mdi-code-tags" />
                  </UFormField>
                </div>
              </div>
            </UCard>
          </section>

          <section>
            <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
              <UIcon size="20" name="i-mdi-key-chain-variant" />
              {{ $t('common.preferences.api.title') }}
            </h3>

            <UCard>
              <div v-if="!form.apiKey" class="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="text-sm text-muted">
                  {{ $t('common.preferences.api.description') }}
                </div>
                <UButton color="neutral" variant="soft" icon="i-mdi-plus" class="shrink-0" @click="generateApiKey">
                  {{ $t('common.preferences.api.generate') }}
                </UButton>
              </div>

              <div v-else class="space-y-3">
                <UFormField :label="$t('common.preferences.api.label')">
                  <UInput :modelValue="form.apiKey" :type="apiVisible ? 'text' : 'password'" readonly class="w-full">
                    <template #trailing>
                      <div class="flex items-center gap-1">
                        <UButton
                          square
                          variant="ghost"
                          size="sm"
                          color="neutral"
                          :icon="apiVisible ? 'i-mdi-eye-off-outline' : 'i-mdi-eye-outline'"
                          :aria-label="
                            apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')
                          "
                          :title="apiVisible ? $t('common.preferences.api.hide') : $t('common.preferences.api.show')"
                          @click="apiVisible = !apiVisible"
                        />
                        <UButton
                          square
                          variant="ghost"
                          size="sm"
                          color="neutral"
                          :icon="apiCopied ? 'i-mdi-check' : 'i-mdi-content-copy'"
                          :aria-label="
                            apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')
                          "
                          :title="apiCopied ? $t('common.preferences.api.copied') : $t('common.preferences.api.copy')"
                          @click="copyApi(form.apiKey)"
                        />
                      </div>
                    </template>
                  </UInput>
                </UFormField>

                <div class="flex items-start gap-2 text-xs text-muted">
                  <UIcon size="16" name="i-mdi-shield-alert-outline" class="shrink-0 mt-0.5" />
                  <p>{{ $t('common.preferences.api.warning') }}</p>
                </div>
              </div>
            </UCard>
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
          <UCard>
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
              :features="features ?? []"
              :currency="client?.currency ?? 'EUR'"
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
            />
          </UCard>
        </section>

        <section v-if="showBilling" v-show="activeTab === 'billing'">
          <FormClientBilling :client="client ?? null" :rate="rate" />
        </section>
      </div>
    </div>

    <div class="pointer-events-none sticky bottom-4 z-10 flex justify-center sm:justify-end">
      <UAlert
        v-if="isDirty"
        class="pointer-events-auto w-auto"
        color="warning"
        variant="soft"
        icon="i-mdi-content-save-alert-outline"
        :title="$t('common.preferences.unsaved')"
      >
        <template #actions>
          <UButton size="sm" @click="savePreferences">
            {{ $t('common.actions.saveChanges') }}
          </UButton>
        </template>
      </UAlert>
    </div>
  </div>
</template>

<script setup lang="ts">
import equal from 'fast-deep-equal'

import type { SettingsTab } from '~/components/Settings/Nav.vue'

import { buildClientSettingsForm, type ClientSite } from '~/utils/buildClientSettingsForm'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })

const toast = useToast()
const { data: auth } = useAuth()
const route = useRoute()
const router = useRouter()
const { copy: copyApi, copied: apiCopied } = useClipboard({ legacy: true })
const confirm = useConfirm()
const apiVisible = shallowRef(false)

const clientId = computed(() => auth.value?.user.clientSiteId)
const isSuperadmin = computed(() => auth.value?.user.role === 'superadmin')

const { data: client, refresh } = await useFetch<ClientSite>(`/api/clients/${auth.value?.user.clientSiteId}`)
const { data: features } = await useFetch(`/api/features`)
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
const hasAi = computed(() => !isBasic.value && (client.value?.tokenLimit ?? 0) > 0)
const showBilling = computed(() => client.value?.billingPlan !== 'PERMANENT')

const tabs = computed<SettingsTab[]>(() => {
  const t: SettingsTab[] = [
    { id: 'branding', labelKey: 'common.preferences.tabs.branding', icon: 'i-mdi-palette-outline' },
  ]
  if (!isBasic.value) {
    t.push({ id: 'content', labelKey: 'common.preferences.tabs.content', icon: 'i-mdi-text-box-outline' })
    t.push({ id: 'integrations', labelKey: 'common.preferences.tabs.integrations', icon: 'i-mdi-puzzle-outline' })
  }
  if (hasAi.value) t.push({ id: 'ai', labelKey: 'common.preferences.tabs.ai', icon: 'i-mdi-robot-outline' })
  if (showBilling.value)
    t.push({ id: 'billing', labelKey: 'common.preferences.tabs.billing', icon: 'i-mdi-credit-card-outline' })
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
  try {
    const { allowAds, gamNetworkCode, ...tenantForm } = form.value
    await $fetch(`/api/clients/${clientId.value}` as `/api/clients/:id`, {
      method: 'PATCH',
      body: {
        ...tenantForm,
        ...(isSuperadmin.value ? { allowAds, gamNetworkCode } : {}),
        logoUrl: form.value.logoUrl,
        socials: form.value.socials.filter((s) => s.url.trim()),
        aiUser: client.value?.tokenLimit && client.value.tokenLimit > 0 ? form.value.aiUser : undefined,
      },
    })
    toast.add({ color: 'success', title: $t('common.messages.successGeneralTitle') })
    await refresh()
    form.value = buildClientSettingsForm(client.value)
    pristine.value = buildClientSettingsForm(client.value)
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.saveFailed') })
  }
}

const generateApiKey = async () => {
  if (!clientId.value) return
  try {
    const res = await $fetch<{ apiKey: string }>(`/api/clients/${clientId.value}/api-key`, { method: 'POST' })
    form.value.apiKey = res.apiKey
    pristine.value.apiKey = res.apiKey
    toast.add({ color: 'success', title: $t('common.preferences.api.generateSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('common.preferences.api.generateFailed') })
  }
}

onBeforeRouteLeave(async () => {
  if (!isDirty.value) return true
  const r = await confirm({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('common.messages.closeConfirmText'),
    icon: 'i-mdi-alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  return r
})
</script>
