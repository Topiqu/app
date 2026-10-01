<template>
  <div
    ref="frame"
    data-drag-handle
    class="group relative leading-none select-none"
    :class="selected ? 'rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-default' : ''"
  >
    <img
      :src
      :alt="alt ?? ''"
      :width="width ?? undefined"
      :height="height ?? undefined"
      loading="lazy"
      decoding="async"
      class="block h-auto w-full rounded-lg !cursor-pointer"
    />

    <template v-if="editable">
      <span v-if="!alt?.trim()" class="pointer-events-none absolute left-2 top-2 z-10">
        <UBadge
          color="warning"
          variant="solid"
          size="sm"
          icon="mdi:alert-outline"
          :label="$t('articles.editor.image.altMissing')"
        />
      </span>
      <span
        class="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      >
        <UButton
          square
          size="sm"
          color="error"
          variant="solid"
          icon="mdi:close"
          :title="$t('articles.editor.image.delete')"
          :aria-label="$t('articles.editor.image.delete')"
          @click.stop.prevent="emit('delete')"
          @mousedown.stop.prevent
        />
      </span>
      <!-- The bubble's width presets are the keyboard path; the handles are a pointer shortcut. -->
      <span
        v-for="side in [-1, 1] as const"
        :key="side"
        aria-hidden="true"
        class="absolute top-1/2 z-20 h-12 w-2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full bg-primary ring-2 ring-default transition-opacity"
        :class="[
          side < 0 ? '-left-1' : '-right-1',
          selected || preview !== undefined ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        ]"
        @mousedown.stop.prevent
        @pointerdown.stop.prevent="startResize($event, side)"
      />
      <span
        v-if="preview !== undefined"
        class="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md bg-inverted px-2 py-1 text-sm font-medium text-inverted"
      >
        {{ preview ?? 100 }} %
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { snapImageWidth } from '~~/shared/utils/articleFigure'

const {
  alt,
  centered = false,
  editable = true,
} = defineProps<{
  src: string
  alt?: string | null
  width?: number | null
  height?: number | null
  selected?: boolean
  editable?: boolean
  /** A centred image grows on both sides, so the pointer covers only half the added width. */
  centered?: boolean
}>()

const emit = defineEmits<{ delete: []; resize: [width: number | null] }>()

/** The width shown while dragging; `undefined` when not dragging, `null` for full width. */
const preview = defineModel<number | null | undefined>('preview')

const frame = useTemplateRef<HTMLElement>('frame')

const startResize = (event: PointerEvent, side: -1 | 1) => {
  const column = frame.value?.closest<HTMLElement>('.ProseMirror')
  if (!frame.value || !column) return
  const handle = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startWidth = frame.value.offsetWidth
  const factor = centered ? 2 : 1
  const width = (clientX: number) =>
    snapImageWidth(((startWidth + (clientX - startX) * side * factor) / column.clientWidth) * 100)

  const move = (e: PointerEvent) => (preview.value = width(e.clientX))
  const end = (e: PointerEvent) => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
    if (e.type === 'pointerup') emit('resize', width(e.clientX))
    preview.value = undefined
  }

  handle.setPointerCapture(event.pointerId)
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
  preview.value = width(startX)
}
</script>
