<template>
  <div
    class="fixed bottom-3 right-3 z-overlay flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:bg-neutral-900/85 dark:text-gray-400 dark:ring-1 dark:ring-white/10"
  >
    <span class="flex items-center gap-1">
      Topiqu AI Blog
      <span v-if="site?.name" class="font-semibold italic text-gray-800 dark:text-gray-200">{{ site.name }}</span>
      <span class="tabular-nums text-gray-400 dark:text-gray-500">{{ config.public.appVersion }}</span>
    </span>

    <span class="h-3 w-px bg-gray-200 dark:bg-neutral-700/70" />

    <!-- No UnoCSS reset is loaded, so the UA button chrome and base.scss's global `button` rules
         have to be cancelled here; the dark: duplicates exist only to out-specify those rules. -->
    <button
      ref="trigger"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="$t('articles.userMenu.remainingTokens')"
      class="-mx-1 flex appearance-none items-center gap-1.5 rounded-full border-0 bg-transparent px-1 text-inherit outline-none transition-opacity duration-200 hover:bg-transparent hover:opacity-70 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-transparent dark:hover:bg-transparent dark:focus-visible:ring-offset-neutral-900"
      @click="show = !show"
    >
      <span :class="['text-[10px] font-bold uppercase tracking-wide', planChip]">
        {{ site?.plan ?? $t('articles.userMenu.noClientAssigned') }}
      </span>

      <span v-if="hasTokenPlan" v-tippy="tokenTooltip" class="flex items-center gap-1.5">
        <span v-if="isLowTokens" class="relative flex h-1.5 w-1.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
        <span class="tabular-nums">
          <span :class="tokenColor">{{ fmt(tokenRemaining) }}</span>
        </span>
      </span>

      <Icon
        name="mdi:chevron-up"
        :class="['h-3 w-3 text-gray-400 transition-transform duration-200', isOpen && 'rotate-180']"
      />
    </button>

    <Transition
      enterActiveClass="transition ease-out duration-200"
      enterFromClass="opacity-0 translate-y-1 scale-95"
      enterToClass="opacity-100 translate-y-0 scale-100"
      leaveActiveClass="transition ease-in duration-150"
      leaveFromClass="opacity-100 translate-y-0 scale-100"
      leaveToClass="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="isOpen"
        ref="panel"
        :aria-label="$t('articles.userMenu.remainingTokens')"
        role="region"
        class="absolute bottom-full right-0 mb-2 w-[21rem] max-w-[calc(100vw_-_1.5rem)] origin-bottom-right divide-y divide-gray-200 rounded-2xl bg-white/95 p-4 text-left shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/5 backdrop-blur-xl dark:divide-neutral-700 dark:bg-neutral-900/95 dark:ring-white/10"
      >
        <section v-if="hasTokenPlan" class="space-y-2.5 pb-4">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-500">
              {{ $t('articles.userMenu.remainingTokens') }}
            </h3>
            <span class="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
              {{ $t('articles.userMenu.roughlyEstimated', [estimatedArticles]) }}
            </span>
          </div>

          <div class="flex items-baseline gap-1.5">
            <span :class="['text-2xl font-semibold leading-none tracking-tight tabular-nums', headlineColor]">
              {{ fmt(tokenRemaining) }}
            </span>
          </div>

          <div v-if="!balanceIncludesExtras" class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-neutral-700">
            <div
              :class="['h-full rounded-full transition-[width] duration-700 ease-out', barColor]"
              :style="{ width: `${remainingPercent}%` }"
            />
          </div>

          <p v-else class="text-[11px] text-gray-500 dark:text-gray-500">
            {{ $t('articles.userMenu.balanceIncludesExtras', [fmt(tokenLimit)]) }}
          </p>

          <p class="text-[11px] text-gray-500 dark:text-gray-500">
            {{ $t('articles.userMenu.totalConsumed', [fmt(totalUsage)]) }}
          </p>
        </section>

        <section class="space-y-2 py-4">
          <h4 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-500">
            {{ $t('articles.userMenu.buyTokens') }}
          </h4>

          <div class="space-y-1.5">
            <button
              v-for="pack in packs"
              :key="pack.id"
              type="button"
              :disabled="pendingPack !== null"
              :class="[
                'group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.05),0_1px_1px_rgba(0,0,0,0.03)] outline-none transition duration-200 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60',
                pack.featured
                  ? 'border-violet-400 bg-violet-50 hover:bg-violet-100/70 dark:border-violet-500/50 dark:bg-violet-500/10 dark:hover:bg-violet-500/15'
                  : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:bg-neutral-800',
              ]"
              @click="buyTokens(pack.id)"
            >
              <span
                :class="[
                  'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                  pack.featured
                    ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_4px_12px_-4px_rgba(139,92,246,0.7)]'
                    : 'border border-gray-200 bg-gray-50 text-gray-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-400',
                ]"
              >
                <Icon v-if="pendingPack === pack.id" name="i-lucide:loader" class="h-4 w-4 animate-spin" />
                <Icon v-else :name="pack.icon" class="h-4 w-4" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                    {{ pack.name }}
                  </span>
                  <span
                    v-if="pack.featured"
                    class="shrink-0 rounded-full bg-violet-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-400/20 dark:text-violet-200"
                  >
                    {{ $t('common.tokens.bestValue') }}
                  </span>
                </span>
                <span class="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                  {{ $t('articles.userMenu.roughlyEstimated', [pack.articles]) }}
                </span>
              </span>

              <span class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {{ pack.price }}
              </span>
            </button>

            <Button
              v-if="upgradeTarget"
              variant="transparent"
              icon="mdi:rocket-launch"
              class="w-full text-[13px] font-semibold text-emerald-700 dark:text-emerald-300"
              @click="upgrade"
            >
              {{ $t('common.preferences.billing.upgrade', { plan: upgradeTarget }) }}
            </Button>
          </div>
        </section>

        <section v-if="isLowTokens" class="py-4">
          <div
            class="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-500/30 dark:bg-red-500/10"
          >
            <Icon name="mdi:alert" class="mt-px h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
            <p class="text-[11px] leading-relaxed text-red-800 dark:text-red-200">
              <strong class="font-semibold">{{ $t('articles.userMenu.lowTokensWarning') }}</strong>
              {{ $t('articles.userMenu.lowTokensHint', { percent: LOW_TOKEN_PERCENT }) }}
            </p>
          </div>
        </section>

        <section class="space-y-2 py-4">
          <h4 class="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-500">
            {{ $t('articles.userMenu.recentActions') }}
          </h4>

          <div class="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto pr-1">
            <div
              v-for="log in logs.items"
              :key="log.id"
              class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              <span :class="['grid h-7 w-7 shrink-0 place-items-center rounded-md', logTone(log.action)]">
                <Icon :name="getLogIcon(log.action)" class="h-3.5 w-3.5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                  {{ formatAction(log.action) }}
                </span>
                <span class="block text-[10px] text-gray-500 dark:text-gray-500">{{ formatDate(log.createdAt) }}</span>
              </span>
            </div>

            <Button
              v-if="logs.hasMore"
              size="sm"
              variant="transparent"
              animation="softpop"
              borderless
              class="w-full text-[11px] font-medium text-gray-500 dark:text-gray-400"
              @click="loadMore"
            >
              {{ $t('common.pagination.next') }}
            </Button>
          </div>
        </section>

        <section class="space-y-2.5 pt-4">
          <div v-if="site?.gtagId || site?.gamNetworkCode" class="flex flex-wrap items-center gap-1.5">
            <span
              v-if="site?.gtagId"
              class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              <Icon name="mdi:google-analytics" class="h-3 w-3" />
              {{ $t('articles.userMenu.ga4Connected') }}
            </span>
            <span
              v-if="site?.gamNetworkCode"
              class="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300"
            >
              <Icon name="mdi:google-ads" class="h-3 w-3" />
              {{ $t('articles.userMenu.gamConnected') }}
            </span>
          </div>

          <p class="border-l-2 border-blue-500/40 pl-2.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
            <strong class="font-semibold text-gray-800 dark:text-gray-200">{{ $t('articles.userMenu.tip') }}:</strong>
            {{ $t('articles.userMenu.adjustPreferences') }}
          </p>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { getUpgradeTarget } from '~~/shared/utils/plans'

