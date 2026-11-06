<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-1 flex-col gap-6 py-6">
    <header class="max-w-2xl">
      <h1 class="text-2xl font-bold text-highlighted">{{ $t('articleBatch.title') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ $t('articleBatch.description') }}</p>
    </header>

    <div v-if="isPending" class="flex flex-col gap-6" :aria-label="$t('common.loading')" aria-busy="true">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>
    <UAlert
      v-else-if="!data"
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('articleBatch.loadFailed')"
    />
    <UEmpty
      v-else-if="!data.enabled"
      icon="mdi:star-four-points-outline"
      :title="$t('articleBatch.disabledTitle')"
      :description="$t('articleBatch.disabledDescription')"
    />
    <template v-else>
      <AppStatTiles :items="stats" />
      <UAlert
        v-if="data.credits.atRolloverCap"
        color="warning"
        variant="subtle"
        icon="mdi:alert-outline"
        :title="$t('articleBatch.rolloverCapTitle')"
        :description="$t('articleBatch.rolloverCapDescription')"
      />
      <ArticleBatchLevers :overview="data" @changed="refetch()" />
      <ArticleBatchPlan :overview="data" @changed="refetch()" />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { StatTile } from '~/components/AppStatTiles.vue'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('articleBatch.title') })

const { t, locale } = useI18n()
const { data, isPending, refetch } = useArticleBatchOverview()

const stats = computed((): StatTile[] => {
  const credits = data.value?.credits
  if (!credits) return []
  const number = new Intl.NumberFormat(locale.value)
  return [
    {
      key: 'free',
      icon: 'mdi:wallet-outline',
      label: t('articleBatch.stats.free.label'),
      value: number.format(credits.free),
      note: t('articleBatch.stats.free.note', { available: number.format(credits.available) }),
      hint: t('articleBatch.stats.free.info'),
    },
    {
      key: 'surplus',
      icon: 'mdi:calendar-plus-outline',
      label: t('articleBatch.stats.surplus.label'),
      value: number.format(credits.monthlySurplus),
      note: t('articleBatch.stats.surplus.note', { allowance: number.format(credits.monthlyAllowance) }),
      hint: t('articleBatch.stats.surplus.info'),
    },
    {
      key: 'autopilot',
      icon: 'mdi:robot-outline',
      label: t('articleBatch.stats.autopilot.label'),
      value: number.format(credits.autopilotCredits),
      note: t(
        'articleBatch.stats.autopilot.note',
        { n: number.format(credits.autopilotPerMonth) },
        credits.autopilotPerMonth,
      ),
      hint: t('articleBatch.stats.autopilot.info'),
    },
  ]
})
</script>
