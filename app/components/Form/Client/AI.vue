<template>
  <div class="space-y-10">
    <header>
      <h2 class="text-xl font-bold text-highlighted">{{ $t('common.preferences.aiPage.title') }}</h2>
      <p class="mt-1 max-w-2xl text-sm leading-6 text-muted">
        {{ $t('common.preferences.aiPage.description') }}
      </p>
    </header>

    <section class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.aiAuthor.title') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.aiAuthor.description') }}</p>
      </div>

      <div class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default">
        <div class="grid gap-6 border-b border-default p-5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:p-6">
          <div class="flex flex-col items-start gap-2">
            <AppFormLabel :text="$t('common.avatar.ai.label')" />
            <UserPictureUploader
              v-model="avatarUrl"
              :api="`/api/clients/${clientId}/ai-avatar`"
              :name="username || $t('common.preferences.aiAuthor.title')"
            >
              <template #default="{ open }">
                <button
                  type="button"
                  class="group relative rounded-full outline-none ring-1 ring-default transition hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary"
                  :aria-label="`${$t('common.actions.change')} ${$t('common.avatar.ai.label')}`"
                  @click="open"
                >
                  <UserPicture :url="avatarUrl" size="xl" :name="username || $t('common.preferences.aiAuthor.title')" />
                  <span
                    class="absolute inset-0 grid place-items-center rounded-full bg-neutral-950/0 text-white transition group-hover:bg-neutral-950/45 group-focus-visible:bg-neutral-950/45"
                  >
                    <UIcon
                      name="mdi:camera-outline"
                      class="size-6 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </span>
                </button>
              </template>
            </UserPictureUploader>
            <span class="text-xs text-muted">{{ $t('common.actions.change') }}</span>
          </div>

          <div class="grid min-w-0 gap-5">
            <AppFormField
              v-model="username"
              :label="$t('common.preferences.aiAuthor.username.label')"
              :placeholder="$t('common.preferences.aiAuthor.username.placeholder')"
              type="text"
            />
            <div class="flex flex-col gap-2">
              <AppFormLabel :text="$t('common.preferences.aiAuthor.bio.label')" />
              <AppFormField
                v-model="bio"
                :placeholder="$t('common.preferences.aiAuthor.bio.placeholder')"
                :maxLength="300"
              />
            </div>
          </div>
        </div>

        <div class="grid gap-x-8 gap-y-6 p-5 sm:p-6 lg:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-2">
            <AppFormLabel :text="$t('common.preferences.aiAuthor.toneOfVoice.label')" />
            <AppFormField
              v-model="aiToneOfVoice"
              type="text"
              :placeholder="$t('common.preferences.aiAuthor.toneOfVoice.placeholder')"
            />
            <div class="mt-1 flex flex-wrap gap-2">
              <UButton
                v-for="suggestion in toneSuggestions"
                :key="suggestion"
                color="neutral"
                :variant="aiToneOfVoice.includes(suggestion) ? 'soft' : 'outline'"
                size="xs"
                class="rounded-full"
                @click="toggleToneSuggestion(suggestion)"
              >
                {{ suggestion }}
              </UButton>
            </div>
          </div>

          <div class="flex min-w-0 flex-col gap-2">
            <AppFormLabel :text="$t('common.preferences.aiAuthor.controversyLevel.label')" />
            <USelectMenu
              v-model="aiControversyLevel"
              valueKey="value"
              labelKey="label"
              :items="controversyOptions"
              upwards
            />
            <p class="text-xs leading-5 text-muted">
              {{ $t('common.preferences.aiAuthor.controversyLevel.help') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div v-if="!setupOnly" class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.aiPage.capabilities') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.aiPage.capabilitiesDescription') }}</p>
      </div>
      <div class="grid gap-3 rounded-(--topiqu-surface-radius) border border-default bg-muted/30 p-3 sm:p-4">
        <FormClientFeatureToggle
          icon="mdi:robot-outline"
          accentRing="ring-2 ring-blue-500"
          accentIcon="text-blue-600 dark:text-blue-400"
          :title="$t('common.features.ai')"
          :description="$t('common.features.aiDesc')"
          :price="featurePrice('AI')"
          :billingPlan
          :enabled="aiEnabled"
          :disabled="!canEnableAi"
          :loading="togglePending"
          @toggle="toggle('AI')"
        />

        <FormClientFeatureToggle
          icon="mdi:emoticon-happy-outline"
          accentRing="ring-2 ring-emerald-500"
          accentIcon="text-emerald-600 dark:text-emerald-400"
          :title="$t('common.features.sentiment')"
          :description="$t('common.features.sentimentDesc')"
          :price="featurePrice('SENTIMENT')"
          :billingPlan
          :enabled="sentimentEnabled"
          :disabled="!canEnableSentiment || !aiEnabled"
          :loading="togglePending"
          @toggle="toggle('SENTIMENT')"
        />

        <FormClientFeatureToggle
          icon="mdi:clock-outline"
          accentRing="ring-2 ring-violet-500"
          accentIcon="text-violet-600 dark:text-violet-400"
          :title="$t('common.features.articleCrons')"
          :description="$t('common.features.articleCronsDesc')"
          :price="featurePrice('ARTICLE_CRONS')"
          :billingPlan
          :enabled="articleCronsEnabled"
          :disabled="!canEnableArticleCrons || !aiEnabled"
          :loading="togglePending"
          @toggle="toggle('ARTICLE_CRONS')"
        />
      </div>
    </div>

    <section v-if="aiEnabled && articleCronsEnabled" class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.aiPage.automation') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.aiPage.automationDescription') }}</p>
      </div>

      <div
        class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
      >
        <div class="flex items-start gap-4 p-5 sm:p-6">
          <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted">
            <UIcon :name="autoRelease ? 'mdi:publish' : 'mdi:file-document-edit-outline'" class="size-5" />
          </div>

          <div class="flex-1">
            <div class="text-sm font-semibold text-highlighted">
              {{ $t('common.preferences.autoRelease.title') }}
            </div>
            <div class="mt-1 text-sm leading-5 text-muted">
              {{
                autoRelease ? $t('common.preferences.autoRelease.warning') : $t('common.preferences.autoRelease.desc')
              }}
            </div>
          </div>

          <USwitch
            :modelValue="autoRelease"
            :aria-label="$t('common.preferences.autoRelease.title')"
            @update:modelValue="(val) => handleAutoReleaseToggle(val as boolean)"
          />
        </div>
        <div class="p-5 sm:p-6">
          <h4 class="text-sm font-semibold text-highlighted">
            {{ $t('common.preferences.generationFrequency.label') }}
          </h4>
          <p class="mb-4 mt-1 text-sm leading-5 text-muted">
            {{ $t('common.preferences.generationFrequency.description') }}
          </p>
          <UFormField :label="$t('common.preferences.generationFrequency.label')" :ui="{ label: 'sr-only' }">
            <URadioGroup
              v-model="generationFrequency"
              :items="generationFrequencyOptions"
              variant="card"
              class="grid gap-3 sm:grid-cols-2"
            />
          </UFormField>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.aiPage.transparency') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.aiPage.transparencyDescription') }}</p>
      </div>
      <div class="flex items-start gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-5 sm:p-6">
        <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted">
          <UIcon name="mdi:information-outline" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.aiDisclosure.title') }}</div>
          <div class="mt-1 text-sm leading-5 text-muted">{{ $t('common.preferences.aiDisclosure.desc') }}</div>
        </div>
        <USwitch
          :modelValue="props.discloseAiContent"
          :aria-label="$t('common.preferences.aiDisclosure.title')"
          @update:modelValue="emit('update:discloseAiContent', $event as boolean)"
        />
      </div>
    </section>

    <section class="space-y-4" :class="!aiEnabled && !setupOnly && 'opacity-60 pointer-events-none'">
      <div>
        <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.translation.title') }}</h3>
        <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.translation.desc') }}</p>
      </div>

      <div class="rounded-(--topiqu-surface-radius) border border-default bg-default p-5 sm:p-6">
        <div class="grid gap-6 lg:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-2">
            <AppFormLabel :text="$t('common.preferences.translation.mode.label')" />
            <USelectMenu
              v-model="translationMode"
              valueKey="value"
              labelKey="label"
              :items="translationModeOptions"
              upwards
            />
          </div>

          <div v-if="translationMode !== 'OFF'" class="flex min-w-0 flex-col gap-2">
            <AppFormLabel :text="$t('common.preferences.translation.targetLangs.label')" />
            <div v-if="targetLangOptions.length" class="flex flex-wrap gap-2">
              <UButton
                v-for="lang in targetLangOptions"
                :key="lang"
                color="neutral"
                :variant="translationLanguages.includes(lang) ? 'soft' : 'outline'"
                size="sm"
                @click="toggleTargetLang(lang)"
              >
                {{ $t(`languages.${lang}`) }}
              </UButton>
            </div>
            <p v-else class="text-xs text-muted">{{ $t('common.preferences.translation.targetLangs.empty') }}</p>
          </div>
        </div>

        <div
          v-if="translationMode === 'AUTO' || translationMode === 'HYBRID'"
          class="mt-5 flex items-start gap-3 border-t border-default pt-5 text-muted"
        >
          <UIcon name="mdi:information-outline" class="mt-0.5 size-4 shrink-0" />
          <p class="text-xs leading-5">{{ $t('common.preferences.translation.tokenWarning') }}</p>
        </div>
      </div>
    </section>

    <AppConfirmDialog
      v-model:open="showAutoReleaseModal"
      :title="$t('common.preferences.autoRelease.confirmTitle')"
      :message="$t('common.preferences.autoRelease.confirmMessage')"
      icon="mdi:alert-rhombus-outline"
      :confirmText="$t('common.actions.enable')"
      :cancelText="$t('common.actions.cancel')"
      @confirm="confirmAutoRelease"
    />

    <AppConfirmDialog
      v-model:open="showAiDisableModal"
      :title="$t('common.features.disableAiTitle')"
      :message="$t('common.features.disableAiMessage')"
      icon="mdi:alert-rhombus-outline"
      variant="danger"
      :confirmText="$t('common.actions.disable')"
      :cancelText="$t('common.actions.cancel')"
      @confirm="confirmAiDisable"
    />
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  clientId: string
  username: string
  bio: string
  avatarUrl: string
  aiToneOfVoice?: string | null
  aiControversyLevel?: string | null
  aiEnabled: boolean
  sentimentEnabled: boolean
  articleCronsEnabled: boolean
  autoRelease: boolean
  generationFrequency: 'DAILY' | 'WEEKLY' | 'NONE'
  canEnableAi: boolean
  canEnableSentiment: boolean
  canEnableArticleCrons: boolean
  togglePending?: boolean
  currency: string
  features: {
    code: string
    priceMonthly: number
    priceAnnual?: number | null
  }[]
  plan: string
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  language: string
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
  translationLanguages: string[]
  discloseAiContent: boolean
  setupOnly?: boolean
}>()
const emit = defineEmits<{
  'update:username': [string]
  'update:bio': [string]
  'update:aiToneOfVoice': [string | null]
  'update:aiControversyLevel': [string | null]
  'update:avatarUrl': [string]
  'update:autoRelease': [boolean]
  'update:generationFrequency': ['DAILY' | 'WEEKLY']
  'update:translationMode': ['OFF' | 'MANUAL' | 'AUTO' | 'HYBRID']
  'update:translationLanguages': [string[]]
  'update:discloseAiContent': [boolean]
  'toggle:feature': [{ code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }]
}>()

