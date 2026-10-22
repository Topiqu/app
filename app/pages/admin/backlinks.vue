<template>
  <div class="mx-auto flex min-h-0 w-full max-w-screen-lg flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-2xl">
        <h1 class="text-2xl font-bold text-highlighted">{{ $t('backlinks.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ $t('backlinks.description') }}</p>
      </div>
      <div v-if="enabled" class="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <UButton
          icon="mdi:magnify"
          :loading="starting || data?.running"
          :disabled="!canRefresh"
          :label="data?.running ? $t('backlinks.running') : $t('backlinks.refresh')"
          @click="start"
        />
        <p class="text-xs text-muted">{{ refreshNote }}</p>
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
      :title="$t('backlinks.loadFailed')"
    />
    <UEmpty
      v-else-if="!enabled"
      icon="mdi:link-variant"
      :title="$t('backlinks.disabledTitle')"
      :description="$t('backlinks.disabledDescription')"
      :actions="[
        {
          label: $t('backlinks.upgrade'),
          icon: 'mdi:star-four-points',
          to: localePath({ name: 'settings', query: { tab: 'billing' } }),
        },
      ]"
    />
    <template v-else>
      <UAlert
        v-if="!data.available"
        color="warning"
        variant="subtle"
        icon="mdi:alert-outline"
        :title="$t('backlinks.unavailable')"
      />
      <AppStatTiles :items="stats" />
      <BacklinksOpportunities />
      <BacklinksLinks />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { StatTile } from '~/components/AppStatTiles.vue'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('backlinks.title') })

const { t, locale } = useI18n()
const toast = useToast()
const localePath = useLocalePath()
const starting = shallowRef(false)

const { data, error, isPending, refetch } = useBacklinks()

const enabled = computed(() => !!data.value?.allowance.kinds.length)
const canRefresh = computed(
  () =>
    !!data.value?.available &&
    !data.value.running &&
    (!data.value.nextManualAt || new Date(data.value.nextManualAt) <= new Date()),
)

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))

const refreshNote = computed(() => {
  if (!data.value?.refreshedAt) return t('backlinks.neverRefreshed')
  if (!canRefresh.value && data.value.nextManualAt && !data.value.running)
    return t('backlinks.nextRefresh', { date: formatDate(data.value.nextManualAt) })
  return t('backlinks.refreshedAt', { date: formatDate(data.value.refreshedAt) })
})

const stats = computed((): StatTile[] => {
  const number = new Intl.NumberFormat(locale.value)
  const live = (data.value?.links ?? []).filter((link) => !link.lostAt)
  const open = data.value?.opportunities.length ?? 0
  const label = (key: string) => t(`backlinks.stats.${key}.label`)
  const info = (key: string) => t(`backlinks.stats.${key}.info`)
  return [
    {
      key: 'live',
      icon: 'mdi:link-variant',
      label: label('live'),
      value: number.format(live.length),
      hint: info('live'),
    },
    {
      key: 'won',
      icon: 'mdi:trophy-outline',
      label: label('won'),
      value: number.format(data.value?.won ?? 0),
      note: t('backlinks.stats.won.hint'),
      hint: info('won'),
    },
    {
      key: 'open',
      icon: 'mdi:email-fast-outline',
      label: label('open'),
      value: number.format(open),
      hint: info('open'),
    },
  ]
})

const start = async () => {
  starting.value = true
  try {
    await $fetch<unknown, '/api/backlinks/discover'>('/api/backlinks/discover', { method: 'POST' })
    await refetch()
    toast.add({ color: 'success', title: t('backlinks.started') })
  } catch (failure) {
    toast.add({ color: 'error', title: fetchErrorMessage(failure, t('backlinks.failed')) })
  } finally {
    starting.value = false
  }
}
</script>
