<template>
  <div class="space-y-8">
    <UCard>
      <div class="grid grid-cols-1 gap-3">
        <UCard>
          <div class="flex items-start gap-3">
            <UIcon size="24" name="i-mdi-robot-outline" class="mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm text-highlighted">{{ $t('common.features.ai') }}</div>
              <div class="text-xs text-muted leading-tight">{{ $t('common.features.aiDesc') }}</div>
              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="font-semibold text-highlighted">
                  {{ formatFeaturePrice('AI') }}
                  <span class="font-normal text-muted"
                    >/{{
                      billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                    }}</span
                  >
                </span>
                <span v-if="billingPlan === 'ANNUAL'" class="font-medium text-success">–20 %</span>
              </div>
            </div>
            <UFormField :label="$t('common.features.ai')" :ui="{ label: 'sr-only' }" class="shrink-0">
              <USwitch
                :modelValue="aiEnabled"
                :disabled="!canEnableAi"
                :loading="togglePending"
                :aria-label="$t('common.features.ai')"
                @update:modelValue="toggle('AI')"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-start gap-3">
            <UIcon size="24" name="i-mdi-emoticon-happy-outline" class="mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm text-highlighted">
                {{ $t('common.features.sentiment') }}
              </div>
              <div class="text-xs text-muted leading-tight">
                {{ $t('common.features.sentimentDesc') }}
              </div>
              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="font-semibold text-highlighted">
                  {{ formatFeaturePrice('SENTIMENT') }}
                  <span class="font-normal text-muted"
                    >/{{
                      billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                    }}</span
                  >
                </span>
                <span v-if="billingPlan === 'ANNUAL'" class="font-medium text-success">–20 %</span>
              </div>
            </div>
            <UFormField :label="$t('common.features.sentiment')" :ui="{ label: 'sr-only' }" class="shrink-0">
              <USwitch
                :modelValue="sentimentEnabled"
                :disabled="!canEnableSentiment || !aiEnabled"
                :loading="togglePending"
                :aria-label="$t('common.features.sentiment')"
                @update:modelValue="toggle('SENTIMENT')"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-start gap-3">
            <UIcon size="24" name="i-mdi-clock-outline" class="mt-0.5 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm text-highlighted">
                {{ $t('common.features.articleCrons') }}
              </div>
              <div class="text-xs text-muted leading-tight">
                {{ $t('common.features.articleCronsDesc') }}
              </div>
              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="font-semibold text-highlighted">
                  {{ formatFeaturePrice('ARTICLE_CRONS') }}
                  <span class="font-normal text-muted"
                    >/{{
                      billingPlan === 'ANNUAL' ? $t('common.preferences.annualy') : $t('common.preferences.monthly')
                    }}</span
                  >
                </span>
                <span v-if="billingPlan === 'ANNUAL'" class="font-medium text-success">–20 %</span>
              </div>
            </div>
            <UFormField :label="$t('common.features.articleCrons')" :ui="{ label: 'sr-only' }" class="shrink-0">
              <USwitch
                :modelValue="articleCronsEnabled"
                :disabled="!canEnableArticleCrons || !aiEnabled"
                :loading="togglePending"
                :aria-label="$t('common.features.articleCrons')"
                @update:modelValue="toggle('ARTICLE_CRONS')"
              />
            </UFormField>
          </div>
        </UCard>
      </div>
    </UCard>
    <UCard v-if="aiEnabled && articleCronsEnabled">
      <div class="flex items-center gap-4">
        <div>
          <UIcon size="24" :name="autoRelease ? 'i-mdi-publish' : 'i-mdi-file-document-edit-outline'" />
        </div>

        <div class="flex-1">
          <div class="text-sm font-semibold text-highlighted">
            {{ $t('common.preferences.autoRelease.title') }}
          </div>
          <div class="text-xs leading-tight text-muted">
            {{ autoRelease ? $t('common.preferences.autoRelease.warning') : $t('common.preferences.autoRelease.desc') }}
          </div>
        </div>

        <UFormField :label="$t('common.preferences.autoRelease.title')" :ui="{ label: 'sr-only' }">
          <USwitch
            :modelValue="autoRelease"
            :aria-label="$t('common.preferences.autoRelease.title')"
            @update:modelValue="(val) => handleAutoReleaseToggle(val as boolean)"
          />
        </UFormField>
      </div>
    </UCard>
    <UCard>
      <div class="flex flex-col gap-6">
        <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
          <UIcon size="24" name="i-mdi-robot" />
          {{ $t('common.preferences.aiAuthor.title') }}
        </h3>
        <div class="space-y-6">
          <UFormField :label="$t('common.preferences.aiAuthor.username.label')">
            <UInput
              v-model="username"
              :placeholder="$t('common.preferences.aiAuthor.username.placeholder')"
              type="text"
            />
          </UFormField>
          <UFormField :label="$t('common.avatar.ai.label')">
            <FileUploader
              :imageUrl="avatarUrl"
              type="user-avatar"
              :isAiUser="true"
              @upload="((avatarUrl = $event.url), (optimizedImageUrl = $event.optimizedUrl))"
            />
          </UFormField>
          <UFormField :label="$t('common.preferences.aiAuthor.bio.label')">
            <UTextarea
              v-model="bio"
              :placeholder="$t('common.preferences.aiAuthor.bio.placeholder')"
              :maxLength="300"
              autoresize
            />
          </UFormField>
          <UFormField :label="$t('common.preferences.aiAuthor.toneOfVoice.label')">
            <UInput
              v-model="aiToneOfVoice"
              type="text"
              :placeholder="$t('common.preferences.aiAuthor.toneOfVoice.placeholder')"
            />
            <div class="flex flex-wrap gap-2 mt-1">
              <UButton
                v-for="suggestion in toneSuggestions"
                :key="suggestion"
                :color="aiToneOfVoice.includes(suggestion) ? 'primary' : 'neutral'"
                :variant="aiToneOfVoice.includes(suggestion) ? 'solid' : 'soft'"
                @click="toggleToneSuggestion(suggestion)"
              >
                {{ suggestion }}
              </UButton>
            </div>
          </UFormField>
          <UFormField :label="$t('common.preferences.aiAuthor.controversyLevel.label')">
            <USelectMenu
              v-model="aiControversyLevel"
              valueKey="value"
              labelKey="label"
              :searchInput="false"
              :items="controversyOptions"
            />
          </UFormField>
        </div>
      </div>
    </UCard>

    <UCard>
      <fieldset :disabled="!aiEnabled" class="flex flex-col gap-6">
        <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
          <UIcon size="24" name="i-mdi-translate" />
          {{ $t('common.preferences.translation.title') }}
        </h3>
        <p class="-mt-4 text-xs text-muted">{{ $t('common.preferences.translation.desc') }}</p>

        <UFormField :label="$t('common.preferences.translation.mode.label')">
          <USelectMenu
            v-model="translationMode"
            valueKey="value"
            labelKey="label"
            :searchInput="false"
            :items="translationModeOptions"
          />
        </UFormField>

        <UFormField v-if="translationMode !== 'OFF'" :label="$t('common.preferences.translation.targetLangs.label')">
          <UCheckboxGroup
            v-if="targetLangOptions.length"
            v-model="translationLanguages"
            :items="targetLanguageItems"
            valueKey="value"
            orientation="horizontal"
          />
          <UEmpty v-else size="sm" :description="$t('common.preferences.translation.targetLangs.empty')" />
        </UFormField>

        <UAlert
          v-if="translationMode === 'AUTO' || translationMode === 'HYBRID'"
          color="warning"
          variant="soft"
          icon="i-mdi-alert-outline"
          :description="$t('common.preferences.translation.tokenWarning')"
        />
      </fieldset>
    </UCard>

    <UModal
      v-model:open="showAutoReleaseModal"
      :title="$t('common.preferences.autoRelease.confirmTitle')"
      :description="$t('common.preferences.autoRelease.confirmMessage')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showAutoReleaseModal = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton @click="confirmAutoRelease">{{ $t('common.actions.enable') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showAiDisableModal"
      :title="$t('common.features.disableAiTitle')"
      :description="$t('common.features.disableAiMessage')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showAiDisableModal = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton color="error" @click="confirmAiDisable">{{ $t('common.actions.disable') }}</UButton>
        </div>
      </template>
    </UModal>
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
const targetLanguageItems = computed(() =>
  targetLangOptions.value.map((value) => ({ value, label: t(`languages.${value}`) })),
)

const translationLanguages = computed({
  get: () => props.translationLanguages,
  set: (value: string[]) => emit('update:translationLanguages', value),
})

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

const formatFeaturePrice = (code: string) => {
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
