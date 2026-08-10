<template>
  <section id="pricing" class="bg-muted/30 px-6 py-24">
    <UContainer>
      <div class="mx-auto mb-14 max-w-3xl text-center">
        <h2 class="mb-4 text-4xl font-black tracking-tight md:text-5xl">{{ $t('landing.pricing.title') }}</h2>
        <p class="text-xl text-muted">{{ $t('landing.pricing.subtitle') }}</p>
      </div>

      <UPricingPlans :plans="plans" scale class="grid-cols-1 md:grid-cols-2 xl:grid-cols-4" />
    </UContainer>
  </section>
</template>

<script setup lang="ts">
import type { PricingPlanProps } from '@nuxt/ui'

const emit = defineEmits<{ startOnboarding: [] }>()

const feature = (plan: string, key: string) => $t(`landing.pricing.plans.${plan}.features.${key}`)
const plans = computed<PricingPlanProps[]>(() => [
  {
    title: $t('landing.pricing.plans.free.name'),
    description: $t('landing.pricing.plans.free.desc'),
    badge: $t('landing.pricing.plans.free.badge'),
    price: $t('landing.pricing.plans.free.price'),
    billingCycle: $t('landing.pricing.month'),
    features: [feature('free', 'manual_writing'), feature('free', 'subdomain'), feature('free', 'no_ai')],
    terms: `${$t('landing.pricing.revenue_share')}: 0%`,
    button: { label: $t('landing.pricing.plans.free.cta'), color: 'neutral', variant: 'outline', block: true },
  },
  {
    title: $t('landing.pricing.plans.pro.name'),
    description: $t('landing.pricing.plans.pro.desc'),
    badge: { label: $t('landing.pricing.plans.pro.badge'), color: 'primary', variant: 'subtle' },
    price: $t('landing.pricing.plans.pro.price'),
    billingCycle: $t('landing.pricing.month'),
    features: [
      feature('pro', 'ai_tokens'),
      feature('pro', 'seo'),
      feature('pro', 'import'),
      feature('pro', 'everything_free'),
    ],
    terms: `${$t('landing.pricing.revenue_share')}: 70%`,
    button: { label: $t('landing.pricing.plans.pro.cta'), block: true },
  },
  {
    title: $t('landing.pricing.plans.premium.name'),
    description: $t('landing.pricing.plans.premium.desc'),
    badge: { label: $t('landing.pricing.plans.premium.badge'), color: 'primary', variant: 'solid' },
    price: $t('landing.pricing.plans.premium.price'),
    billingCycle: $t('landing.pricing.month'),
    features: [
      feature('premium', 'sentiment'),
      feature('premium', 'indexing'),
      feature('premium', 'branding'),
      feature('premium', 'support'),
    ],
    terms: `${$t('landing.pricing.revenue_share')}: 90%`,
    highlight: true,
    scale: true,
    button: {
      label: $t('landing.pricing.plans.premium.cta'),
      block: true,
      onClick: () => emit('startOnboarding'),
    },
  },
  {
    title: $t('landing.pricing.plans.custom.name'),
    description: $t('landing.pricing.plans.custom.desc'),
    badge: { label: $t('landing.pricing.plans.custom.badge'), color: 'warning', variant: 'subtle' },
    price: $t('landing.pricing.plans.custom.price'),
    features: [
      feature('custom', 'domain'),
      feature('custom', 'whitelabel'),
      feature('custom', 'banners'),
      feature('custom', 'unlimited_ai'),
    ],
    terms: `${$t('landing.pricing.revenue_share')}: 100%`,
    button: { label: $t('landing.pricing.plans.custom.cta'), color: 'neutral', block: true },
  },
])
</script>
