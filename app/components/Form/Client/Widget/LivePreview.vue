<template>
  <WidgetPrice v-if="ready?.kind === 'PRICE'" :config="ready.config" :data="data as PriceData" />
  <WidgetWeather v-else-if="ready?.kind === 'WEATHER'" :config="ready.config" :data="data as WeatherData" />
  <p v-else class="text-sm text-muted">{{ $t('widgets.previewIncomplete') }}</p>
</template>

<script setup lang="ts">
import type { WidgetPreview } from '~~/shared/utils/widgets'

const { widget } = defineProps<{ widget: WidgetPreview }>()

const ready = shallowRef<WidgetPreview | null>(null)
const data = shallowRef<PriceData | WeatherData | null>(null)

// The editor mutates the config in place, so the watch compares serialized snapshots; `run` drops a
// response that a newer edit has overtaken.
let run = 0
watchDebounced(
  () => JSON.stringify(widget),
  async () => {
    const current = ++run
    const parsed = widgetPreviewSchema.safeParse(widget)
    ready.value = parsed.success ? parsed.data : null
    data.value = null
    if (!parsed.success) return
    const result = await $fetch<PriceData | WeatherData, '/api/widgets/preview'>('/api/widgets/preview', {
      method: 'POST',
      body: parsed.data,
    }).catch(() => null)
    if (current === run) data.value = result
  },
  { debounce: 500, immediate: true },
)
</script>
