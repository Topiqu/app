<template>
  <div class="space-y-8">
    <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6">
      <div class="grid grid-cols-1 gap-3">
        <label
          class="flex items-start gap-3 py-3 px-4 rounded-lg border transition-all duration-200 select-none cursor-pointer"
          :class="[
            aiEnabled
              ? 'ring-2 ring-blue-500 border-transparent bg-white dark:bg-gray-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            !canEnableAi && 'opacity-60 cursor-not-allowed',
          ]"
        >
          <Icon name="mdi:robot-outline" class="w-6 h-6 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-gray-900 dark:text-gray-100">{{ $t('common.features.ai') }}</div>
            <div class="text-xs text-gray-600 dark:text-gray-400 leading-tight">{{ $t('common.features.aiDesc') }}</div>
            <div class="mt-1 flex items-center gap-2 text-xs">
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                {{ formatFeaturePrice('AI') }}
                <span class="text-gray-500 font-normal"
                  >/{{
                    billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                  }}</span
                >
              </span>
              <span v-if="billingPlan === 'ANNUAL'" class="text-emerald-600 dark:text-emerald-400 font-medium"
                >–20 %</span
              >
            </div>
          </div>
          <div class="w-5 h-5 flex-shrink-0">
            <FormInput
              :modelValue="aiEnabled"
              type="checkbox"
              :disabled="!canEnableAi"
              :loading="togglePending"
              class="!w-5 !h-5 pointer-events-none"
              @update:modelValue="toggle('AI')"
            />
          </div>
        </label>

        <label
          class="flex items-start gap-3 py-3 px-4 rounded-lg border transition-all duration-200 select-none cursor-pointer"
          :class="[
            sentimentEnabled && aiEnabled
              ? 'ring-2 ring-emerald-500 border-transparent bg-white dark:bg-gray-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            (!canEnableSentiment || !aiEnabled) && 'opacity-60 cursor-not-allowed',
          ]"
        >
          <Icon
            name="mdi:emoticon-happy-outline"
            class="w-6 h-6 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0"
          />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {{ $t('common.features.sentiment') }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400 leading-tight">
              {{ $t('common.features.sentimentDesc') }}
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs">
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                {{ formatFeaturePrice('SENTIMENT') }}
                <span class="text-gray-500 font-normal"
                  >/{{
                    billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                  }}</span
                >
              </span>
              <span v-if="billingPlan === 'ANNUAL'" class="text-emerald-600 dark:text-emerald-400 font-medium"
                >–20 %</span
              >
            </div>
          </div>
          <div class="w-5 h-5 flex-shrink-0">
            <FormInput
              :modelValue="sentimentEnabled"
              type="checkbox"
              :disabled="!canEnableSentiment || !aiEnabled"
              :loading="togglePending"
              class="!w-5 !h-5 pointer-events-none"
              @update:modelValue="toggle('SENTIMENT')"
            />
          </div>
        </label>

        <label
          class="flex items-start gap-3 py-3 px-4 rounded-lg border transition-all duration-200 select-none cursor-pointer"
          :class="[
            articleCronsEnabled && aiEnabled
              ? 'ring-2 ring-violet-500 border-transparent bg-white dark:bg-gray-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            (!canEnableArticleCrons || !aiEnabled) && 'opacity-60 cursor-not-allowed',
          ]"
        >
          <Icon name="mdi:clock-outline" class="w-6 h-6 mt-0.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {{ $t('common.features.articleCrons') }}
            </div>
            <div class="text-xs text-gray-600 dark:text-gray-400 leading-tight">
              {{ $t('common.features.articleCronsDesc') }}
            </div>
            <div class="mt-1 flex items-center gap-2 text-xs">
              <span class="font-semibold text-gray-900 dark:text-gray-100">
                {{ formatFeaturePrice('ARTICLE_CRONS') }}
                <span class="text-gray-500 font-normal"
                  >/{{
                    billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                  }}</span
                >
              </span>
              <span v-if="billingPlan === 'ANNUAL'" class="text-emerald-600 dark:text-emerald-400 font-medium"
                >–20 %</span
              >
            </div>
          </div>
          <div class="w-5 h-5 flex-shrink-0">
            <FormInput
              :modelValue="articleCronsEnabled"
              type="checkbox"
              :disabled="!canEnableArticleCrons || !aiEnabled"
              :loading="togglePending"
              class="!w-5 !h-5 pointer-events-none"
              @update:modelValue="toggle('ARTICLE_CRONS')"
            />
          </div>
        </label>
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
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
  language: string
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
  translationLanguages: string[]
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
  emit(
    'update:translationLanguages',
    current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang],
  )
}

const showAutoReleaseModal = shallowRef(false)

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
  emit('toggle:feature', { code, enabled: !current })
}

const formatFeaturePrice = (code: string) => {
  const monthlyCZK = props.features?.find((f) => f.code === code)?.priceMonthly
  if (!monthlyCZK) return '–'

  const price = props.billingPlan === 'ANNUAL' ? monthlyCZK * 12 * 0.8 : monthlyCZK
  const final = props.currency === 'CZK' ? price : price / rate

  return new Intl.NumberFormat(props.currency === 'CZK' ? 'cs-CZ' : undefined, {
    style: 'currency',
    currency: props.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: props.currency === 'CZK' ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(final)
}
</script>
