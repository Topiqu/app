<template>
  <section class="space-y-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-5">
    <header>
      <h2 class="text-lg font-semibold text-highlighted">{{ $t('common.aiAllowance.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('common.aiAllowance.policy') }}</p>
    </header>
    <USkeleton v-if="status === 'pending' && !data" class="h-32 w-full" />
    <UAlert v-else-if="error" color="error" :title="$t('common.messages.operationFailed')">
      <template #actions
        ><UButton color="neutral" variant="soft" @click="refresh()">{{
          $t('common.preferences.billing.retry')
        }}</UButton></template
      >
    </UAlert>
    <template v-else-if="data">
      <p v-if="!data.active" class="text-sm text-muted">{{ $t('common.aiAllowance.inactive') }}</p>
      <dl class="divide-y divide-default">
        <div
          v-for="item in data.allowances.filter((row) => row.kind !== 'BUDGET')"
          :key="item.kind"
          class="flex items-center justify-between gap-4 py-3 text-sm"
        >
          <dt class="text-toned">{{ $t(`common.aiAllowance.kinds.${item.kind}`) }}</dt>
          <dd class="shrink-0 font-semibold tabular-nums text-highlighted">
            {{
              $t('common.aiAllowance.remaining', {
                remaining: item.remaining.toLocaleString(locale),
                total: item.total.toLocaleString(locale),
              })
            }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-4 py-3 text-sm">
          <dt class="text-toned">{{ $t('common.aiAllowance.kinds.BUDGET') }}</dt>
          <dd class="font-semibold tabular-nums" :class="budgetPercent ? 'text-highlighted' : 'text-error'">
            {{ budgetPercent }} %
          </dd>
        </div>
      </dl>
      <p v-if="data.renewsAt" class="text-sm text-muted">
        {{
          $t(data.trial ? 'common.aiAllowance.trialEnds' : 'common.aiAllowance.renews', {
            date: formatTime(data.renewsAt, 'short'),
          })
        }}
      </p>
      <p class="text-xs leading-relaxed text-muted">{{ $t('common.aiAllowance.sharedBudget') }}</p>
      <div v-if="canBuy && data.active" class="space-y-3 border-t border-default pt-4">
        <h3 class="font-medium text-highlighted">{{ $t('common.aiAllowance.packs') }}</h3>
        <div
          v-for="pack in packs"
          :key="pack.id"
          class="flex flex-col gap-3 rounded-(--ui-radius) bg-elevated/50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-toned">
            {{
              $t('common.aiAllowance.packContents', {
                translations: pack.TRANSLATION,
                edits: pack.EDIT,
                checks: pack.VISIBILITY,
              })
            }}<br /><span class="text-xs text-muted">{{ packCapacity(pack.BUDGET) }}</span>
          </p>
          <UButton
            color="neutral"
            variant="soft"
            :loading="buying === pack.id"
            :disabled="buying !== null"
            @click="buy(pack.id)"
            >{{ currency(pack.priceCents / 100) }} · {{ $t('common.articlePacks.buy') }}</UButton
          >
        </div>
        <p class="text-xs text-muted">{{ $t('common.aiAllowance.purchasePolicy') }}</p>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { AI_USAGE_PACKS, type AiUsagePackId } from '~~/shared/utils/billingCatalog'

const { clientSiteId, canBuy } = defineProps<{ clientSiteId: string; canBuy: boolean }>()
const { locale, t } = useI18n()
const { formatTime } = useTime()
const toast = useToast()
const buying = shallowRef<AiUsagePackId | null>(null)
const { data, status, error, refresh } = await useFetch('/api/stripe/ai-usage', {
  key: `ai-usage:${clientSiteId}`,
  getCachedData: (key, nuxtApp) => (nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined),
})
const packs = Object.entries(AI_USAGE_PACKS).map(([id, pack]) => ({ ...pack, id: id as AiUsagePackId }))
const budgetPercent = computed(() => {
  const budget = data.value?.allowances.find((row) => row.kind === 'BUDGET')
  return budget?.total ? Math.max(0, Math.min(100, Math.floor((budget.remaining / budget.total) * 100))) : 0
})
const currency = (amount: number) =>
  new Intl.NumberFormat(locale.value, { style: 'currency', currency: 'USD' }).format(amount)
const packCapacity = (amount: number) => {
  const included = data.value?.allowances.find((row) => row.kind === 'BUDGET')?.included
  return included
    ? t('common.aiAllowance.packBudget', { percent: Math.round((amount / included) * 100) })
    : t('common.aiAllowance.extraCapacity')
}
const buy = async (packId: AiUsagePackId) => {
  buying.value = packId
  try {
    const result = await $fetch('/api/stripe/ai-usage-checkout', {
      method: 'POST',
      body: { packId, origin: window.location.origin, locale: locale.value },
    })
    if (!result.url) throw new Error('Checkout unavailable')
    await navigateTo(result.url, { external: true })
  } catch {
    toast.add({ color: 'error', title: t('common.preferences.billing.actionFailed') })
  } finally {
    buying.value = null
  }
}
</script>
