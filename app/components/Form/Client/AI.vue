<template>
  <div class="space-y-8">
    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6">
      <div class="grid grid-cols-1 gap-3">
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
    <Transition
      enterActiveClass="transition duration-300 ease-out"
      enterFromClass="transform -translate-y-4 opacity-0"
      enterToClass="transform translate-y-0 opacity-100"
      leaveActiveClass="transition duration-200 ease-in"
      leaveFromClass="transform translate-y-0 opacity-100"
      leaveToClass="transform -translate-y-4 opacity-0"
    >
      <div
        v-if="aiEnabled && articleCronsEnabled"
        class="rounded-2xl border p-5 flex items-center gap-4 transition-colors duration-300"
        :class="
          autoRelease
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
            : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
        "
      >
        <div
          class="p-2 rounded-full"
          :class="
            autoRelease
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
          "
        >
          <Icon :name="autoRelease ? 'mdi:publish' : 'mdi:file-document-edit-outline'" class="w-6 h-6" />
        </div>

        <div class="flex-1">
          <div
            class="font-semibold text-sm"
            :class="autoRelease ? 'text-amber-900 dark:text-amber-100' : 'text-gray-900 dark:text-gray-100'"
          >
            {{ $t('common.preferences.autoRelease.title') }}
          </div>
          <div
            class="text-xs leading-tight"
            :class="autoRelease ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'"
          >
            {{ autoRelease ? $t('common.preferences.autoRelease.warning') : $t('common.preferences.autoRelease.desc') }}
          </div>
        </div>

        <div class="flex items-center">
          <FormInput
            :modelValue="autoRelease"
            type="checkbox"
            class="!w-5 !h-5 cursor-pointer"
            @update:modelValue="(val) => handleAutoReleaseToggle(val as boolean)"
          />
        </div>
      </div>
    </Transition>
    <div class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-center gap-4">
        <Icon name="mdi:information-outline" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <div class="flex-1">
          <div class="font-semibold text-gray-900 dark:text-gray-100">
            {{ $t('common.preferences.aiDisclosure.title') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ $t('common.preferences.aiDisclosure.desc') }}</div>
        </div>
        <FormInput
          :modelValue="props.discloseAiContent"
          type="checkbox"
          class="!h-5 !w-5 cursor-pointer"
          @update:modelValue="emit('update:discloseAiContent', $event as boolean)"
        />
      </div>
    </div>
    <div
      class="flex flex-col gap-6 p-8 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
    >
      <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
        <Icon name="mdi:robot" class="w-6 h-6" />
        {{ $t('common.preferences.aiAuthor.title') }}
      </h3>
      <div class="space-y-6">
        <FormField
          v-model="username"
          :label="$t('common.preferences.aiAuthor.username.label')"
          :placeholder="$t('common.preferences.aiAuthor.username.placeholder')"
          type="text"
        />
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('common.avatar.ai.label')" />
          <FileUploader
            :imageUrl="avatarUrl"
            type="user-avatar"
            :isAiUser="true"
            @upload="((avatarUrl = $event.url), (optimizedImageUrl = $event.optimizedUrl))"
          />
        </div>
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('common.preferences.aiAuthor.bio.label')" />
          <FormField
            v-model="bio"
            type="textarea"
            :placeholder="$t('common.preferences.aiAuthor.bio.placeholder')"
            :maxLength="300"
          />
        </div>
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('common.preferences.aiAuthor.toneOfVoice.label')" />
          <FormField
            v-model="aiToneOfVoice"
            type="text"
            :placeholder="$t('common.preferences.aiAuthor.toneOfVoice.placeholder')"
          />
          <div class="flex flex-wrap gap-2 mt-1">
            <Button
              v-for="suggestion in toneSuggestions"
              :key="suggestion"
              variant="neutral"
              class="!px-3 !py-1 !min-h-0 !h-auto !text-xs !font-medium !rounded-full transition-colors border"
              :class="
                aiToneOfVoice.includes(suggestion)
                  ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              "
              @click="toggleToneSuggestion(suggestion)"
            >
              {{ suggestion }}
            </Button>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <FormLabel :text="$t('common.preferences.aiAuthor.controversyLevel.label')" />
          <FormSelect v-model="aiControversyLevel" :items="controversyOptions" upwards />
        </div>
      </div>
    </div>

    <div
      class="flex flex-col gap-6 p-8 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40"
      :class="!aiEnabled && 'opacity-60 pointer-events-none'"
    >
      <h3 class="text-lg font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
        <Icon name="mdi:translate" class="w-6 h-6" />
        {{ $t('common.preferences.translation.title') }}
      </h3>
      <p class="text-xs text-gray-600 dark:text-gray-400 -mt-4">{{ $t('common.preferences.translation.desc') }}</p>

      <div class="flex flex-col gap-2">
        <FormLabel :text="$t('common.preferences.translation.mode.label')" />
        <FormSelect v-model="translationMode" :items="translationModeOptions" upwards />
      </div>

      <div v-if="translationMode !== 'OFF'" class="flex flex-col gap-2">
        <FormLabel :text="$t('common.preferences.translation.targetLangs.label')" />
        <div v-if="targetLangOptions.length" class="flex flex-wrap gap-2">
          <Button
            v-for="lang in targetLangOptions"
            :key="lang"
            variant="neutral"
            class="!px-3 !py-1 !min-h-0 !h-auto !text-xs !font-medium !rounded-full transition-colors border"
            :class="
              translationLanguages.includes(lang)
                ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
            "
            @click="toggleTargetLang(lang)"
          >
            {{ $t(`languages.${lang}`) }}
          </Button>
        </div>
        <p v-else class="text-xs text-gray-500">{{ $t('common.preferences.translation.targetLangs.empty') }}</p>
      </div>

      <div
        v-if="translationMode === 'AUTO' || translationMode === 'HYBRID'"
        class="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
      >
        <Icon name="mdi:alert-outline" class="w-5 h-5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p class="text-xs leading-tight text-amber-800 dark:text-amber-200">
          {{ $t('common.preferences.translation.tokenWarning') }}
        </p>
      </div>
    </div>

    <ModalMini
      v-model:open="showAutoReleaseModal"
      :title="$t('common.preferences.autoRelease.confirmTitle')"
      :message="$t('common.preferences.autoRelease.confirmMessage')"
      icon="mdi:alert-rhombus-outline"
      :confirmText="$t('common.actions.enable')"
      :cancelText="$t('common.actions.cancel')"
      @confirm="confirmAutoRelease"
    />

    <ModalMini
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
  username: string
  bio: string
  avatarUrl: string
  aiToneOfVoice?: string | null
  aiControversyLevel?: string | null
  aiEnabled: boolean
  sentimentEnabled: boolean
  articleCronsEnabled: boolean
  autoRelease: boolean
  canEnableAi: boolean
  canEnableSentiment: boolean
  canEnableArticleCrons: boolean
  togglePending?: boolean
  currency: string
  features: { code: string; priceMonthly: number; priceAnnual?: number | null }[]
  plan: string
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  language: string
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
  translationLanguages: string[]
  discloseAiContent: boolean
}>()
const emit = defineEmits<{
  'update:username': [string]
  'update:bio': [string]
  'update:aiToneOfVoice': [string | null]
  'update:aiControversyLevel': [string | null]
  'update:avatarUrl': [{ avatarUrl: string; optimizedImageUrl: string }]
  'update:autoRelease': [boolean]
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

const username = computed({ get: () => props.username, set: (v) => emit('update:username', v) })
const bio = computed({ get: () => props.bio, set: (v) => emit('update:bio', v) })
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
  { value: 'NONE', label: t('common.preferences.aiAuthor.controversyLevel.options.NONE') },
  { value: 'LOW', label: t('common.preferences.aiAuthor.controversyLevel.options.LOW') },
  { value: 'MEDIUM', label: t('common.preferences.aiAuthor.controversyLevel.options.MEDIUM') },
  { value: 'HIGH', label: t('common.preferences.aiAuthor.controversyLevel.options.HIGH') },
])

const toneSuggestions = computed(() => [
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.professional'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.casual'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.funny'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.sarcastic'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.technical'),
  t('common.preferences.aiAuthor.toneOfVoice.suggestions.inspiring'),
])
const avatarUrl = computed({
  get: () => props.avatarUrl,
  set: (v) => emit('update:avatarUrl', { avatarUrl: v, optimizedImageUrl: optimizedImageUrl.value }),
})
const optimizedImageUrl = shallowRef('')
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
    { AI: props.aiEnabled, SENTIMENT: props.sentimentEnabled, ARTICLE_CRONS: props.articleCronsEnabled }[code] ?? false

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