const SUPPORTED_LANGUAGES = ['cs', 'en']

const translationMode = computed({
  get: () => props.translationMode,
  set: (v) => emit('update:translationMode', v),
})
const generationFrequency = computed<'DAILY' | 'WEEKLY'>({
  get: () => (props.generationFrequency === 'WEEKLY' ? 'WEEKLY' : 'DAILY'),
  set: (value) => emit('update:generationFrequency', value),
})
const generationFrequencyOptions = computed(() =>
  (['DAILY', 'WEEKLY'] as const).map((value) => ({
    value,
    label: t(`common.preferences.generationFrequency.options.${value}`),
    description: t(`common.preferences.generationFrequency.optionDescriptions.${value}`),
  })),
)

const translationModeOptions = computed(() =>
  (['OFF', 'MANUAL', 'AUTO', 'HYBRID'] as const).map((value) => ({
    value,
    label: t(`common.preferences.translation.mode.options.${value}`),
  })),
)

const targetLangOptions = computed(() => SUPPORTED_LANGUAGES.filter((lang) => lang !== props.language))

const translationLanguages = computed(() => props.translationLanguages)

const toggleTargetLang = (lang: string) => {
  const current = props.translationLanguages
  emit('update:translationLanguages', current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang])
}

const showAutoReleaseModal = shallowRef(false)
const showAiDisableModal = shallowRef(false)

