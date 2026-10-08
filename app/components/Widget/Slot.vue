<template>
  <div v-if="widgets.length" class="space-y-6" :data-widget-slot="name">
    <template v-for="widget in widgets" :key="widget.id">
      <WidgetDivider v-if="widget.kind === 'DIVIDER'" :config="widget.config as DividerConfig" />
      <WidgetCta v-else-if="widget.kind === 'CTA'" :config="widget.config as CtaConfig" />
      <WidgetPrice v-else-if="widget.kind === 'PRICE'" :id="widget.id" :config="widget.config as PriceConfig" />
      <WidgetWeather v-else-if="widget.kind === 'WEATHER'" :id="widget.id" :config="widget.config as WeatherConfig" />
      <WidgetHtml v-else-if="widget.kind === 'HTML'" :id="widget.id" :config="widget.config as HtmlFrame" />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  WIDGET_CONFIG_SCHEMAS,
  slotWidgets,
  type CtaConfig,
  type DividerConfig,
  type HtmlConfig,
  type PriceConfig,
  type WeatherConfig,
  type WidgetSlot,
} from '~~/shared/utils/widgets'

type HtmlFrame = Pick<HtmlConfig, 'title' | 'height'>

const { name } = defineProps<{ name: WidgetSlot }>()

const site = await useLiveClientSite()
const { locale } = useI18n()

// A stored config that no longer validates is skipped rather than rendered half-broken. HTML arrives
// without its body (the frame route serves it), so it only needs its title and height.
const widgets = computed(() =>
  slotWidgets(site.value?.widgets ?? [], name, locale.value).flatMap((widget) => {
    if (widget.kind === 'HTML') return [widget]
    const parsed = WIDGET_CONFIG_SCHEMAS[widget.kind].safeParse(widget.config)
    return parsed.success ? [{ ...widget, config: parsed.data }] : []
  }),
)
</script>
