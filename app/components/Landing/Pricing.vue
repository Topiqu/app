<template>
  <section id="pricing" class="custom-ui relative py-32 px-6 overflow-hidden bg-slate-50 dark:bg-[#020408]">
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <div class="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px]"></div>
      <div class="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[100px]"></div>
    </div>

    <div class="relative max-w-[90rem] mx-auto z-10">
      <div class="text-center max-w-3xl mx-auto mb-20">
        <h2 class="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
          {{ $t('landing.pricing.title') }}
        </h2>
        <p class="text-xl text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
          {{ $t('landing.pricing.subtitle') }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch">
        <div
          class="group relative flex flex-col h-full bg-white dark:bg-[#0E0E0E] rounded-3xl border border-slate-200 dark:border-white/5 p-8 transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-lg hover:-translate-y-1"
        >
          <div class="mb-8">
            <div
              class="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4"
            >
              {{ $t('landing.pricing.plans.free.badge') }}
            </div>
            <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {{ $t('landing.pricing.plans.free.name') }}
            </h3>
            <p class="text-slate-500 text-sm h-10">{{ $t('landing.pricing.plans.free.desc') }}</p>
            <div class="mt-6 flex items-baseline gap-1">
              <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{
                $t('landing.pricing.plans.free.price')
              }}</span>
              <span class="text-slate-500 font-medium">{{ $t('landing.pricing.month') }}</span>
            </div>
          </div>

          <div class="w-full h-px bg-slate-100 dark:bg-white/5 mb-8"></div>

          <ul class="space-y-4 mb-8 flex-1">
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-slate-400 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.free.features.manual_writing') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-slate-400 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.free.features.subdomain') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-400 dark:text-slate-600">
              <Icon name="mdi:minus-circle-outline" class="mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.free.features.no_ai') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-400 dark:text-slate-600">
              <Icon name="mdi:minus-circle-outline" class="mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.free.features.basic_analytics') }}</span>
            </li>
          </ul>

          <div class="mt-auto">
            <div class="mb-6 pt-6 border-t border-slate-100 dark:border-white/5">
              <div
                class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2"
              >
                <span>{{ $t('landing.pricing.revenue_share') }}</span>
                <span>0%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-slate-300 w-0"></div>
              </div>
            </div>

            <Button
              variant="neutral"
              class="w-full !border-slate-200 dark:!border-white/10 hover:!bg-slate-50 dark:hover:!bg-white/5 !text-slate-900 dark:!text-white font-semibold py-6 rounded-xl"
            >
              {{ $t('landing.pricing.plans.free.cta') }}
            </Button>
          </div>
        </div>

        <div
          class="group relative flex flex-col h-full bg-white dark:bg-[#0E0E0E] rounded-3xl border border-indigo-100 dark:border-indigo-500/20 p-8 transition-all duration-300 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
        >
          <div class="mb-8">
            <div
              class="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4"
            >
              {{ $t('landing.pricing.plans.pro.badge') }}
            </div>
            <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {{ $t('landing.pricing.plans.pro.name') }}
            </h3>
            <p class="text-slate-500 text-sm h-10">{{ $t('landing.pricing.plans.pro.desc') }}</p>
            <div class="mt-6 flex items-baseline gap-1">
              <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{
                $t('landing.pricing.plans.pro.price')
              }}</span>
              <span class="text-slate-500 font-medium">{{ $t('landing.pricing.month') }}</span>
            </div>
          </div>

          <div class="w-full h-px bg-indigo-50 dark:bg-white/5 mb-8"></div>

          <ul class="space-y-4 mb-8 flex-1">
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
              <Icon name="mdi:check-circle" class="text-indigo-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.pro.features.ai_tokens') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-indigo-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.pro.features.seo') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-indigo-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.pro.features.import') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-500">
              <Icon name="mdi:plus" class="text-slate-400 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.pro.features.everything_free') }}</span>
            </li>
          </ul>

          <div class="mt-auto">
            <div class="mb-6 pt-6 border-t border-indigo-50 dark:border-white/5">
              <div
                class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2"
              >
                <span>{{ $t('landing.pricing.revenue_share') }}</span>
                <span class="text-indigo-600 dark:text-indigo-400">70%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 w-[70%]"></div>
              </div>
            </div>

            <Button
              variant="primary"
              class="w-full !bg-indigo-600 hover:!bg-indigo-500 !shadow-lg !shadow-indigo-500/20 py-6 rounded-xl"
            >
              {{ $t('landing.pricing.plans.pro.cta') }}
            </Button>
          </div>
        </div>

        <div
          class="group relative flex flex-col h-full bg-white dark:bg-[#0E0E0E] rounded-3xl border-2 border-violet-500 p-8 transition-all duration-300 shadow-2xl shadow-violet-500/10 hover:shadow-violet-500/20 hover:-translate-y-2 z-10"
        >
          <div class="mb-8 relative z-10">
            <div class="flex justify-between items-center mb-4">
              <div
                class="inline-flex items-center px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/10 text-xs font-bold text-violet-600 dark:text-violet-300 uppercase tracking-wider"
              >
                {{ $t('landing.pricing.plans.premium.badge') }}
              </div>
            </div>
            <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {{ $t('landing.pricing.plans.premium.name') }}
            </h3>
            <p class="text-slate-500 text-sm h-10">{{ $t('landing.pricing.plans.premium.desc') }}</p>
            <div class="mt-6 flex items-baseline gap-1">
              <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{
                $t('landing.pricing.plans.premium.price')
              }}</span>
              <span class="text-slate-500 font-medium">{{ $t('landing.pricing.month') }}</span>
            </div>
          </div>

          <div class="w-full h-px bg-violet-100 dark:bg-white/5 mb-8"></div>

          <ul class="space-y-4 mb-8 flex-1 relative z-10">
            <li class="flex items-start gap-3 text-sm text-slate-900 dark:text-white font-bold">
              <Icon name="mdi:star" class="text-violet-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.premium.features.sentiment') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
              <Icon name="mdi:check-circle" class="text-violet-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.premium.features.indexing') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
              <Icon name="mdi:check-circle" class="text-violet-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.premium.features.branding') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
              <Icon name="mdi:check-circle" class="text-violet-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.premium.features.support') }}</span>
            </li>
          </ul>

          <div class="mt-auto relative z-10">
            <div class="mb-6 pt-6 border-t border-violet-100 dark:border-white/5">
              <div
                class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2"
              >
                <span>{{ $t('landing.pricing.revenue_share') }}</span>
                <span class="text-violet-600 dark:text-violet-400">90%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-violet-500 w-[90%] shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
              </div>
            </div>

            <Button
              variant="primary"
              animation="softpop"
              class="w-full !bg-gradient-to-r !from-violet-600 !to-indigo-600 hover:!from-violet-500 hover:!to-indigo-500 !shadow-lg !shadow-violet-500/30 !border-0 text-white py-6 rounded-xl"
              @click="$emit('startOnboarding')"
            >
              {{ $t('landing.pricing.plans.premium.cta') }}
            </Button>
          </div>
        </div>

        <div
          class="group relative flex flex-col h-full bg-white dark:bg-[#0E0E0E] rounded-3xl border border-amber-200 dark:border-amber-500/20 p-8 transition-all duration-300 hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1"
        >
          <div class="mb-8">
            <div
              class="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-4"
            >
              {{ $t('landing.pricing.plans.custom.badge') }}
            </div>
            <h3 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {{ $t('landing.pricing.plans.custom.name') }}
            </h3>
            <p class="text-slate-500 text-sm h-10">{{ $t('landing.pricing.plans.custom.desc') }}</p>
            <div class="mt-6 flex items-baseline gap-1">
              <span class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{{
                $t('landing.pricing.plans.custom.price')
              }}</span>
            </div>
          </div>

          <div class="w-full h-px bg-amber-100 dark:bg-white/5 mb-8"></div>

          <ul class="space-y-4 mb-8 flex-1">
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 font-bold">
              <Icon name="mdi:crown" class="text-amber-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.custom.features.domain') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-amber-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.custom.features.whitelabel') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-amber-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.custom.features.banners') }}</span>
            </li>
            <li class="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <Icon name="mdi:check-circle" class="text-amber-500 mt-0.5 shrink-0" />
              <span>{{ $t('landing.pricing.plans.custom.features.unlimited_ai') }}</span>
            </li>
          </ul>

          <div class="mt-auto">
            <div class="mb-6 pt-6 border-t border-amber-50 dark:border-white/5">
              <div
                class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2"
              >
                <span>{{ $t('landing.pricing.revenue_share') }}</span>
                <span class="text-amber-600 dark:text-amber-400">100%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full bg-amber-500 w-full"></div>
              </div>
            </div>

            <Button
              variant="neutral"
              class="w-full !bg-slate-900 dark:!bg-white !text-white dark:!text-slate-900 hover:!bg-slate-800 dark:hover:!bg-slate-200 py-6 rounded-xl"
            >
              {{ $t('landing.pricing.plans.custom.cta') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'startOnboarding'): void
}>()
</script>
