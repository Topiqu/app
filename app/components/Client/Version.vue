<template>
  <div
    data-client-version-bar
    class="bottom-action-bar fixed right-3 bottom-3 z-overlay flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-lg bg-elevated p-1 shadow-lg ring ring-default"
  >
    <UButton
      class="min-w-0"
      color="neutral"
      variant="soft"
      trailingIcon="mdi:chevron-up"
      :aria-label="$t('common.wallet.title')"
      @click="show = true"
    >
      <span class="hidden shrink-0 sm:inline">Topiqu {{ config.public.appVersion }}</span>
      <UBadge class="min-w-0 shrink truncate" :color="planBadgeColor" variant="soft">{{
        site?.plan ?? $t('articles.userMenu.noClientAssigned')
      }}</UBadge>
      <UBadge
        v-if="status?.articlesRemaining != null"
        class="ml-auto min-w-0 max-w-[8.5rem] shrink truncate tabular-nums"
        :title="$t('common.wallet.available')"
        :color="isLowArticles ? 'error' : 'success'"
        variant="soft"
      >
        {{ status.articlesRemaining.toLocaleString(locale) }}
      </UBadge>
    </UButton>

    <UTooltip :text="$t('common.consent.openSettings')">
      <UButton
        data-consent-settings
        square
        color="neutral"
        variant="soft"
        icon="mdi:cookie-settings-outline"
        :aria-label="$t('common.consent.openSettings')"
        @click="openConsentSettings"
      />
    </UTooltip>
  </div>

  <USlideover
    v-model:open="show"
    side="right"
    :title="$t('common.wallet.title')"
    class="w-full sm:max-w-xl"
    :ui="{
      content: 'w-full sm:max-w-xl rounded-none sm:rounded-l-[var(--topiqu-surface-radius)]',
      body: 'min-h-0 overflow-y-auto overscroll-contain sm:py-4',
    }"
  >
    <template #body>
      <div class="flex min-h-0 min-w-0 flex-col gap-5 sm:gap-4">
        <div class="flex min-w-0 shrink-0 flex-col gap-5 sm:gap-3">
          <section>
            <div class="min-w-0">
              <h3 class="text-xs font-medium uppercase tracking-wider text-muted">
                {{ $t('common.wallet.available') }}
              </h3>
              <p class="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                <span
                  class="text-3xl font-bold leading-none tracking-tight tabular-nums"
                  :class="isLowArticles ? 'text-error' : 'text-highlighted'"
                  >{{ articlesRemaining.toLocaleString(locale) }}</span
                >
                <span class="text-sm text-muted">{{ $t('common.wallet.unit', articlesRemaining) }}</span>
              </p>
            </div>

            <dl v-if="wallet" class="mt-3 grid gap-1.5 border-t border-default pt-3 text-sm">
              <div v-if="wallet.reserved > 0">
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="min-w-0 text-muted">{{ $t('common.wallet.reserved') }}</dt>
                  <dd class="shrink-0 tabular-nums text-highlighted">
                    {{ wallet.reserved.toLocaleString(locale) }}
                  </dd>
                </div>
                <p class="mt-0.5 text-xs text-muted">{{ $t('common.wallet.reservedHint') }}</p>
              </div>
              <div
                v-for="grant in wallet.grants.filter((item) => item.expiresAt)"
                :key="grant.id"
                class="flex items-baseline justify-between gap-3"
              >
                <dt class="min-w-0 text-muted">
                  {{ $t('common.wallet.expires') }}
                  <AppTime v-if="grant.expiresAt" :datetime="grant.expiresAt" preset="short" />
                </dt>
                <dd class="shrink-0 tabular-nums text-highlighted">{{ grant.remaining.toLocaleString(locale) }}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="article-packs-title">
            <div class="mb-4">
              <h3 id="article-packs-title" class="text-lg font-semibold tracking-tight text-highlighted">
                {{ $t('common.articlePacks.title') }}
              </h3>
              <p class="mt-1.5 max-w-lg text-sm leading-relaxed text-muted">
                {{ $t('common.articlePacks.purchaseHint') }}
              </p>
            </div>
            <div
              class="divide-y divide-default overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default bg-default"
            >
              <article
                v-for="pack in articlePacks"
                :key="pack.id"
                class="relative flex min-h-24 flex-col justify-center gap-3 px-4 py-4 min-[24rem]:flex-row min-[24rem]:items-center min-[24rem]:justify-between"
                :class="
                  pack.featured
                    ? 'bg-primary/8 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary'
                    : ''
                "
              >
                <div class="min-w-0">
                  <div class="flex items-baseline gap-2">
                    <strong class="text-3xl font-bold leading-none tracking-tight tabular-nums text-highlighted">
                      {{ pack.articles.toLocaleString(locale) }}
                    </strong>
                    <span class="text-sm font-medium text-toned">{{ articleUnit(pack.articles) }}</span>
                  </div>
                  <p v-if="pack.volumeDiscount" class="mt-1.5 text-xs text-muted">
                    <strong v-if="pack.featured" class="font-semibold text-primary">
                      {{ $t('common.articlePacks.bestValue') }} ·
                    </strong>
                    {{ $t('common.articlePacks.volumeDiscount', { discount: pack.volumeDiscount }) }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center justify-between gap-3 min-[24rem]:justify-end">
                  <div class="text-left min-[24rem]:text-right">
                    <strong class="block text-xl font-bold leading-tight tabular-nums text-highlighted">
                      {{ pack.price }}
                    </strong>
                    <span class="block text-xs text-muted">{{ $t('common.articlePacks.taxExclusive') }}</span>
                  </div>
                  <UButton
                    :color="pack.featured ? 'primary' : 'neutral'"
                    :variant="pack.featured ? 'solid' : 'soft'"
                    icon="mdi:cart-outline"
                    size="sm"
                    :loading="checkoutPack === pack.id"
                    :disabled="checkoutPack !== null"
                    :aria-label="$t('common.articlePacks.buyPack', { count: pack.articles })"
                    @click="buyArticles(pack.id)"
                  >
                    {{ $t('common.articlePacks.buy') }}
                  </UButton>
                </div>
              </article>
            </div>
          </section>
          <div class="grid grid-cols-1 gap-2">
            <UButton
              v-if="site?.plan === 'BASIC'"
              color="success"
              variant="outline"
              icon="mdi:rocket-launch"
              block
              @click="upgrade"
            >
              {{ $t('common.articlePacks.upgradeToPremium') }}
            </UButton>
          </div>
        </div>

        <section class="space-y-3" :aria-label="$t('common.wallet.history')">
          <USeparator :label="$t('common.wallet.history')" />
          <UAlert v-if="walletError" color="error" :title="$t('common.messages.loadFailedTitle')">
            <template #actions
              ><UButton @click="refreshWallet()">{{ $t('common.messages.retry') }}</UButton></template
            >
          </UAlert>
          <div
            class="max-h-[min(40dvh,20rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            tabindex="0"
            role="region"
            :aria-label="$t('common.wallet.history')"
          >
            <div
              v-for="entry in ledger"
              :key="entry.id"
              class="flex items-start justify-between gap-3 border-b border-default py-2"
            >
              <div class="min-w-0">
                <p class="break-words text-sm">{{ $t(`common.wallet.kinds.${entry.kind}`) }}</p>
                <p class="break-words text-xs text-muted">{{ entry.reason }}</p>
                <AppTime :datetime="entry.createdAt" preset="shortDatetime" class="text-xs text-muted" />
              </div>
              <span class="shrink-0 tabular-nums"
                >{{ entry.amount > 0 ? '+' : '' }}{{ entry.amount.toLocaleString(locale) }}</span
              >
            </div>
            <p v-if="!ledger.length && walletState !== 'pending'" class="text-sm text-muted">
              {{ $t('common.wallet.empty') }}
            </p>
          </div>
          <UButton v-if="walletData?.nextCursor" block :loading="walletState === 'pending'" @click="loadMoreCredit">{{
            $t('common.pagination.next')
          }}</UButton>
        </section>
        <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <USeparator :label="$t('articles.userMenu.recentActions')" />

          <UAlert
            v-if="logError"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('common.messages.loadFailedTitle')"
          >
            <template #actions>
              <UButton color="error" variant="ghost" icon="mdi:refresh" @click="refresh()">
                {{ $t('common.messages.retry') }}
              </UButton>
            </template>
          </UAlert>
          <div v-else-if="logStatus === 'pending' && !logs.items.length" class="space-y-2" aria-busy="true">
            <USkeleton v-for="index in 3" :key="index" class="h-12 w-full" />
          </div>
          <div
            v-else-if="logs.items.length"
            class="min-h-0 max-h-[min(40dvh,20rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            tabindex="0"
            role="region"
            :aria-label="$t('articles.userMenu.recentActions')"
          >
            <ol class="grid gap-x-4 sm:grid-cols-2">
              <li
                v-for="log in logs.items"
                :key="log.id"
                class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 border-b border-default py-2"
              >
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
          </div>
          <UEmpty v-else icon="mdi:history" :title="$t('articles.userMenu.recentActions')" />

          <UButton
            v-if="logs.hasMore"
            color="neutral"
            variant="soft"
            block
            :loading="logStatus === 'pending'"
            :disabled="!!logError"
            @click="loadMore"
          >
            {{ $t('common.pagination.next') }}
          </UButton>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { buildArticlePackViews } from '~/utils/articlePackPresentation'

const config = useRuntimeConfig()
const { locale, t } = useI18n()
const { data: status, refresh: refreshStatus } = await useClientSiteStatus()
const site = computed(() => status.value)
const articlePacks = computed(() => buildArticlePackViews(t, locale.value))

const page = shallowRef(1)
const show = shallowRef(false)
const checkoutPack = shallowRef<string | null>(null)
const logs = reactive<{ items: any[]; hasMore: boolean }>({ items: [], hasMore: false })
const consentSettingsOpen = useConsentSettingsOpen()
const creditCursor = ref<string | null>(null)
const ledger = ref<{ id: string; kind: string; amount: number; reason: string; createdAt: string }[]>([])
const {
  data: walletData,
  refresh: refreshWallet,
  error: walletError,
  status: walletState,
} = await useFetch(() => `/api/clients/${site.value?.id}/article-wallet`, {
  query: computed(() => ({ cursor: creditCursor.value || undefined })),
  immediate: false,
  watch: false,
})
watch(walletData, (value) => {
  if (!value) return
  ledger.value = Array.from(
    new Map(
      (creditCursor.value ? [...ledger.value, ...value.items] : value.items).map((item) => [item.id, item]),
    ).values(),
  )
})
const loadMoreCredit = async () => {
  if (walletState.value === 'pending' || !walletData.value?.nextCursor) return
  creditCursor.value = walletData.value.nextCursor
  await refreshWallet()
}

const openConsentSettings = () => {
  show.value = false
  consentSettingsOpen.value = true
}

const {
  data: response,
  refresh,
  status: logStatus,
  error: logError,
} = await useFetch(() => `/api/clients/${site.value?.id}/log?page=${page.value}&limit=4`, {
  default: () => ({ items: [], hasMore: false }),
  immediate: false,
  watch: false,
})

const openWallet = async (isOpen: boolean) => {
  if (!isOpen || !site.value?.id) return
  page.value = 1
  logs.items = []
  creditCursor.value = null
  ledger.value = []
  await Promise.all([refresh(), refreshWallet(), refreshStatus()])
}
// Keep these separate: a shallow ref in a multi-source watcher forces the callback
// on status refresh too, even when the tenant ID has not changed.
watch(show, openWallet)
watch(
  () => site.value?.id,
  () => {
    if (show.value) void openWallet(true)
  },
)

watch(
  response,
  (newData) => {
    if (newData?.items) {
      const nextItems = page.value === 1 ? newData.items : [...logs.items, ...newData.items]
      logs.items = Array.from(new Map(nextItems.map((item) => [item.id, item])).values())
      logs.hasMore = newData.hasMore
    }
  },
  { immediate: true },
)

const loadMore = async () => {
  if (!logs.hasMore || logStatus.value === 'pending') return
  page.value++
  await refresh()
}

const articlesRemaining = computed(() => status.value?.articlesRemaining ?? 0)
const articleUnit = (count: number) => t('common.articlePacks.articles', count)
const isLowArticles = computed(() => articlesRemaining.value <= 1)
// Summary numbers come from the status payload, which is already loaded — the paginated
// /wallet fetch is deliberately not the source, it would render zeros until it resolves.
const wallet = computed(() => status.value?.articleWallet)
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
    ? 'mdi:robot'
    : action === 'CRON_GENERATE_ARTICLE_FAILED'
      ? 'mdi:alert-circle'
      : 'mdi:lightbulb-on'

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

const buyArticles = async (pack: string) => {
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
