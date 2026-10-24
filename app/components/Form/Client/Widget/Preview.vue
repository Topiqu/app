<template>
  <WidgetBar v-if="widget.kind === 'ANNOUNCEMENT'" :announcement="barPreview(widget.config)" preview />
  <WidgetDivider v-else-if="widget.kind === 'DIVIDER'" :config="widget.config" />
  <WidgetCta v-else-if="widget.kind === 'CTA'" :config="ctaPreview(widget.config)" :preview="sample" />
  <WidgetPrice
    v-else-if="widget.kind === 'PRICE' && sample"
    :config="widget.config"
    :data="samplePrices(widget.config)"
  />
  <WidgetWeather
    v-else-if="widget.kind === 'WEATHER' && sample"
    :config="{
      ...widget.config,
      place: { ...widget.config.place, name: widget.config.place.name || $t('widgets.library.samplePlace') },
    }"
    :data="sampleWeather()"
  />
  <FormClientWidgetLivePreview v-else-if="widget.kind === 'PRICE' || widget.kind === 'WEATHER'" :widget />
  <div v-else class="flex items-center gap-4 rounded-2xl border border-dashed border-accented bg-elevated p-5">
    <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted">
      <UIcon name="mdi:code-tags" class="size-6" />
    </span>
    <span class="min-w-0">
      <span class="block truncate font-semibold text-highlighted">{{
        widget.config.title || $t('widgets.kinds.HTML')
      }}</span>
      <span class="block text-sm text-muted">{{ $t('widgets.html.sandboxTitle') }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { WidgetInput } from '~~/shared/utils/widgets'

// `sample` swaps live data for fixed sample values, so the library renders without network calls.
const { widget, sample = false } = defineProps<{ widget: WidgetInput; sample?: boolean }>()
const { t } = useI18n()

const barPreview = (config: AnnouncementConfig) => ({
  ...config,
  id: 'preview',
  text: config.text || t('widgets.announcement.placeholder'),
  link: config.link?.url && config.link.label ? config.link : null,
})
const ctaPreview = (config: CtaConfig): CtaConfig => ({
  ...config,
  title: config.title || t('widgets.cta.title'),
  button: { url: config.button.url || '/', label: config.button.label || t('widgets.cta.button') },
})
</script>
