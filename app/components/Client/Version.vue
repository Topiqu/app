<template>
  <div
    class="fixed bottom-3 right-3 flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-neutral-900/80 px-3 py-1.5 rounded-full shadow-md border border-gray-200/70 dark:border-neutral-700/70 backdrop-blur-md"
  >
    <span>
      Topiqu AI Blog
      <span v-if="site?.name" class="ml-1 font-semibold italic text-gray-800 dark:text-gray-200">{{ site.name }}</span>
      {{ config.public.appVersion }}
    </span>
    <span class="text-gray-400">|</span>

    <div ref="trigger" @click="show = !show" class="flex items-center gap-1.5 cursor-pointer select-none">
      <span :class="planColor">{{ site?.plan ?? $t('articles.userMenu.noClientAssigned') }}</span>
      <span v-if="site?.tokenRemaining != null" v-tippy="tokenTooltip" class="text-xs">
        (<span :class="tokenColor">{{ site.tokenRemaining }}/{{ site.tokenLimit }}</span
        >)
      </span>
      <Icon name="mdi:chevron-up" :class="['w-3 h-3 transition-transform duration-200', isOpen && 'rotate-180']" />
    </div>

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
        class="absolute bottom-full right-0 mb-2 w-80 p-5 rounded-2xl shadow-xl bg-white/90 dark:bg-neutral-900/95 backdrop-blur-xl border border-gray-200/60 dark:border-neutral-700/60 text-[13px] space-y-5"
      >
        <div class="space-y-2">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ $t('articles.userMenu.remainingTokens') }}</h3>
          <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{{ site?.tokenRemaining ?? 0 }} / {{ site?.tokenLimit ?? 20000 }}</span>
            <span>{{ $t('articles.userMenu.roughlyEstimated', [estimatedArticles]) }}</span>
          </div>
          <div class="h-2 bg-gray-200/80 dark:bg-gray-700/80 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-green-500/90 via-teal-500/90 to-cyan-500/90 rounded-full transition-all duration-300"
              :style="{ width: remainingPercent + '%' }"
            />
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {{ $t('articles.userMenu.totalConsumed', [site?.totalUsage ?? 0]) }}
          </div>
        </div>

        <div class="flex gap-2">
          <Button v-if="site?.plan && ['BASIC', 'PRO'].includes(site.plan)" size="sm" @click="buyTokens">{{
            $t('articles.userMenu.buyTokens')
          }}</Button>
          <Button v-if="site?.plan === 'BASIC'" size="sm" variant="primary" @click="upgrade">{{
            $t('articles.userMenu.upgradeToPremium')
          }}</Button>
        </div>

        <div class="space-y-2">
          <h4 class="font-medium text-gray-700 dark:text-gray-300">{{ $t('articles.userMenu.recentActions') }}</h4>
          <div class="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <div
              v-for="log in logs.items"
              :key="log.id"
              class="flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-150 hover:bg-gray-50/70 dark:hover:bg-neutral-800/70 group border border-transparent hover:border-gray-200/50 dark:hover:border-neutral-700/50"
            >
              <div class="flex items-center gap-2.5">
                <div
                  class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-200"
                >
                  <Icon :name="getLogIcon(log.action)" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ formatAction(log.action) }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-500">{{ formatDate(log.createdAt) }}</div>
                </div>
              </div>
            </div>
            <button
              v-if="logs.hasMore"
              @click="loadMore"
              class="w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {{ $t('common.pagination.next') }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-4 text-xs">
          <div v-if="site?.gtagId" class="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <Icon name="mdi:google-analytics" class="w-4 h-4" />
            <span>{{ $t('articles.userMenu.ga4Connected') }}</span>
          </div>
          <div v-if="site?.gamNetworkCode" class="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <Icon name="mdi:google-ads" class="w-4 h-4" />
            <span>{{ $t('articles.userMenu.gamConnected') }}</span>
          </div>
        </div>

        <div
          class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl text-xs text-blue-800 dark:text-blue-200 border border-blue-200/40 dark:border-blue-700/40"
        >
          <strong>{{ $t('articles.userMenu.tip') }}:</strong> {{ $t('articles.userMenu.adjustPreferences') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~~/shared/utils'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

const config = useRuntimeConfig()
const { data: session } = useAuth()
const { data: site } = await useFetch(`/api/clients/${session.value?.user.id}/by-userid`)

const page = shallowRef(1)
const { data: logs, refresh } = await useFetch(() => `/api/clients/${site.value?.id}/log?page=${page.value}&limit=20`, {
  default: () => ({ items: [], hasMore: false }),
})
const loadMore = () => {
  page.value++
  refresh()
}

const remainingPercent = computed(() =>
  Math.max(0, ((site.value?.tokenRemaining ?? 0) / (site.value?.tokenLimit ?? 20000)) * 100),
)
const estimatedArticles = computed(() => Math.floor((site.value?.tokenRemaining ?? 0) / 5000))
const tokenTooltip = computed(() => $t('articles.userMenu.roughlyEstimated', [estimatedArticles.value]))

const planColor = computed(() => ({
  'text-green-700 dark:text-green-400': site.value?.plan === 'BASIC',
  'text-blue-700 dark:text-blue-400': site.value?.plan === 'PRO',
  'text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded':
    site.value?.plan === 'PREMIUM',
  'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30 px-1.5 py-0.5 rounded font-bold':
    site.value?.plan === 'CUSTOM',
  'font-semibold': true,
}))
const tokenColor = computed(() => ({
  'text-red-700 dark:text-red-400': (site.value?.tokenRemaining ?? 0) / (site.value?.tokenLimit ?? 1) < 0.3,
  'text-green-700 dark:text-green-400': true,
  'font-semibold': true,
}))

const getLogIcon = (a: string) =>
  a.startsWith('CRON_ARTICLE') || a === 'CRON_GENERATE_ARTICLE'
    ? 'mdi:robot'
    : a === 'CRON_GENERATE_ARTICLE_FAILED'
      ? 'mdi:alert-circle'
      : 'mdi:lightbulb-on'
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

const buyTokens = () => navigateTo('/pricing')
const upgrade = () => navigateTo('/pricing?plan=PREMIUM')

const trigger = useTemplateRef('trigger')
const panel = useTemplateRef('panel')
const show = shallowRef(false)
const hoverShow = shallowRef(false)

const isTriggerHovered = useElementHover(trigger)
const isPanelHovered = useElementHover(panel)
const isHovered = computed(() => isTriggerHovered.value || isPanelHovered.value)
const isOpen = computed(() => show.value || hoverShow.value)

watch(show, (v) => (hoverShow.value = v))
watch(isHovered, (v) =>
  v ? (hoverShow.value = true) : setTimeout(() => !isHovered.value && (hoverShow.value = false), 50),
)

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
