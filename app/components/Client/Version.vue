<template>
  <div
    data-client-version-bar
    class="bottom-action-bar fixed right-3 bottom-3 z-overlay flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-lg bg-elevated p-1 shadow-lg ring ring-default"
  >
    <UPopover v-model:open="show" :content="{ side: 'top', align: 'end' }">
      <UButton
        class="min-w-0"
        color="neutral"
        variant="soft"
        trailingIcon="i-mdi-chevron-up"
        :aria-label="$t('articles.userMenu.remainingTokens')"
      >
        <span class="hidden shrink-0 sm:inline">Topiqu {{ config.public.appVersion }}</span>
        <UBadge class="min-w-0 shrink truncate" :color="planBadgeColor" variant="soft">{{
          site?.plan ?? $t('articles.userMenu.noClientAssigned')
        }}</UBadge>
        <UBadge
          v-if="status?.tokenRemaining != null"
          class="ml-auto min-w-0 max-w-[8.5rem] shrink truncate tabular-nums"
          :title="`${status.tokenRemaining}/${status.tokenLimit}`"
          :color="isLowTokens ? 'error' : 'success'"
          variant="soft"
        >
          {{ status.tokenRemaining }}/{{ status.tokenLimit }}
        </UBadge>
      </UButton>

      <template #content>
        <UCard class="w-[92vw] max-w-sm">
          <div class="flex flex-col gap-5">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="font-semibold text-highlighted">{{ $t('articles.userMenu.remainingTokens') }}</span>
                <span class="text-muted">{{ status?.tokenRemaining ?? 0 }} / {{ status?.tokenLimit ?? 20000 }}</span>
              </div>
              <UProgress :modelValue="remainingPercent" :color="isLowTokens ? 'error' : 'success'" />
              <p class="text-xs text-muted">{{ $t('articles.userMenu.totalConsumed', [status?.totalUsage ?? 0]) }}</p>
            </div>

            <UAlert
              v-if="isLowTokens"
              color="error"
              variant="soft"
              icon="i-mdi-alert"
              :title="$t('articles.userMenu.lowTokensWarning')"
              :description="$t('articles.userMenu.lowTokensHint')"
            />

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="pack in tokenPacks"
                :key="pack.id"
                type="button"
                class="relative min-w-0 rounded-xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-60"
                :class="
                  pack.featured
                    ? 'border-primary bg-primary/10 hover:bg-primary/15'
                    : 'border-default bg-elevated hover:border-primary/40'
                "
                :disabled="checkoutPack !== null"
                @click="buyTokens(pack.id)"
              >
                <span class="flex items-center justify-between gap-1">
                  <UIcon
                    :name="checkoutPack === pack.id ? 'i-mdi-loading' : `i-${pack.icon}`"
                    class="size-5 text-primary"
                    :class="checkoutPack === pack.id ? 'animate-spin' : ''"
                  />
                  <UBadge v-if="pack.valueBonus" color="success" variant="soft" size="xs">
                    +{{ pack.valueBonus }}%
                  </UBadge>
                </span>
                <span class="mt-2 block truncate text-sm font-semibold text-highlighted">{{ pack.name }}</span>
                <span class="mt-1 block text-lg font-bold tabular-nums text-highlighted">
                  {{ pack.tokens.toLocaleString(locale) }}
                </span>
                <span class="block text-xs text-muted">{{ $t('common.tokens.tokens') }}</span>
                <span class="mt-2 flex items-end justify-between gap-2 border-t border-default pt-2">
                  <span class="text-xs text-muted">{{
                    $t('common.tokens.articlesEstimate', { count: pack.articles })
                  }}</span>
                  <strong class="shrink-0 text-sm text-highlighted">{{ pack.price }}</strong>
                </span>
              </button>
            </div>
            <div class="grid grid-cols-1 gap-2">
              <UButton
                v-if="site?.plan === 'BASIC'"
                color="success"
                variant="outline"
                icon="i-mdi-rocket-launch"
                block
                @click="upgrade"
              >
                {{ $t('common.tokens.upgradeToPremium') }}
              </UButton>
            </div>

            <USeparator :label="$t('articles.userMenu.recentActions')" />

            <UAlert
              v-if="logError"
              color="error"
              variant="soft"
              icon="i-mdi-alert-circle-outline"
              :title="$t('common.messages.loadFailedTitle')"
            >
              <template #actions>
                <UButton color="error" variant="ghost" icon="i-mdi-refresh" @click="refresh()">
                  {{ $t('common.messages.retry') }}
                </UButton>
              </template>
            </UAlert>
            <div v-else-if="logStatus === 'pending' && !logs.items.length" class="space-y-2" aria-busy="true">
              <USkeleton v-for="index in 3" :key="index" class="h-12 w-full" />
            </div>
            <UScrollArea v-else-if="logs.items.length" :class="logs.items.length > 5 ? 'max-h-64' : ''">
              <ol class="divide-y divide-default">
                <li v-for="log in logs.items" :key="log.id" class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 py-2.5">
                  <span class="grid size-7 place-items-center rounded-full bg-elevated text-primary">
                    <UIcon :name="getLogIcon(log.action)" size="16" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-highlighted">{{ formatAction(log.action) }}</span>
                    <span v-if="formatLogDetail(log.metadata)" class="mt-0.5 block break-words text-xs text-muted">
                      {{ formatLogDetail(log.metadata) }}
                    </span>
                    <AppTime :datetime="log.createdAt" preset="shortDatetime" class="mt-0.5 block text-xs text-muted" />
                  </span>
                </li>
              </ol>
            </UScrollArea>
            <UEmpty v-else icon="i-mdi-history" :title="$t('articles.userMenu.recentActions')" />

            <UButton v-if="logs.hasMore" color="neutral" variant="soft" block @click="loadMore">
              {{ $t('common.pagination.next') }}
            </UButton>

            <UAlert
              color="info"
              variant="soft"
              :title="$t('articles.userMenu.tip')"
              :description="$t('articles.userMenu.adjustPreferences')"
            />
          </div>
        </UCard>
      </template>
    </UPopover>

    <UTooltip :text="$t('common.consent.openSettings')">
      <UButton
        data-consent-settings
        square
        color="neutral"
        variant="soft"
        icon="i-mdi-cookie-settings-outline"
        :aria-label="$t('common.consent.openSettings')"
        @click="openConsentSettings"
      />
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const { locale, t } = useI18n()
const { data: status } = await useClientSiteStatus()
const site = computed(() => status.value)
const tokenPacks = computed(() => buildTokenPackViews(t, locale.value))