import { buildTokenPackViews, TOKENS_PER_ARTICLE } from '~/utils/tokenPackPresentation'

const LOW_TOKEN_PERCENT = 20

const config = useRuntimeConfig()
const { locale } = useI18n()
const { data: session } = useAuth()
const { data: site } = await useFetch(`/api/clients/${session.value?.user.id}/by-userid`)
const { data: status } = await useClientSiteStatus()

const page = shallowRef(1)
const logs = reactive<{ items: any[]; hasMore: boolean }>({ items: [], hasMore: false })

const { data: response, refresh } = await useFetch(
  () => `/api/clients/${site.value?.id}/log?page=${page.value}&limit=20`,
  {
    default: () => ({ items: [], hasMore: false }),
    watch: false,
  },
)

watch(
  response,
  (newData) => {
    if (newData?.items) {
      logs.items.push(...newData.items)
      logs.hasMore = newData.hasMore
    }
  },
  { immediate: true },
)

const loadMore = async () => {
  if (!logs.hasMore) return
  page.value++
  await refresh()
}

const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const fmt = (n: number) => numberFormat.value.format(n)

const packs = computed(() => buildTokenPackViews($t, locale.value))

const tokenRemaining = computed(() => status.value?.tokenRemaining ?? 0)
const tokenLimit = computed(() => status.value?.tokenLimit ?? 0)
const totalUsage = computed(() => status.value?.totalUsage ?? 0)
const hasTokenPlan = computed(() => tokenLimit.value > 0)
const balanceIncludesExtras = computed(() => tokenRemaining.value > tokenLimit.value)

