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
        <div class="flex min-w-0 shrink-0 flex-col gap-5">
          <section class="rounded-[var(--topiqu-surface-radius)] border border-default bg-elevated px-5 py-5">
            <div class="min-w-0">
              <h3 class="text-xs font-medium uppercase tracking-wider text-muted">
                {{ $t('common.wallet.available') }}
              </h3>
              <p class="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span
                  class="text-4xl font-bold leading-none tracking-tight tabular-nums"
                  :class="isLowArticles ? 'text-error' : 'text-highlighted'"
                  >{{ articlesRemaining.toLocaleString(locale) }}</span
                >
                <span class="text-sm text-muted">{{ $t('common.wallet.unit', articlesRemaining) }}</span>
              </p>
            </div>

            <dl v-if="wallet" class="mt-4 grid gap-2 border-t border-default pt-4 text-sm">
              <div v-if="wallet.reserved > 0">
                <div class="flex items-baseline justify-between gap-3">
                  <dt class="min-w-0 text-muted">{{ $t('common.wallet.reserved') }}</dt>
                  <dd class="shrink-0 font-semibold tabular-nums text-highlighted">
                    {{ wallet.reserved.toLocaleString(locale) }} {{ $t('common.wallet.unit', wallet.reserved) }}
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

          <section v-if="site?.billingProvider !== 'SHOPIFY'" aria-labelledby="article-packs-title">
            <h3 id="article-packs-title" class="text-lg font-semibold tracking-tight text-highlighted">
              {{ $t('common.wallet.topup') }}
            </h3>
            <p class="mb-3 mt-1 text-sm leading-relaxed text-muted">
              {{ $t('common.articlePacks.purchaseHint') }}
            </p>
            <div
              class="divide-y divide-default overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default bg-default"
            >
              <article
                v-for="pack in articlePacks"
                :key="pack.id"
                class="relative flex flex-col gap-3 px-4 py-3 min-[24rem]:flex-row min-[24rem]:items-center min-[24rem]:justify-between"
                :class="
                  pack.featured
                    ? 'bg-primary/8 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary'
                    : ''
                "
              >
                <div class="min-w-0">
                  <div class="flex items-baseline gap-1.5">
                    <strong class="text-xl font-bold leading-none tabular-nums text-highlighted">
                      {{ pack.articles.toLocaleString(locale) }}
                    </strong>
                    <span class="text-sm font-medium text-toned">{{ articleUnit(pack.articles) }}</span>
                  </div>
                  <p v-if="pack.volumeDiscount" class="mt-1 text-xs text-muted">
                    <strong v-if="pack.featured" class="font-semibold text-primary">
                      {{ $t('common.articlePacks.bestValue') }} ·
                    </strong>
                    {{ $t('common.articlePacks.volumeDiscount', { discount: pack.volumeDiscount }) }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center justify-between gap-3 min-[24rem]:justify-end">
                  <div class="text-left min-[24rem]:text-right">
                    <strong class="block text-lg font-bold leading-tight tabular-nums text-highlighted">
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
              ><UButton color="neutral" variant="outline" @click="refreshWallet()">{{
                $t('common.messages.retry')
              }}</UButton></template
            >
          </UAlert>
          <div
            class="max-h-[min(40dvh,20rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            tabindex="0"
            role="region"
            :aria-label="$t('common.wallet.history')"
          >
            <ol v-if="visibleLedger.length">
              <li
                v-for="entry in visibleLedger"
                :key="entry.id"
                class="flex items-start justify-between gap-3 border-b border-default py-2"
              >
                <div class="min-w-0">
                  <p class="break-words text-sm font-medium text-highlighted">
                    {{ $t(`common.wallet.kinds.${entry.kind}`) }}
                  </p>
                  <p v-if="ledgerReason(entry)" class="break-words text-xs text-muted">{{ ledgerReason(entry) }}</p>
                  <AppTime :datetime="entry.createdAt" preset="shortDatetime" class="text-xs text-muted" />
                </div>
                <span
                  class="shrink-0 font-semibold tabular-nums"
                  :class="entry.amount > 0 ? 'text-success' : 'text-highlighted'"
                  >{{ entry.amount > 0 ? '+' : '' }}{{ entry.amount.toLocaleString(locale) }}</span
                >
              </li>
            </ol>
            <p v-else-if="walletState !== 'pending'" class="text-sm text-muted">
              {{ $t('common.wallet.empty') }}
            </p>
          </div>
          <UButton
            v-if="walletData?.nextCursor"
            color="neutral"
            variant="outline"
            block
            :loading="walletState === 'pending'"
            @click="loadMoreCredit"
            >{{ $t('common.pagination.next') }}</UButton
          >
        </section>
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

const show = shallowRef(false)
const checkoutPack = shallowRef<string | null>(null)
const consentSettingsOpen = useConsentSettingsOpen()
const creditCursor = ref<string | null>(null)
const ledger = ref<{ id: string; kind: string; amount: number; reason: string; createdAt: string }[]>([])
const visibleLedger = computed(() => ledger.value.filter((entry) => entry.amount !== 0))
const ledgerReason = (entry: { reason: string }) => {
  if (entry.reason === 'MANUAL_ARTICLE') return t('common.wallet.reasons.manualArticle')
  if (entry.reason === 'SCHEDULED_ARTICLE') return t('common.wallet.reasons.scheduledArticle')
  if (entry.reason === 'Article credits expired') return ''
  return entry.reason
}
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

const openWallet = async (isOpen: boolean) => {
  if (!isOpen || !site.value?.id) return
  creditCursor.value = null
  ledger.value = []
  await Promise.all([refreshWallet(), refreshStatus()])
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
