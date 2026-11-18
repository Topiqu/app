<template>
  <section class="@container rounded-2xl border border-default bg-elevated p-5" :aria-label="$t('widgets.price.label')">
    <!-- On a phone the tiles stack into one tall column, so narrow slots get one row per rate instead. -->
    <!-- @md measures the widget, not the viewport: the same slot can be wide on a page and narrow in the editor. -->
    <ul
      class="divide-y divide-default @md:grid @md:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] @md:gap-x-6 @md:gap-y-4 @md:divide-y-0"
    >
      <li
        v-for="asset in config.assets"
        :key="asset"
        class="flex min-w-0 items-baseline justify-between gap-4 py-1.5 first:pt-0 last:pb-0 @md:block @md:py-0"
      >
        <span class="block shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">{{ asset }}</span>
        <span
          class="block min-w-0 truncate font-semibold tabular-nums text-highlighted @md:text-lg"
          :title="format(asset)"
        >
          {{ format(asset) }}
        </span>
      </li>
    </ul>
    <p class="mt-4 text-xs text-muted">
      {{ $t('widgets.price.source') }}
      <NuxtTime v-if="data?.asOf" :datetime="data.asOf" hour="2-digit" minute="2-digit" />
    </p>
  </section>
</template>

<script setup lang="ts">
import type { PriceConfig, PriceData } from '~~/shared/utils/widgets'

// The editor's preview has no saved `id` and passes `data` itself.
const { id, config, data: given } = defineProps<{ id?: string; config: PriceConfig; data?: PriceData | null }>()
const { locale } = useI18n()

// Client-only: live values must not freeze into the SSR HTML; the fixed row height keeps CLS at zero.
const { data: fetched } = useLazyFetch<PriceData>(`/api/widgets/${id}/data`, {
  server: false,
  key: `widget-data-${id}`,
  immediate: !!id,
})
const data = computed(() => given ?? fetched.value)

// Currency formats join groups with no-break spaces, so a long value cannot wrap; fewer decimals keep
// it within the tile.
const format = (asset: string) => {
  const value = data.value?.prices.find((price) => price.asset === asset)?.value
  if (value === undefined) return '—'
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: config.quote,
    maximumFractionDigits: value >= 1000 ? 0 : value < 10 ? 4 : 2,
  }).format(value)
}
</script>
