<template>
  <section class="rounded-2xl border border-default bg-elevated p-5" :aria-label="$t('widgets.price.label')">
    <ul class="grid gap-3">
      <li v-for="asset in config.assets" :key="asset" class="flex items-baseline justify-between gap-4">
        <span class="font-semibold text-highlighted">{{ asset }}</span>
        <span class="tabular-nums text-default">{{ format(asset) }}</span>
      </li>
    </ul>
    <p class="mt-3 text-xs text-muted">
      {{ $t('widgets.price.source') }}
      <NuxtTime v-if="data?.asOf" :datetime="data.asOf" hour="2-digit" minute="2-digit" />
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PriceConfig } from '~~/shared/utils/widgets'

const { id, config } = defineProps<{ id: string; config: PriceConfig }>()
const { locale } = useI18n()

// Client-only: live values must not freeze into the SSR HTML; the fixed row height keeps CLS at zero.
const { data } = useLazyFetch<{ quote: string; prices: { asset: string; value: number }[]; asOf: string }>(
  `/api/widgets/${id}/data`,
  { server: false, key: `widget-data-${id}` },
)

const format = (asset: string) => {
  const value = data.value?.prices.find((price) => price.asset === asset)?.value
  if (value === undefined) return '—'
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: config.quote,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).format(value)
}
</script>
