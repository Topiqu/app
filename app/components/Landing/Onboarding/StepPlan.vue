<template>
  <div class="space-y-7">
    <h3 class="text-2xl font-extrabold text-[#111] dark:text-white tracking-tight flex items-center gap-3">
      <Icon name="mdi:crown-outline" class="w-7 h-7 text-[#7E22CE] dark:text-[#D8B4FE]" />
      {{ $t('landing.onboarding.choosePlan') }}
    </h3>

    <div
      class="flex items-center gap-3 rounded-2xl px-4 py-3 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-500/15 dark:to-indigo-500/15 border-2 border-violet-300/60 dark:border-violet-500/30"
      role="note"
    >
      <Icon name="mdi:gift-outline" class="w-6 h-6 shrink-0 text-violet-700 dark:text-violet-300" />
      <span class="text-sm font-bold text-violet-900 dark:text-violet-100 tracking-tight">
        {{ $t('landing.onboarding.planTrialBanner') }}
      </span>
    </div>

    <div
      class="relative h-[520px] flex items-center justify-center select-none"
      role="radiogroup"
      :aria-label="$t('landing.onboarding.planNavLabel')"
      @keydown.left.prevent="prev"
      @keydown.right.prevent="next"
      @keydown.home.prevent="active = 0"
      @keydown.end.prevent="active = plans.length - 1"
    >
      <button
        type="button"
        :aria-label="$t('landing.onboarding.planNavPrev')"
        class="absolute -left-1 sm:left-0 z-40 w-12 h-12 rounded-full bg-[#111] dark:bg-white text-white dark:text-[#111] ring-4 ring-[#FAFAFA] dark:ring-[#18181B] shadow-[4px_4px_0_0_#D8B4FE] hover:translate-x-[-2px] active:translate-x-0 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D8B4FE] transition-all flex items-center justify-center"
        @click="prev"
      >
        <Icon name="mdi:chevron-left" class="w-7 h-7 text-white dark:text-[#111]" />
      </button>

      <div
        class="relative w-full h-full"
        style="perspective: 1400px; transform-style: preserve-3d"
      >
        <div
          v-for="(plan, idx) in plans"
          :key="plan.id ?? 'free'"
          class="absolute top-1/2 left-1/2 w-[320px] h-[480px] rounded-3xl will-change-transform cursor-pointer focus-visible:outline-none"
          :style="cardStyle(idx)"
          :aria-checked="active === idx"
          :aria-label="$t('landing.onboarding.planGoTo', { plan: plan.name })"
          role="radio"
          :tabindex="active === idx ? 0 : -1"
          @click="onCardClick(idx)"
          @keydown.enter.prevent="onCardClick(idx)"
          @keydown.space.prevent="onCardClick(idx)"
        >
          <div
            class="w-full h-full rounded-3xl p-6 flex flex-col text-left transition-shadow duration-300"
            :class="[
              plan.cardClass,
              active === idx
                ? 'shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] ring-2 ring-offset-2 ring-offset-[#FAFAFA] dark:ring-offset-[#18181B]'
                : 'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)]',
              active === idx ? plan.ringClass : '',
            ]"
          >
            <div class="flex items-center justify-between mb-4">
              <span
                class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                :class="plan.badgeClass"
              >
                {{ plan.badge }}
              </span>
              <Icon :name="plan.icon" class="w-7 h-7" :class="plan.iconClass" />
            </div>

            <h4 class="text-3xl font-black tracking-tight mb-1" :class="plan.titleClass">
              {{ plan.name }}
            </h4>
            <p class="text-xs font-bold uppercase tracking-wider mb-3" :class="plan.subClass">
              {{ plan.tagline }}
            </p>
            <p class="text-[13px] font-medium leading-relaxed mb-5" :class="plan.featureClass">
              {{ plan.description }}
            </p>

            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-black tracking-tight" :class="plan.titleClass">{{ plan.price }}</span>
              <span class="text-sm font-bold" :class="plan.subClass">{{ plan.priceSuffix }}</span>
            </div>

            <ul class="space-y-2 flex-1">
              <li
                v-for="(feat, i) in plan.features"
                :key="i"
                class="flex items-start gap-2 text-[13px] font-semibold leading-snug"
                :class="plan.featureClass"
              >
                <Icon :name="feat.icon" class="w-4 h-4 mt-0.5 shrink-0" :class="plan.iconClass" />
                <span>{{ feat.label }}</span>
              </li>
            </ul>

            <div
              v-if="plan.highlight"
              class="mt-3 text-[11px] font-black uppercase tracking-widest text-center px-2 py-1.5 rounded-lg"
              :class="plan.highlightClass"
            >
              {{ plan.highlight }}
            </div>

            <div
              v-if="form.selectedPlan === plan.id || (plan.id === null && form.selectedPlan === null)"
              class="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest"
              :class="plan.selectedBadgeClass"
            >
              <Icon name="mdi:check-circle" class="w-4 h-4" />
              {{ $t('landing.onboarding.planSelected') }}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        :aria-label="$t('landing.onboarding.planNavNext')"
        class="absolute -right-1 sm:right-0 z-40 w-12 h-12 rounded-full bg-[#111] dark:bg-white text-white dark:text-[#111] ring-4 ring-[#FAFAFA] dark:ring-[#18181B] shadow-[4px_4px_0_0_#D8B4FE] hover:translate-x-[2px] active:translate-x-0 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D8B4FE] transition-all flex items-center justify-center"
        @click="next"
      >
        <Icon name="mdi:chevron-right" class="w-7 h-7 text-white dark:text-[#111]" />
      </button>
    </div>

    <span class="sr-only" aria-live="polite">
      {{ $t('landing.onboarding.planActiveAnnounce', { plan: plans[active]?.name ?? '' }) }}
    </span>

    <div class="flex justify-center gap-2">
      <button
        v-for="(plan, idx) in plans"
        :key="`dot-${plan.id ?? 'skip'}`"
        type="button"
        :aria-label="$t('landing.onboarding.planGoTo', { plan: plan.name })"
        :aria-current="active === idx ? 'true' : undefined"
        class="h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111] dark:focus-visible:ring-white focus-visible:ring-offset-[#FAFAFA] dark:focus-visible:ring-offset-[#18181B]"
        :class="active === idx ? 'w-8 bg-[#111] dark:bg-white' : 'w-2 bg-[#D4D4D8] dark:bg-[#52525B] hover:bg-[#A1A1AA]'"
        @click="active = idx"
      />
    </div>

    <div class="flex gap-4 mt-2">
      <Button
        type="button"
        variant="neutral"
        size="lg"
        class="w-1/3 bg-[#F0F0F0] hover:bg-[#E5E5E5] dark:bg-[#27272A] dark:hover:bg-[#3F3F46] text-[#111] dark:text-white border-none rounded-2xl py-5 text-lg font-black transition-colors"
        @click="goBack(3)"
      >
        {{ $t('common.actions.back') }}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        class="w-2/3 bg-[#111] hover:bg-[#222] dark:bg-white dark:hover:bg-[#F0F0F0] text-white dark:text-[#111] border-none rounded-2xl py-5 text-lg shadow-[0_6px_0_0_#D8B4FE] active:shadow-none active:translate-y-[6px] transition-all"
        icon="mdi:arrow-right"
        iconPosition="right"
      >
        <span class="font-black tracking-wide">{{ confirmLabel }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
type PlanId = 'PRO' | 'PREMIUM' | null

interface PlanCard {
  id: PlanId
  badge: string
  name: string
  tagline: string
  description: string
  price: string
  priceSuffix: string
  icon: string
  features: { icon: string; label: string }[]
  highlight?: string
  cardClass: string
  badgeClass: string
  titleClass: string
  subClass: string
  featureClass: string
  iconClass: string
  ringClass: string
  highlightClass: string
  selectedBadgeClass: string
}

const { form, goBack } = useOnboarding()

const plans = computed<PlanCard[]>(() => [
  {
    id: null,
    badge: $t('landing.pricing.plans.free.badge'),
    name: $t('landing.pricing.plans.free.name'),
    tagline: $t('landing.onboarding.plans.free.tagline'),
    description: $t('landing.onboarding.plans.free.description'),
    price: $t('landing.pricing.plans.free.price'),
    priceSuffix: $t('landing.pricing.month'),
    icon: 'mdi:leaf',
    features: [
      { icon: 'mdi:pencil-outline', label: $t('landing.onboarding.plans.free.features.editor') },
      { icon: 'mdi:web', label: $t('landing.onboarding.plans.free.features.subdomain') },
      { icon: 'mdi:chart-line', label: $t('landing.onboarding.plans.free.features.analytics') },
      { icon: 'mdi:account-group-outline', label: $t('landing.onboarding.plans.free.features.community') },
      { icon: 'mdi:credit-card-off-outline', label: $t('landing.onboarding.plans.free.features.noCard') },
    ],
    cardClass: 'bg-[#FAFAFA] dark:bg-[#18181B] border-[3px] border-[#E5E5E5] dark:border-[#3F3F46]',
    badgeClass: 'bg-[#E5E5E5] dark:bg-[#27272A] text-[#555] dark:text-[#A1A1AA]',
    titleClass: 'text-[#111] dark:text-white',
    subClass: 'text-[#888] dark:text-[#71717A]',
    featureClass: 'text-[#555] dark:text-[#A1A1AA]',
    iconClass: 'text-[#888] dark:text-[#A1A1AA]',
    ringClass: 'ring-[#111] dark:ring-white',
    highlightClass: 'bg-[#E5E5E5] dark:bg-[#27272A] text-[#555] dark:text-[#A1A1AA]',
    selectedBadgeClass: 'bg-[#111] dark:bg-white text-white dark:text-[#111]',
  },
  {
    id: 'PRO',
    badge: $t('landing.pricing.plans.pro.badge'),
    name: $t('landing.pricing.plans.pro.name'),
    tagline: $t('landing.onboarding.plans.pro.tagline'),
    description: $t('landing.onboarding.plans.pro.description'),
    price: $t('landing.pricing.plans.pro.price'),
    priceSuffix: $t('landing.pricing.month'),
    icon: 'mdi:rocket-launch',
    features: [
      { icon: 'mdi:auto-awesome', label: $t('landing.onboarding.plans.pro.features.tokens') },
      { icon: 'mdi:magnify-scan', label: $t('landing.onboarding.plans.pro.features.seo') },
      { icon: 'mdi:database-import-outline', label: $t('landing.onboarding.plans.pro.features.import') },
      { icon: 'mdi:cash-multiple', label: $t('landing.onboarding.plans.pro.features.revenue') },
      { icon: 'mdi:lifebuoy', label: $t('landing.onboarding.plans.pro.features.support') },
    ],
    cardClass: 'bg-white dark:bg-[#0E0E0E] border-[3px] border-indigo-200 dark:border-indigo-500/40',
    badgeClass: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    titleClass: 'text-indigo-700 dark:text-indigo-200',
    subClass: 'text-indigo-500/80 dark:text-indigo-400/70',
    featureClass: 'text-slate-700 dark:text-slate-200',
    iconClass: 'text-indigo-500',
    ringClass: 'ring-indigo-500',
    highlightClass: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
    selectedBadgeClass: 'bg-indigo-600 text-white',
  },
  {
    id: 'PREMIUM',
    badge: $t('landing.pricing.plans.premium.badge'),
    name: $t('landing.pricing.plans.premium.name'),
    tagline: $t('landing.onboarding.plans.premium.tagline'),
    description: $t('landing.onboarding.plans.premium.description'),
    price: $t('landing.pricing.plans.premium.price'),
    priceSuffix: $t('landing.pricing.month'),
    icon: 'mdi:crown',
    features: [
      { icon: 'mdi:infinity', label: $t('landing.onboarding.plans.premium.features.unlimited') },
      { icon: 'mdi:image-auto-adjust', label: $t('landing.onboarding.plans.premium.features.sentiment') },
      { icon: 'mdi:google', label: $t('landing.onboarding.plans.premium.features.indexing') },
      { icon: 'mdi:palette-outline', label: $t('landing.onboarding.plans.premium.features.branding') },
      { icon: 'mdi:headset', label: $t('landing.onboarding.plans.premium.features.support') },
    ],
    highlight: $t('landing.onboarding.plans.premium.highlight'),
    cardClass:
      'bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border-[3px] border-violet-500',
    badgeClass: 'bg-violet-600 text-white',
    titleClass: 'text-violet-700 dark:text-violet-200',
    subClass: 'text-violet-500 dark:text-violet-300/70',
    featureClass: 'text-slate-800 dark:text-slate-100',
    iconClass: 'text-violet-500',
    ringClass: 'ring-violet-500',
    highlightClass: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
    selectedBadgeClass: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
  },
])

const initialIdx = (() => {
  if (form.selectedPlan === 'PRO') return 1
  if (form.selectedPlan === 'PREMIUM') return 2
  return 2
})()
const active = shallowRef(initialIdx)

watchEffect(() => {
  const plan = plans.value[active.value]
  if (plan) form.selectedPlan = plan.id
})

const next = () => {
  active.value = (active.value + 1) % plans.value.length
}
const prev = () => {
  active.value = (active.value - 1 + plans.value.length) % plans.value.length
}
const onCardClick = (idx: number) => {
  if (idx === active.value) return
  active.value = idx
}

const cardStyle = (idx: number) => {
  const offset = idx - active.value
  const total = plans.value.length
  let dist = offset
  if (dist > total / 2) dist -= total
  if (dist < -total / 2) dist += total

  const abs = Math.abs(dist)
  const translateX = dist * 210
  const translateZ = -Math.min(abs, 2) * 240
  const rotateY = dist * -28
  const scale = abs === 0 ? 1 : abs === 1 ? 0.82 : 0.65
  const opacity = abs > 2 ? 0 : abs === 0 ? 1 : abs === 1 ? 0.6 : 0.3
  const zIndex = 20 - abs

  return {
    transform: `translate(-50%, -50%) translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex,
    transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
    pointerEvents: abs > 1 ? 'none' : 'auto',
    filter: abs === 0 ? 'none' : 'saturate(0.85)',
  } as Record<string, string | number>
}

const confirmLabel = computed(() => {
  const plan = plans.value[active.value]
  if (!plan?.id) return $t('landing.onboarding.continueWithFree')
  return $t('landing.onboarding.continueWithPlan', { plan: plan.name })
})
</script>