const rate = await useCurrencyRate(props.currency)

const username = computed({
  get: () => props.username,
  set: (v) => emit('update:username', v),
})
const bio = computed({
  get: () => props.bio,
  set: (v) => emit('update:bio', v),
})
const aiToneOfVoice = computed({
  get: () => props.aiToneOfVoice ?? '',
  set: (v) => emit('update:aiToneOfVoice', v || null),
})

const toggleToneSuggestion = (suggestion: string) => {
  const current = aiToneOfVoice.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (current.includes(suggestion)) {
    aiToneOfVoice.value = current.filter((s) => s !== suggestion).join(', ')
  } else {
    aiToneOfVoice.value = [...current, suggestion].join(', ')
  }
}

const aiControversyLevel = computed({
  get: () => props.aiControversyLevel ?? 'NONE',
  set: (v) => emit('update:aiControversyLevel', v === 'NONE' ? null : v),
})

const controversyOptions = computed(() => [
  {
    value: 'NONE',
    label: t('common.preferences.aiAuthor.controversyLevel.options.NONE'),
  },
  {
    value: 'LOW',
    label: t('common.preferences.aiAuthor.controversyLevel.options.LOW'),
  },
  {
    value: 'MEDIUM',
    label: t('common.preferences.aiAuthor.controversyLevel.options.MEDIUM'),
  },
  {
    value: 'HIGH',
    label: t('common.preferences.aiAuthor.controversyLevel.options.HIGH'),
  },
])

