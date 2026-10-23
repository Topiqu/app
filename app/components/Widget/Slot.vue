<template>
  <div v-if="entries.length || showPreviewSlot" :data-widget-slot="name">
    <WidgetPagePreviewSlot :name :hasContent="entries.length > 0">
      <div v-if="entries.length" class="space-y-6">
        <template v-for="{ widget, draft, key } in entries" :key>
          <FormClientWidgetPreview v-if="draft" :widget="widget as WidgetInput" />
          <WidgetDivider v-else-if="widget.kind === 'DIVIDER'" :config="widget.config as DividerConfig" />
          <WidgetCta v-else-if="widget.kind === 'CTA'" :config="widget.config as CtaConfig" />
          <WidgetPrice v-else-if="widget.kind === 'PRICE'" :id="widget.id" :config="widget.config as PriceConfig" />
          <WidgetWeather
            v-else-if="widget.kind === 'WEATHER'"
            :id="widget.id"
            :config="widget.config as WeatherConfig"
          />
          <WidgetHtml v-else-if="widget.kind === 'HTML'" :id="widget.id" :config="widget.config as HtmlFrame" />
        </template>
      </div>
    </WidgetPagePreviewSlot>
  </div>
</template>

<script setup lang="ts">
import type { WidgetSlot } from '~~/shared/utils/widgets'

type HtmlFrame = Pick<HtmlConfig, 'title' | 'height'>

const { name } = defineProps<{ name: WidgetSlot }>()

const site = await useLiveClientSite()
const { locale } = useI18n()
const preview = useWidgetPagePreview()
const showPreviewSlot = computed(
  () =>
    preview.active.value &&
    (preview.state.value.slot === name ||
      (preview.state.value.interactive && canPreviewWidgetSlot(name, preview.state.value.kind))),
)

// A stored config that no longer validates is skipped rather than rendered half-broken. HTML arrives
// without its body (the frame route serves it), so it only needs its title and height.
const widgets = computed(() =>
  slotWidgets(site.value?.widgets ?? [], name, locale.value).flatMap((widget) => {
    if (widget.kind === 'HTML') return [widget]
    const parsed = WIDGET_CONFIG_SCHEMAS[widget.kind].safeParse(widget.config)
    return parsed.success ? [{ ...widget, config: parsed.data }] : []
  }),
)

const entries = computed(() => {
  const state = preview.state.value
  const editingId = preview.active.value ? state.editingId : null
  const result: (
    { key: string; widget: PublicWidget; draft: false } | { key: string; widget: WidgetInput; draft: true }
  )[] = widgets.value
    .filter((widget) => widget.id !== editingId)
    .map((widget) => ({ key: widget.id, widget, draft: false }))
  if (preview.active.value && state.slot === name && state.widget && state.widget.kind !== 'ANNOUNCEMENT') {
    const index = widgets.value.findIndex((widget) => widget.id === editingId)
    result.splice(index < 0 ? result.length : index, 0, {
      key: 'widget-preview-draft',
      widget: state.widget,
      draft: true,
    })
  }
  return result
})
</script>
