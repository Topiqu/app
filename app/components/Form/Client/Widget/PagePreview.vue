<template>
  <div
    ref="container"
    class="relative overflow-hidden bg-muted"
    :class="expanded ? 'h-[calc(100dvh-13rem)] min-h-80' : 'h-80 sm:h-96'"
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
    <div v-if="loading" class="absolute inset-0 grid place-items-center bg-default/90 text-sm text-muted">
      <span class="flex items-center gap-2">
        <UIcon name="mdi:loading" class="size-5 animate-spin" aria-hidden="true" />
        {{ $t('widgets.placement.loading') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  canPreviewWidgetSlot,
  widgetPagePreviewEventSchema,
  type WidgetPagePreviewState,
} from '~/utils/widgetPagePreview'

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
const viewportWidth = computed(() => (mobile ? 390 : 1280))
const scale = computed(() => Math.max(0.1, Math.min(1, (width.value || 460) / viewportWidth.value)))
// The outer window fixes the height. Measuring the page itself would make its 100dvh hero grow on every resize.
const viewportHeight = computed(() => Math.round((height.value || 320) / scale.value))
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