const toneSuggestions = computed(() => [
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.professional'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.casual'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.funny'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.sarcastic'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.technical'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.inspiring'),
])
// The uploader writes straight to the AI author row, so this only mirrors the saved URL back into
// the settings form — it is never part of what the Save button sends.
const avatarUrl = computed({
  get: () => props.avatarUrl,
  set: (v) => emit('update:avatarUrl', v ?? ''),
})
const togglePending = computed(() => props.togglePending ?? false)

const handleAutoReleaseToggle = (newValue: boolean) => {
  if (newValue) {
    showAutoReleaseModal.value = true
  } else {
    emit('update:autoRelease', false)
  }
}

const confirmAutoRelease = () => {
  emit('update:autoRelease', true)
  showAutoReleaseModal.value = false
}

const toggle = (code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS') => {
  const current =
    {
      AI: props.aiEnabled,
      SENTIMENT: props.sentimentEnabled,
      ARTICLE_CRONS: props.articleCronsEnabled,
    }[code] ?? false

  if (code === 'AI' && current && (props.sentimentEnabled || props.articleCronsEnabled)) {
    showAiDisableModal.value = true
    return
  }

  emit('toggle:feature', { code, enabled: !current })
}

const confirmAiDisable = () => {
  emit('toggle:feature', { code: 'AI', enabled: false })
  showAiDisableModal.value = false
}

const featurePrice = (code: string) => {
  if (props.plan !== 'CUSTOM') return null

  const monthlyUsd = props.features?.find((f) => f.code === code)?.priceMonthly
  if (!monthlyUsd) return '–'

  const price = props.billingPlan === 'ANNUAL' ? monthlyUsd * 12 * 0.8 : monthlyUsd

  return new Intl.NumberFormat(props.currency === 'CZK' ? 'cs-CZ' : undefined, {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: props.currency === 'CZK' ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price * rate)
}
</script>
