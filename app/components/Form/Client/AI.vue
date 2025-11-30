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
          <FileUploader :imageUrl="avatarUrl" type="user-avatar" :isAiUser="true" @upload="avatarUrl = $event.url" />
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  username: string
  bio: string
  avatarUrl: string
  aiEnabled: boolean
  sentimentEnabled: boolean
  articleCronsEnabled: boolean
  canEnableAi: boolean
  canEnableSentiment: boolean
  canEnableArticleCrons: boolean
  togglePending?: boolean
  currency: string
  features: { code: string; priceMonthly: number; priceAnnual?: number | null }[]
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT'
}>()

const emit = defineEmits<{
  'update:username': [string]
  'update:bio': [string]
  'update:avatarUrl': [string]
  'toggle:feature': [{ code: string; enabled: boolean }]
}>()

const rate = await useCurrencyRate(props.currency)

const username = computed({ get: () => props.username, set: (v) => emit('update:username', v) })
const bio = computed({ get: () => props.bio, set: (v) => emit('update:bio', v) })
const avatarUrl = computed({ get: () => props.avatarUrl, set: (v) => emit('update:avatarUrl', v) })
const togglePending = computed(() => props.togglePending ?? false)

const toggle = (code: string) => {
  const current =
    { AI: props.aiEnabled, SENTIMENT: props.sentimentEnabled, ARTICLE_CRONS: props.articleCronsEnabled }[code] ?? false
  emit('toggle:feature', { code, enabled: !current })
}

const formatFeaturePrice = (code: string) => {
  const monthlyCZK = props.features.find((f) => f.code === code)?.priceMonthly
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
