<template>
  <div class="mx-auto flex min-h-0 w-full max-w-screen-lg flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-2xl">
        <h1 class="text-2xl font-bold text-highlighted">{{ $t('common.keywords.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ $t('common.keywords.description') }}</p>
      </div>
      <div v-if="data?.enabled && marketItems.length > 1" class="shrink-0 sm:w-48">
        <AppFormLabel :forId="marketId" :text="$t('common.keywordPlan.market')" />
        <USelect
          :id="marketId"
          :modelValue="data.market"
          :items="marketItems"
          :disabled="savingMarket"
          class="mt-1 w-full"
          @update:modelValue="saveMarket"
        />
      </div>
    </header>

    <div v-if="isPending" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-20 w-full" />
      <USkeleton v-for="index in 3" :key="index" class="h-14 w-full" />
    </div>
    <UAlert
      v-else-if="error || !data"
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('common.keywordPlan.loadFailed')"
    />
    <UEmpty
      v-else-if="!data.enabled"
      icon="mdi:target"
      :title="$t('common.keywords.disabledTitle')"
      :description="$t('common.keywords.disabledDescription')"
      :actions="[
        {
          label: $t('common.keywords.openSettings'),
          icon: 'mdi:cog',
          to: localePath({ name: 'settings', query: { tab: 'ai' } }),
        },
      ]"
    />
    <template v-else>
      <AppStatTiles :items="stats" />

      <KeywordsResults />
      <KeywordsActions />
      <KeywordsPlan />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { StatTile } from '~/components/AppStatTiles.vue'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('common.keywords.title') })

const { t, locale } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const marketId = useId()
const savingMarket = shallowRef(false)

const { data, error, isPending, refetch } = useKeywordPlan()

const marketItems = computed(() => {
  const regions = new Intl.DisplayNames([locale.value], { type: 'region' })
  return (data.value?.markets ?? []).map((value) => ({
    value,
    label: value === 'GLOBAL' ? t('common.keywordPlan.marketGlobal') : (regions.of(value) ?? value),
  }))
})

/** Three numbers that answer "is this worth it": demand covered, rankings won, topics ready. */
const stats = computed((): StatTile[] => {
  const number = new Intl.NumberFormat(locale.value)
  const written = data.value?.written ?? { topics: 0, volume: 0 }
  const results = data.value?.results ?? []
  const top10 = results.filter((result) => result.position != null && result.position <= 10).length
  const queued = (data.value?.clusters ?? []).filter((cluster) => cluster.status !== 'SKIPPED').length
  const label = (key: string) => t(`common.keywords.stats.${key}.label`)
  const info = (key: string) => t(`common.keywords.stats.${key}.info`)
  return [
    {
      key: 'demand',
      icon: 'mdi:magnify',
      label: label('demand'),
      value: written.volume ? `≈ ${number.format(written.volume)}` : '—',
      muted: !written.volume,
      note: written.volume
        ? t('common.keywords.stats.demand.hint', { n: number.format(written.topics) }, written.topics)
        : t('common.keywords.stats.demand.empty'),
      hint: info('demand'),
    },
    {
      key: 'top10',
      icon: 'mdi:trophy-outline',
      label: label('top10'),
      value: results.length ? `${top10} / ${results.length}` : '—',
      muted: !results.length,
      note: t(results.length ? 'common.keywords.stats.top10.hint' : 'common.keywords.stats.top10.pending'),
      hint: info('top10'),
    },
    {
      key: 'queued',
      icon: 'mdi:playlist-edit',
      label: label('queued'),
      value: number.format(queued),
      note: t('common.keywords.stats.queued.hint'),
      hint: info('queued'),
    },
  ]
})

const saveMarket = async (market: string) => {
  savingMarket.value = true
  try {
    await $fetch('/api/keyword-plan', { method: 'PATCH', body: { market } })
    await refetch()
    toast.add({ color: 'success', title: t('common.keywordPlan.marketSaved') })
  } catch (failure) {
    toast.add({ color: 'error', title: fetchErrorMessage(failure, t('common.keywordPlan.failed')) })
  } finally {
    savingMarket.value = false
  }
}
</script>
