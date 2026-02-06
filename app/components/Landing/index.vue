<template>
  <div
    class="min-h-screen bg-[#F8FAFC] dark:bg-[#020408] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden"
  >
    <div class="fixed inset-0 z-0 pointer-events-none">
      <div
        class="absolute top-0 right-0 w-[50rem] h-[50rem] bg-indigo-500/10 dark:bg-indigo-500/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-50 animate-pulse"
      ></div>
      <div
        class="absolute bottom-0 left-0 w-[50rem] h-[50rem] bg-emerald-500/10 dark:bg-emerald-500/5 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen opacity-50"
      ></div>
      <div
        class="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      ></div>
    </div>

    <div class="relative z-10">
      <LandingHero @scroll="scrollToSection" />

      <section id="specs" class="py-24 px-6 relative border-t border-slate-200 dark:border-white/5">
        <div class="max-w-7xl mx-auto">
          <div class="text-center max-w-3xl mx-auto mb-20">
            <h2 class="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {{ $t('landing.specs.title') }}
            </h2>
            <p class="text-lg text-slate-700 dark:text-slate-300 font-medium">
              {{ $t('landing.specs.subtitle') }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)]">
            <div
              class="md:col-span-2 group relative p-8 rounded-3xl bg-white dark:bg-[#0E0E0E] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300 overflow-hidden"
            >
              <div
                class="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors"
              ></div>

              <div class="relative z-10">
                <div class="flex items-center gap-3 mb-6">
                  <div class="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-700 dark:text-indigo-400">
                    <Icon name="mdi:robot-happy-outline" size="28" />
                  </div>
                  <span
                    class="px-3 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-full uppercase tracking-wider text-slate-700 dark:text-slate-300"
                  >
                    {{ $t('landing.specs.ai.badge') }}
                  </span>
                </div>

                <h3
                  class="text-2xl font-bold text-slate-900 dark:text-white mb-4 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors"
                >
                  {{ $t('landing.specs.ai.title') }}
                </h3>
                <p class="text-slate-700 dark:text-slate-300 mb-8 leading-relaxed max-w-lg">
                  {{ $t('landing.specs.ai.desc') }}
                </p>

                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(tag, key) in ['enhance', 'vibe', 'helpfulness']"
                    :key="key"
                    class="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    <Icon name="mdi:check-decagram" size="14" class="text-indigo-600 dark:text-indigo-400" />
                    {{ $t(`landing.specs.ai.tags.${tag}`) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              class="md:row-span-2 p-8 rounded-3xl bg-slate-900 dark:bg-gradient-to-b dark:from-[#151515] dark:to-black text-white border border-slate-800 dark:border-slate-800 shadow-xl flex flex-col justify-between group overflow-hidden relative"
            >
              <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

              <div class="relative z-10">
                <div class="p-3 bg-emerald-500/20 w-fit rounded-xl text-emerald-400 mb-6">
                  <Icon name="mdi:currency-usd" size="32" />
                </div>
                <h3 class="text-2xl font-bold mb-4 text-white">
                  {{ $t('landing.specs.monetization.title') }}
                </h3>
                <p class="text-slate-200 leading-relaxed text-sm mb-6">
                  {{ $t('landing.specs.monetization.desc') }}
                </p>
              </div>

              <div class="relative h-32 w-full mt-4">
                <div class="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 px-2">
                  <div class="w-1/5 bg-emerald-500/30 h-[40%] rounded-t-sm"></div>
                  <div class="w-1/5 bg-emerald-500/50 h-[60%] rounded-t-sm"></div>
                  <div class="w-1/5 bg-emerald-500/70 h-[50%] rounded-t-sm"></div>
                  <div class="w-1/5 bg-emerald-500/90 h-[80%] rounded-t-sm"></div>
                  <div class="w-1/5 bg-emerald-400 h-[95%] rounded-t-sm shadow-[0_0_15px_rgba(52,211,153,0.5)]"></div>
                </div>
              </div>
            </div>

            <div
              class="p-8 rounded-3xl bg-white dark:bg-[#0E0E0E] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-red-500/30 transition-colors"
            >
              <div class="flex items-center gap-3 mb-6">
                <div class="p-2.5 bg-red-50 dark:bg-red-500/10 rounded-xl text-red-600 dark:text-red-500">
                  <Icon name="mdi:shield-check" size="28" />
                </div>
                <h3 class="text-xl font-bold text-slate-900 dark:text-white">
                  {{ $t('landing.specs.security.title') }}
                </h3>
              </div>
              <ul class="space-y-3">
                <li class="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  Admin & Reader Roles
                </li>
                <li class="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  Secure Auth
                </li>
                <li class="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <div class="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  Data Encryption
                </li>
              </ul>
            </div>

            <div
              class="p-8 rounded-3xl bg-white dark:bg-[#0E0E0E] border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/30 transition-colors"
            >
              <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white">
                  {{ $t('landing.specs.api.title') }}
                </h3>
                <span
                  class="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400"
                  >JSON/REST</span
                >
              </div>
              <p class="text-sm text-slate-700 dark:text-slate-300 mb-6">
                {{ $t('landing.specs.api.desc') }}
              </p>
              <div
                class="p-3 bg-slate-900 rounded-lg overflow-hidden font-mono text-[10px] md:text-xs text-indigo-300 border border-slate-800"
              >
                <span class="text-purple-400">const</span> { data } = <span class="text-purple-400">useFetch</span>(...)
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingPricing />

      <LandingFaq />

      <footer class="py-12 px-6 border-t border-slate-200 dark:border-white/10 text-center bg-white dark:bg-[#020408]">
        <div class="flex flex-col items-center justify-center gap-4 mb-8">
          <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
            <NuxtImg
              src="/topik_normal_rm.png"
              width="48"
              class="grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all"
            />
          </div>
          <p class="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-sm mx-auto">
            {{ $t('landing.footer.desc') }}
          </p>
        </div>

        <div class="flex justify-center gap-8 text-sm font-bold text-slate-700 dark:text-slate-300 mb-8">
          <NuxtLink to="/terms" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{{
            $t('common.links.terms')
          }}</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{{
            $t('common.links.privacy')
          }}</NuxtLink>
          <NuxtLink
            to="/status"
            class="flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
            {{ $t('common.links.status') }}
          </NuxtLink>
        </div>

        <p class="text-xs text-slate-400">
          &copy; {{ new Date().getFullYear() }} Topiqu {{ $t('landing.footer.rights') }}
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
const scrollToSection = (id: string) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>
