<template>
  <div class="space-y-3">
    <section
      class="rounded-(--ui-radius) bg-elevated/60 p-4"
      :aria-label="$t('common.preferences.releaseSchedule.preview')"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h4 class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.releaseSchedule.preview') }}</h4>
        <p class="text-xs font-medium text-muted">
          {{ t('common.preferences.releaseSchedule.perMonthCompact', forecast.perMonth) }}
        </p>
      </div>
      <p v-if="rules.frequency === 'INTERVAL'" class="mt-1 text-xs leading-5 text-muted">
        {{ $t('common.preferences.releaseSchedule.previewNote') }}
      </p>

      <ol class="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <li v-for="slot in preview" :key="slot.getTime()" class="border-l-2 border-default pl-3">
          <time :datetime="slot.toISOString()" :aria-label="formatSlot(slot)" class="block">
            <span class="block text-sm font-semibold text-highlighted">
              {{ formatSlot(slot, { weekday: 'short', day: 'numeric', month: 'numeric' }) }}
            </span>
            <span class="mt-0.5 block text-sm tabular-nums text-muted">
              {{ formatSlot(slot, { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </time>
        </li>
      </ol>

      <p v-if="nextReleaseAt" class="mt-3 border-t border-default pt-3 text-xs leading-5 text-default">
        {{ $t('common.preferences.releaseSchedule.next', { date: formatSlot(new Date(nextReleaseAt)) }) }}
      </p>
    </section>

    <p v-if="articlesRemaining === 0" role="status" class="flex items-start gap-2 text-sm leading-5 text-warning">
      <UIcon name="mdi:alert-circle-outline" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ $t('common.preferences.releaseSchedule.noCredits') }}
    </p>
    <p v-else-if="forecast.creditsLastUntil" class="text-xs leading-5 text-muted">
      {{
        $t('common.preferences.releaseSchedule.creditsUntil', {
          date: formatSlot(forecast.creditsLastUntil, { day: 'numeric', month: 'long' }),
        })
      }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { releaseForecast, seededRandom, upcomingReleases, type ReleaseSchedule } from '~~/shared/utils/releaseSchedule'

const props = defineProps<{
  rules: ReleaseSchedule
  articlesRemaining?: number | null
  nextReleaseAt?: string | null
}>()
const { t, locale } = useI18n()

// Examples stay put until the author changes the schedule.
const seed = computed(() =>
  [...JSON.stringify(props.rules)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7),
)
const preview = computed(() => upcomingReleases(props.rules, { count: 4, random: seededRandom(seed.value) }))
const forecast = computed(() => releaseForecast(props.rules, props.articlesRemaining ?? null))

const formatSlot = (date: Date, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat(locale.value, {
    timeZone: props.rules.timeZone,
    ...(Object.keys(options).length
      ? options
      : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
  }).format(date)
</script>
