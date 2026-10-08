<template>
  <iframe
    ref="frame"
    :src="`/widgets/${id}`"
    :title="config.title"
    :height
    loading="lazy"
    sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
    referrerpolicy="no-referrer"
    class="block w-full border-0"
  />
</template>

<script setup lang="ts">
import type { HtmlConfig } from '~~/shared/utils/widgets'

const { id, config } = defineProps<{ id: string; config: Pick<HtmlConfig, 'title' | 'height'> }>()

const frame = useTemplateRef<HTMLIFrameElement>('frame')
const height = shallowRef(config.height ?? 240)

// The frame reports its content height. Its origin is opaque ("null"), so the sender is checked by
// window identity, and the height is clamped so a widget cannot cover the page.
useEventListener(import.meta.client ? window : undefined, 'message', (event: MessageEvent) => {
  if (event.source !== frame.value?.contentWindow || event.data?.topiquWidget !== id) return
  const next = Number(event.data.height)
  if (Number.isFinite(next)) height.value = Math.min(Math.max(next, 40), 2000)
})
</script>
