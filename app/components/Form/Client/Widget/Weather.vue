<template>
  <div class="space-y-4">
    <UFormField :label="$t('widgets.weather.place')" :hint="config.place.name || $t('widgets.weather.placeHint')">
      <UInput
        v-model="query"
        icon="mdi:magnify"
        :loading="searching"
        :placeholder="$t('widgets.weather.search')"
        class="w-full"
      />
    </UFormField>
    <ul v-if="places.length" class="divide-y divide-default rounded-lg border border-default">
      <li v-for="place in places" :key="`${place.lat},${place.lon}`">
        <UButton
          color="neutral"
          variant="ghost"
          block
          :ui="{ base: 'flex-col items-start gap-0 rounded-none px-3 py-2 text-left' }"
          @click="choose(place)"
        >
          <span class="font-medium text-highlighted">{{ place.name }}</span>
          <span class="block w-full truncate text-xs text-muted">{{ place.label }}</span>
        </UButton>
      </li>
    </ul>
    <UFormField :label="$t('widgets.weather.days')" class="sm:max-w-xs">
      <USelect v-model="config.days" :items="[1, 2, 3, 4, 5]" class="w-full" />
    </UFormField>
    <p class="text-xs text-muted">{{ $t('widgets.weather.attribution') }}</p>
  </div>
</template>

<script setup lang="ts">
import type { WeatherConfig } from '~~/shared/utils/widgets'

type Place = { name: string; label: string; lat: number; lon: number }

const config = defineModel<WeatherConfig>('config', { required: true })
const { locale } = useI18n()
const query = shallowRef('')
const places = shallowRef<Place[]>([])
const searching = shallowRef(false)

watchDebounced(
  query,
  async (q) => {
    if (q.trim().length < 2) {
      places.value = []
      return
    }
    searching.value = true
    try {
      const res = await $fetch<{ places: Place[] }>('/api/widgets/places', { query: { q, locale: locale.value } })
      places.value = res.places
    } catch {
      places.value = []
    } finally {
      searching.value = false
    }
  },
  { debounce: 400 },
)

function choose(place: Place) {
  config.value.place = { name: place.name, lat: place.lat, lon: place.lon }
  query.value = ''
  places.value = []
}
</script>
