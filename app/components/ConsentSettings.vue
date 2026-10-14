<template>
  <UModal
    v-model:open="open"
    :title="$t('common.consent.settingsTitle')"
    :description="$t('common.consent.settingsDescription')"
    :ui="{ content: 'max-w-xl', header: 'pr-16', title: 'text-lg font-semibold' }"
  >
    <template #body>
      <div class="divide-y divide-default">
        <div class="flex items-start justify-between gap-4 pb-5">
          <div class="min-w-0">
            <h3 class="font-semibold text-highlighted">{{ $t('common.consent.technicalTitle') }}</h3>
            <p class="mt-1 text-sm leading-6 text-muted">{{ $t('common.consent.technicalDescription') }}</p>
          </div>
          <span class="mt-0.5 shrink-0 text-xs font-medium text-muted">{{ $t('common.consent.alwaysOn') }}</span>
        </div>
        <div v-for="category in categories" :key="category.key" class="py-5">
          <div class="flex items-start justify-between gap-4">
            <label :for="`consent-${category.key}`" class="min-w-0 cursor-pointer">
              <span class="font-semibold text-highlighted">{{ $t(category.title) }}</span>
              <span :id="`consent-${category.key}-description`" class="mt-1 block text-sm leading-6 text-muted">
                {{ $t(category.description) }}
              </span>
            </label>
            <USwitch
              :id="`consent-${category.key}`"
              v-model="draft[category.key]"
              :aria-label="$t(category.title)"
              :aria-describedby="`consent-${category.key}-description`"
              class="mt-1 shrink-0"
            />
          </div>
          <p class="mt-2 text-sm leading-6 text-toned">
            {{ $t('common.consent.services', { names: category.services }) }}
          </p>
        </div>
      </div>
      <NuxtLink
        :to="localePath({ name: 'privacy' })"
        class="text-sm text-primary underline underline-offset-4"
        @click="open = false"
      >
        {{ $t('common.consent.moreInfo') }}
      </NuxtLink>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <UButton block size="lg" class="min-h-11" @click="emit('save', { ...draft })">
          {{ $t('common.consent.save') }}
        </UButton>
        <div class="grid gap-2 sm:grid-cols-2">
          <UButton
            color="neutral"
            variant="soft"
            block
            size="lg"
            class="h-auto min-h-11 whitespace-normal text-center"
            :ui="{ label: 'whitespace-normal' }"
            @click="emit('reject')"
          >
            {{ $t('common.consent.reject') }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            block
            size="lg"
            class="h-auto min-h-11 whitespace-normal text-center"
            :ui="{ label: 'whitespace-normal' }"
            @click="emit('accept')"
          >
            {{ $t('common.consent.accept') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ConsentCapabilities, ConsentDecision, ConsentSite } from '~~/shared/utils/consent'

import { hasAnalyticsConsent, hasMarketingConsent } from '~~/shared/utils/consent'

const props = defineProps<{
  site: ConsentSite | null | undefined
  capabilities: ConsentCapabilities
  decision: ConsentDecision | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  save: [choices: { analytics: boolean; marketing: boolean }]
  accept: []
  reject: []
}>()
const { t } = useI18n()
const localePath = useLocalePath()
const draft = reactive({ analytics: false, marketing: false })
watch(
  open,
  (value) => {
    if (!value) return
    draft.analytics = hasAnalyticsConsent(props.decision, props.capabilities)
    draft.marketing = hasMarketingConsent(props.decision, props.capabilities)
  },
  { immediate: true },
)

const categories = computed(() => {
  const result: { key: 'analytics' | 'marketing'; title: string; description: string; services: string }[] = []
  if (props.capabilities.analytics)
    result.push({
      key: 'analytics',
      title: 'common.consent.analyticsTitle',
      description: 'common.consent.analyticsDescription',
      services: [
        t('common.consent.internalAnalytics'),
        ...(props.capabilities.googleAnalytics ? ['Google Analytics 4'] : []),
      ].join(', '),
    })
  if (props.capabilities.marketing)
    result.push({
      key: 'marketing',
      title: 'common.consent.marketingTitle',
      description: 'common.consent.marketingDescription',
      services: 'Google Ad Manager',
    })
  return result
})
</script>
