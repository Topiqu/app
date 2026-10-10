<template>
  <section
    v-if="active && (selected || selectable)"
    :data-widget-preview-slot="name"
    class="relative scroll-mt-24 rounded-lg"
    :class="[
      hasContent ? 'pt-8' : 'min-h-20',
      selected ? 'outline-2 outline-offset-4 outline-primary' : 'outline-1 outline-dashed outline-accented',
    ]"
  >
    <button
      type="button"
      :data-widget-preview-select="name"
      class="absolute left-3 top-2 z-10 flex items-center gap-2 rounded-md bg-default px-3 py-1 text-sm font-semibold shadow-sm ring-1 ring-default enabled:hover:bg-elevated disabled:cursor-default"
      :class="selected ? 'text-primary' : 'text-muted'"
      :disabled="!selectable"
      :aria-pressed="selected"
      :aria-label="$t('widgets.placement.choose', { slot: $t(`widgets.slots.${name}`) })"
      @click="select"
    >
      <UIcon :name="selected ? 'mdi:check-circle' : 'mdi:map-marker-outline'" class="size-4" aria-hidden="true" />
      {{ $t(`widgets.slots.${name}`) }}
    </button>
    <slot />
  </section>
  <slot v-else />
</template>

<script setup lang="ts">
import type { WidgetSlot } from '~~/shared/utils/widgets'

import { canPreviewWidgetSlot } from '~/utils/widgetPagePreview'

const { name, hasContent = false } = defineProps<{ name: WidgetSlot; hasContent?: boolean }>()
const { active, state } = useWidgetPagePreview()
const selected = computed(() => state.value.slot === name)
const selectable = computed(() => state.value.interactive && canPreviewWidgetSlot(name, state.value.kind))

function select() {
  if (!selectable.value) return
  window.parent.postMessage({ type: 'topiqu:widget-preview:select', slot: name }, window.location.origin)
}
</script>
