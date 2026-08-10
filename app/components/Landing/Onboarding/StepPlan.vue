<template>
  <div class="space-y-7">
    <h3 class="flex items-center gap-3 text-2xl font-bold text-highlighted">
      <UIcon name="i-mdi-crown-outline" size="28" />
      {{ $t('landing.onboarding.choosePlan') }}
    </h3>

    <UAlert color="info" variant="soft" icon="i-mdi-gift-outline" :title="$t('landing.onboarding.planTrialBanner')" />

    <UFormField :label="$t('landing.onboarding.choosePlan')" name="selectedPlan">
      <URadioGroup
        v-model="radioPlan"
        :items="plans"
        valueKey="value"
        labelKey="name"
        descriptionKey="summary"
        variant="card"
        orientation="horizontal"
        indicator="end"
        highlight
        class="w-full"
        :aria-label="$t('landing.onboarding.planNavLabel')"
      >
        <template #label="{ item }">
          <span class="flex items-center gap-2">
            <UIcon :name="item.icon" size="20" />
            <span>{{ item.name }}</span>
            <UBadge :color="item.color" variant="soft" size="sm">{{ item.badge }}</UBadge>
          </span>
        </template>
        <template #description="{ item }">
          <span class="flex flex-col gap-2">
            <span>{{ item.tagline }} — {{ item.description }}</span>
            <span class="text-base font-semibold text-highlighted">{{ item.price }} {{ item.priceSuffix }}</span>
            <span class="flex flex-wrap gap-1">
              <UBadge
                v-for="feature in item.features"
                :key="feature.label"
                color="neutral"
                variant="subtle"
                :icon="feature.icon"
              >
                {{ feature.label }}
              </UBadge>
            </span>
          </span>
        </template>
      </URadioGroup>
    </UFormField>

    <div class="flex gap-4">
      <UButton type="button" color="neutral" variant="soft" size="lg" class="w-1/3" @click="goBack(3)">
        {{ $t('common.actions.back') }}
      </UButton>
      <UButton type="submit" size="lg" class="w-2/3" trailingIcon="i-mdi-arrow-right">
        {{ confirmLabel }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
type PlanId = 'PRO' | 'PREMIUM' | null
type RadioPlanId = 'FREE' | Exclude<PlanId, null>

interface PlanCard {
  value: RadioPlanId
  id: PlanId
  badge: string
  name: string
  tagline: string
  description: string
  summary: string
  price: string
  priceSuffix: string
  icon: string
  color: 'neutral' | 'primary' | 'warning'
  features: { icon: string; label: string }[]
}

const { form, goBack } = useOnboarding()

const plans = computed<PlanCard[]>(() => {
  const items: Omit<PlanCard, 'summary'>[] = [
    {
      value: 'FREE',
      id: null,
      badge: $t('landing.pricing.plans.free.badge'),
      name: $t('landing.pricing.plans.free.name'),
      tagline: $t('landing.onboarding.plans.free.tagline'),
      description: $t('landing.onboarding.plans.free.description'),
      price: $t('landing.pricing.plans.free.price'),
      priceSuffix: $t('landing.pricing.month'),
      icon: 'i-mdi-leaf',
      color: 'neutral',
      features: [
        { icon: 'i-mdi-pencil-outline', label: $t('landing.onboarding.plans.free.features.editor') },
        { icon: 'i-mdi-web', label: $t('landing.onboarding.plans.free.features.subdomain') },
        { icon: 'i-mdi-chart-line', label: $t('landing.onboarding.plans.free.features.analytics') },
        { icon: 'i-mdi-account-group-outline', label: $t('landing.onboarding.plans.free.features.community') },
        { icon: 'i-mdi-credit-card-off-outline', label: $t('landing.onboarding.plans.free.features.noCard') },
      ],
    },
    {
      value: 'PRO',
      id: 'PRO',
      badge: $t('landing.pricing.plans.pro.badge'),
      name: $t('landing.pricing.plans.pro.name'),
      tagline: $t('landing.onboarding.plans.pro.tagline'),
      description: $t('landing.onboarding.plans.pro.description'),
      price: $t('landing.pricing.plans.pro.price'),
      priceSuffix: $t('landing.pricing.month'),
      icon: 'i-mdi-rocket-launch',
      color: 'primary',
      features: [
        { icon: 'i-mdi-auto-awesome', label: $t('landing.onboarding.plans.pro.features.tokens') },
        { icon: 'i-mdi-magnify-scan', label: $t('landing.onboarding.plans.pro.features.seo') },
        { icon: 'i-mdi-database-import-outline', label: $t('landing.onboarding.plans.pro.features.import') },
        { icon: 'i-mdi-cash-multiple', label: $t('landing.onboarding.plans.pro.features.revenue') },
        { icon: 'i-mdi-lifebuoy', label: $t('landing.onboarding.plans.pro.features.support') },
      ],
    },
    {
      value: 'PREMIUM',
      id: 'PREMIUM',
      badge: $t('landing.pricing.plans.premium.badge'),
      name: $t('landing.pricing.plans.premium.name'),
      tagline: $t('landing.onboarding.plans.premium.tagline'),
      description: $t('landing.onboarding.plans.premium.description'),
      price: $t('landing.pricing.plans.premium.price'),
      priceSuffix: $t('landing.pricing.month'),
      icon: 'i-mdi-crown',
      color: 'warning',
      features: [
        { icon: 'i-mdi-infinity', label: $t('landing.onboarding.plans.premium.features.unlimited') },
        { icon: 'i-mdi-image-auto-adjust', label: $t('landing.onboarding.plans.premium.features.sentiment') },
        { icon: 'i-mdi-google', label: $t('landing.onboarding.plans.premium.features.indexing') },
        { icon: 'i-mdi-palette-outline', label: $t('landing.onboarding.plans.premium.features.branding') },
        { icon: 'i-mdi-headset', label: $t('landing.onboarding.plans.premium.features.support') },
      ],
    },
  ]

  return items.map((item) => ({ ...item, summary: `${item.tagline} — ${item.description}` }))
})

const radioPlan = computed<RadioPlanId>({
  get: () => form.selectedPlan ?? 'FREE',
  set: (value) => {
    form.selectedPlan = value === 'FREE' ? null : value
  },
})

const selectedPlan = computed(() => plans.value.find((plan) => plan.id === form.selectedPlan))
const confirmLabel = computed(() =>
  selectedPlan.value?.id
    ? $t('landing.onboarding.continueWithPlan', { plan: selectedPlan.value.name })
    : $t('landing.onboarding.continueWithFree'),
)
</script>