const remainingPercent = computed(() =>
  hasTokenPlan.value ? Math.min(100, Math.max(0, (tokenRemaining.value / tokenLimit.value) * 100)) : 0,
)
const isLowTokens = computed(() => hasTokenPlan.value && remainingPercent.value <= LOW_TOKEN_PERCENT)
const estimatedArticles = computed(() => Math.floor(tokenRemaining.value / TOKENS_PER_ARTICLE))
const tokenTooltip = computed(() => $t('articles.userMenu.roughlyEstimated', [estimatedArticles.value]))

const barColor = computed(() =>
  remainingPercent.value <= LOW_TOKEN_PERCENT
    ? 'bg-gradient-to-r from-red-500 to-rose-500'
    : remainingPercent.value <= 40
      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
      : 'bg-gradient-to-r from-emerald-400 to-teal-500',
)
const headlineColor = computed(() =>
  isLowTokens.value ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
)
const tokenColor = computed(() =>
  isLowTokens.value ? 'font-semibold text-red-600 dark:text-red-400' : 'font-semibold text-gray-700 dark:text-gray-300',
)

const planChip = computed(() => {
  switch (site.value?.plan) {
    case 'BASIC':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'PRO':
      return 'text-blue-600 dark:text-blue-400'
    case 'PREMIUM':
      return 'text-amber-600 dark:text-amber-400'
    case 'CUSTOM':
      return 'text-orange-600 dark:text-orange-400'
    default:
      return 'text-gray-500 dark:text-gray-400'
  }
})

const getLogIcon = (a: string) =>
  a.startsWith('CRON_ARTICLE') || a === 'CRON_GENERATE_ARTICLE'
    ? 'mdi:robot'
    : a === 'CRON_GENERATE_ARTICLE_FAILED'
      ? 'mdi:alert-circle'
      : 'mdi:lightbulb-on'

const logTone = (a: string) =>
  a.endsWith('_FAILED')
    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
    : 'bg-gray-100 text-gray-500 dark:bg-neutral-800 dark:text-gray-400'

const formatAction = (a: string) => {
  const m: Record<string, string> = {
    CRON_GENERATE_ARTICLE: $t('articles.userMenu.articleGenerated'),
    CRON_GENERATE_ARTICLE_FAILED: $t('articles.userMenu.generationFailed'),
    CRON_ARTICLE_PUBLISHED: $t('articles.userMenu.articlePublished'),
    CRON_ARTICLE_SAVED_AS_DRAFT: $t('articles.userMenu.articleSavedAsDraft'),
    COMMUNITY_INSIGHT_GENERATED: $t('articles.userMenu.insightGenerated'),
    COMMUNITY_INSIGHT_SKIPPED: $t('articles.userMenu.insightSkipped'),
  }
  return m[a] || a
}

const pendingPack = shallowRef<string | null>(null)

const buyTokens = async (pack: string) => {
  if (pendingPack.value) return
  pendingPack.value = pack
  try {
    const res = await $fetch('/api/stripe/checkout', {
      method: 'POST',
      body: { pack, origin: window.location.origin },
    })
    if (res.url) window.location.href = res.url
    else pendingPack.value = null
  } catch {
    pendingPack.value = null
  }
}

const upgradeTarget = computed(() => getUpgradeTarget(site.value?.plan, status.value?.hasActiveSubscription))

const localePath = useLocalePath()
const upgrade = () => navigateTo(localePath({ name: 'settings', query: { tab: 'billing' } }))

const trigger = useTemplateRef('trigger')
const panel = useTemplateRef('panel')
const show = shallowRef(false)
const hoverShow = shallowRef(false)

const isTriggerHovered = useElementHover(trigger)
const isPanelHovered = useElementHover(panel)
const isHovered = computed(() => isTriggerHovered.value || isPanelHovered.value)
const isOpen = computed(() => show.value || hoverShow.value)
const { start: hideAfterHover } = useTimeoutFn(() => !isHovered.value && (hoverShow.value = false), 50, {
  immediate: false,
})

watch(show, (v) => (hoverShow.value = v))
watch(isHovered, (v) => (v ? (hoverShow.value = true) : hideAfterHover()))

onClickOutside(panel, () => (show.value = false), { ignore: [trigger] })
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}
</style>
