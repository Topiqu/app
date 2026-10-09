<template>
  <section class="rounded-2xl border border-default bg-elevated p-5" :aria-labelledby="titleId">
    <div class="flex items-center justify-between gap-4">
      <h2 :id="titleId" class="font-semibold text-highlighted">{{ config.place.name }}</h2>
      <p v-if="data?.current" class="flex items-center gap-2 text-2xl font-bold tabular-nums">
        <UIcon
          :name="look(data.current.symbol).icon"
          class="size-7"
          :aria-label="$t(look(data.current.symbol).label)"
        />
        {{ temperature(data.current.temp) }}
      </p>
      <span v-else class="h-8 w-20" aria-hidden="true" />
    </div>
    <ol class="mt-4 grid gap-2" :style="{ gridTemplateColumns: `repeat(${config.days}, minmax(0, 1fr))` }">
      <li v-for="(day, index) in days" :key="day?.date ?? index" class="flex flex-col items-center gap-1 text-sm">
        <template v-if="day">
          <span class="text-muted">{{ weekday(day.date) }}</span>
          <UIcon :name="look(day.symbol).icon" class="size-6" :aria-label="$t(look(day.symbol).label)" />
          <span class="tabular-nums">
            {{ temperature(day.max) }} <span class="text-muted">{{ temperature(day.min) }}</span>
          </span>
        </template>
        <span v-else class="h-16" aria-hidden="true" />
      </li>
    </ol>
    <p class="mt-3 text-xs text-muted">{{ $t('widgets.weather.source') }}</p>
  </section>
</template>

<script setup lang="ts">
import type { WeatherConfig, WeatherData } from '~~/shared/utils/widgets'

// The editor's preview has no saved `id` and passes `data` itself.
const { id, config, data: given } = defineProps<{ id?: string; config: WeatherConfig; data?: WeatherData | null }>()
const { locale } = useI18n()
const titleId = useId()

const { data: fetched } = useLazyFetch<WeatherData>(`/api/widgets/${id}/data`, {
  server: false,
  key: `widget-data-${id}`,
  immediate: !!id,
})
const data = computed(() => given ?? fetched.value)
const days = computed(() => Array.from({ length: config.days }, (_, index) => data.value?.days[index]))

// MET Norway symbol codes (`lightrainshowers_day`, …), grouped from most to least specific.
const LOOKS = [
  ['thunder', 'mdi:weather-lightning-rainy', 'widgets.weather.thunder'],
  ['sleet', 'mdi:weather-snowy-rainy', 'widgets.weather.sleet'],
  ['snow', 'mdi:weather-snowy', 'widgets.weather.snow'],
  ['heavyrain', 'mdi:weather-pouring', 'widgets.weather.heavyRain'],
  ['rain', 'mdi:weather-rainy', 'widgets.weather.rain'],
  ['fog', 'mdi:weather-fog', 'widgets.weather.fog'],
  ['partlycloudy', 'mdi:weather-partly-cloudy', 'widgets.weather.partlyCloudy'],
  ['fair', 'mdi:weather-partly-cloudy', 'widgets.weather.partlyCloudy'],
  ['cloudy', 'mdi:weather-cloudy', 'widgets.weather.cloudy'],
  ['clearsky_night', 'mdi:weather-night', 'widgets.weather.clear'],
  ['clearsky', 'mdi:weather-sunny', 'widgets.weather.clear'],
] as const
const look = (symbol: string | null) => {
  const [, icon, label] = LOOKS.find(([key]) => symbol?.includes(key)) ?? LOOKS[8]
  return { icon, label }
}

const temperature = (value: number) => `${Math.round(value)}°`
const weekday = (date: string) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: 'UTC' }).format(new Date(date))
</script>
