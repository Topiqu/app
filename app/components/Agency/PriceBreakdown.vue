<template>
  <div class="rounded-(--ui-radius) bg-elevated/60 p-4 text-sm">
    <dl class="space-y-2">
      <div class="flex justify-between gap-4">
        <dt class="min-w-0 text-toned">{{ $t('agency.price.blogs', { count: quantities.blogs }) }}</dt>
        <dd class="shrink-0 tabular-nums text-highlighted">{{ usd(quantities.blogs * catalog.blogCents) }}</dd>
      </div>
      <div v-if="quantities.premium" class="flex justify-between gap-4">
        <dt class="min-w-0 text-toned">{{ $t('agency.price.premium', { count: quantities.premium }) }}</dt>
        <dd class="shrink-0 tabular-nums text-highlighted">{{ usd(quantities.premium * catalog.premiumCents) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="min-w-0 text-toned">
          {{ $t('agency.price.blocks', { count: quantities.blocks, units: number(units) }) }}
        </dt>
        <dd class="shrink-0 tabular-nums text-highlighted">{{ usd(quantities.blocks * catalog.blockCents) }}</dd>
      </div>
      <div v-if="difference" class="flex justify-between gap-4">
        <dt class="min-w-0 text-toned">{{ $t('agency.price.change') }}</dt>
        <dd class="shrink-0 font-medium tabular-nums text-highlighted">
          {{ difference > 0 ? '+' : '−' }}{{ usd(Math.abs(difference)) }}
        </dd>
      </div>
      <div class="flex items-baseline justify-between gap-4 border-t border-default pt-3">
        <dt class="font-medium text-highlighted">{{ $t('agency.price.total') }}</dt>
        <dd class="text-right" aria-live="polite">
          <span class="text-2xl font-semibold tracking-tight tabular-nums text-highlighted">{{ usd(total) }}</span>
          <span class="ml-1.5 text-xs text-muted">{{ $t('agency.plan.taxExclusive') }}</span>
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { AgencyCatalog } from '~/composables/useAgency'

const props = defineProps<{
  blogs: number | null
  premium: number | null
  blocks: number | null
  catalog: AgencyCatalog
  /** The running subscription's price; shows the change against it. */
  currentCents?: number
}>()

const { locale } = useI18n()
const usd = useUsd()
const number = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const quantities = computed(() => ({ blogs: props.blogs ?? 0, premium: props.premium ?? 0, blocks: props.blocks ?? 0 }))
const units = computed(() => agencyUnits(quantities.value.blocks))
const total = computed(() => agencyPriceCents(quantities.value))
const difference = computed(() => (props.currentCents == null ? 0 : total.value - props.currentCents))
</script>
