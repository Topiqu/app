<template>
  <div
    ref="container"
    class="relative w-full min-w-0 overflow-hidden bg-muted"
    :class="expanded ? 'min-h-0 flex-1' : mobile ? 'h-[min(36rem,70dvh)] min-h-64' : 'h-80 sm:h-96'"
    :aria-busy="loading"
  >
    <iframe
      ref="frame"
      :src="source"
      :title="$t('widgets.placement.frameTitle')"
      class="absolute top-0 origin-top-left border-0 bg-default"
      :style="{
        width: `${viewportWidth}px`,
        height: `${viewportHeight}px`,
        left: `${Math.max(0, (width - viewportWidth * scale) / 2)}px`,
        transform: `scale(${scale})`,
      }"
      @load="loaded"
    />
    <USkeleton v-if="loading" class="absolute inset-0" :aria-label="$t('widgets.placement.loading')" />
  </div>
</template>

<script setup lang="ts">
import type { WidgetPagePreviewState } from '~/utils/widgetPagePreview'

const {
  source,
  state,
  mobile = false,
  expanded = false,
} = defineProps<{
  source: string
  state: WidgetPagePreviewState
  mobile?: boolean
  expanded?: boolean
}>()
const emit = defineEmits<{ select: [slot: string] }>()
const frame = useTemplateRef<HTMLIFrameElement>('frame')
const container = useTemplateRef<HTMLElement>('container')
const { width, height } = useElementSize(container, { width: 460, height: 320 })
// Reflow to the panel width, respecting the publication's 320px minimum before scaling down.
const viewportWidth = computed(() => (mobile ? Math.min(390, Math.max(320, width.value || 390)) : 1280))
const scale = computed(() => Math.min(1, (width.value || 460) / viewportWidth.value))
// The outer window fixes the height. Measuring the page itself would make its 100dvh hero grow on every resize.
const viewportHeight = computed(() => Math.floor((height.value || 320) / scale.value))
const loading = shallowRef(true)

function synchronize(focus = false) {
  frame.value?.contentWindow?.postMessage(
    { type: 'topiqu:widget-preview:update', state: JSON.parse(JSON.stringify(state)), focus },
    window.location.origin,
  )
}
function loaded() {
  loading.value = false
  synchronize(true)
}
watch(
  () => source,
  () => {
    loading.value = true
  },
)
watch(
  () => state,
  () => synchronize(),
  { deep: true },
)
watch([viewportWidth, viewportHeight], () => synchronize(true), { flush: 'post' })
useEventListener('message', (event) => {
  const sender = frame.value?.contentWindow
  if (!sender || event.source !== sender || event.origin !== window.location.origin) return
  const parsed = widgetPagePreviewEventSchema.safeParse(event.data)
  if (!parsed.success) return
  if (parsed.data.type === 'topiqu:widget-preview:ready') synchronize(true)
  else if (state.interactive && canPreviewWidgetSlot(parsed.data.slot, state.kind)) emit('select', parsed.data.slot)
})
</script>