const page = shallowRef(1)
const show = shallowRef(false)
const checkoutPack = shallowRef<string | null>(null)
const logs = reactive<{ items: any[]; hasMore: boolean }>({ items: [], hasMore: false })
const consentSettingsOpen = useConsentSettingsOpen()

const openConsentSettings = () => {
  show.value = false
  consentSettingsOpen.value = true
}

const {
  data: response,
  refresh,
  status: logStatus,
  error: logError,
} = await useFetch(() => `/api/clients/${site.value?.id}/log?page=${page.value}&limit=20`, {
  default: () => ({ items: [], hasMore: false }),
  immediate: false,
  watch: false,
})

watch(show, async (isOpen) => {
  if (!isOpen || !site.value?.id) return
  page.value = 1
  logs.items = []
  await refresh()
})

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

const tokenRemaining = computed(() => status.value?.tokenRemaining ?? 0)
const tokenLimit = computed(() => status.value?.tokenLimit ?? 0)
const hasTokenPlan = computed(() => tokenLimit.value > 0)

const remainingPercent = computed(() =>
  hasTokenPlan.value ? Math.min(100, Math.max(0, (tokenRemaining.value / tokenLimit.value) * 100)) : 0,
)
const isLowTokens = computed(() => remainingPercent.value <= 20)
const planBadgeColor = computed(() =>
  site.value?.plan === 'PREMIUM'
    ? 'warning'
    : site.value?.plan === 'PRO'
      ? 'primary'
      : site.value?.plan === 'CUSTOM'
        ? 'error'
        : 'neutral',
)

const getLogIcon = (action: string) =>
  action.startsWith('CRON_ARTICLE') || action === 'CRON_GENERATE_ARTICLE'
    ? 'i-mdi-robot'
    : action === 'CRON_GENERATE_ARTICLE_FAILED'
      ? 'i-mdi-alert-circle'
      : 'i-mdi-lightbulb-on'

const formatAction = (action: string) => {
  const labels: Record<string, string> = {
    CRON_GENERATE_ARTICLE: $t('articles.userMenu.articleGenerated'),
    CRON_GENERATE_ARTICLE_FAILED: $t('articles.userMenu.generationFailed'),
    CRON_ARTICLE_PUBLISHED: $t('articles.userMenu.articlePublished'),
    CRON_ARTICLE_SAVED_AS_DRAFT: $t('articles.userMenu.articleSavedAsDraft'),
    COMMUNITY_INSIGHT_GENERATED: $t('articles.userMenu.insightGenerated'),
    COMMUNITY_INSIGHT_SKIPPED: $t('articles.userMenu.insightSkipped'),
  }
  return labels[action] || action
}

const formatLogDetail = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object') return ''
  const record = metadata as Record<string, unknown>
  const value = record.title || record.articleTitle || record.reason || record.message
  return typeof value === 'string' ? value : ''
}

const buyTokens = async (pack: string) => {
  checkoutPack.value = pack
  try {
    const res = await $fetch('/api/stripe/checkout', {
      method: 'POST',
      body: { pack, origin: window.location.origin },
    })
    if (res.url) window.location.href = res.url
  } finally {
    checkoutPack.value = null
  }
}

const localePath = useLocalePath()
const upgrade = () => navigateTo(localePath({ name: 'settings', query: { tab: 'billing' } }))
</script>
